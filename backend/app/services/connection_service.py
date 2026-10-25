"""
Connection service: manages database connections with encryption,
dynamic engine creation, and connectivity testing.
"""

import logging
import re
import time
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import create_engine, func, or_, select, text
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.pool import NullPool

from app.enums import ConnectionStatus, DatabaseType
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTest,
    ConnectionUpdate,
)
from app.security import decrypt_value, encrypt_value
from app.services.engine_cache import engine_cache

logger = logging.getLogger(__name__)

# Fragments commonly found in driver errors that would reveal connection
# topology (credentials, hosts, ports) if echoed back to clients.
_CREDENTIAL_PATTERN = re.compile(
    r"(?://\S+:\S+@|password\s*[:=]\s*\S+|user\s*[:=]\s*\S+|@\[[^\]]+\])", re.IGNORECASE
)


def _safe_connection_error(raw: str) -> str:
    """Reduce a driver exception to a shareable, credential-free reason."""
    first_line = (raw or "").strip().splitlines()[0] if raw else ""
    cleaned = _CREDENTIAL_PATTERN.sub("[redacted]", first_line)
    return cleaned[:200] or "unable to reach the database"


class ConnectionService:
    """Manages database connection lifecycle, encryption, and testing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def build_url(self, conn: DatabaseConnection, sync: bool = True) -> URL:
        """
        Build a database URL from decrypted credentials.

        Uses ``URL.create`` so passwords containing ``@ : / #`` are escaped
        correctly instead of silently corrupting the connection string.
        """
        if conn.db_type == DatabaseType.POSTGRESQL:
            driver = "postgresql+psycopg2" if sync else "postgresql+asyncpg"
        else:
            driver = "mysql+pymysql" if sync else "mysql+aiomysql"

        return URL.create(
            drivername=driver,
            username=decrypt_value(conn.username),
            password=decrypt_value(conn.password),
            host=decrypt_value(conn.host),
            port=conn.port,
            database=conn.database_name,
        )

    @staticmethod
    def connect_args(conn: DatabaseConnection, timeout: int = 10) -> dict:
        """Driver-specific connection arguments, including SSL when enabled."""
        if conn.db_type == DatabaseType.POSTGRESQL:
            args: dict[str, object] = {"connect_timeout": timeout}
            if conn.ssl_enabled:
                args["sslmode"] = "require"
            return args

        mysql_args: dict[str, object] = {"connect_timeout": timeout}
        if conn.ssl_enabled:
            mysql_args["ssl"] = {}
        return mysql_args

    async def create_connection(self, user_id: UUID, data: ConnectionCreate) -> ConnectionResponse:
        """Create a new database connection with encrypted credentials."""
        conn = DatabaseConnection(
            user_id=user_id,
            name=data.name,
            db_type=DatabaseType(data.db_type),
            host=encrypt_value(data.host),
            port=data.port,
            database_name=data.database_name,
            username=encrypt_value(data.username),
            password=encrypt_value(data.password),
            ssl_enabled=data.ssl_enabled,
        )
        self.db.add(conn)
        await self.db.flush()
        await self.db.refresh(conn)

        return self._to_response(conn)

    async def list_connections(self, user_id: UUID) -> list[ConnectionResponse]:
        """List all connections for a user."""
        result = await self.db.execute(
            select(DatabaseConnection)
            .where(DatabaseConnection.user_id == user_id)
            .order_by(DatabaseConnection.created_at.desc())
        )
        connections = result.scalars().all()
        return [self._to_response(c) for c in connections]

    async def get_connection(self, connection_id: UUID, user_id: UUID) -> ConnectionResponse:
        """Get a specific connection by ID."""
        conn = await self._get_connection_or_404(connection_id, user_id)
        return self._to_response(conn)

    async def update_connection(
        self, connection_id: UUID, user_id: UUID, data: ConnectionUpdate
    ) -> ConnectionResponse:
        """Update an existing connection."""
        conn = await self._get_connection_or_404(connection_id, user_id)

        if data.name is not None:
            conn.name = data.name
        if data.host is not None:
            conn.host = encrypt_value(data.host)
        if data.port is not None:
            conn.port = data.port
        if data.database_name is not None:
            conn.database_name = data.database_name
        if data.username is not None:
            conn.username = encrypt_value(data.username)
        if data.password is not None:
            conn.password = encrypt_value(data.password)
        if data.ssl_enabled is not None:
            conn.ssl_enabled = data.ssl_enabled
        if data.is_active is not None:
            conn.is_active = data.is_active

        # Reset test status only when endpoint or credentials changed, so
        # toggling activation does not discard a known-good test result.
        endpoint_changed = any(
            getattr(data, field) is not None
            for field in ("host", "port", "database_name", "username", "password")
        )
        if endpoint_changed:
            conn.last_test_status = ConnectionStatus.UNKNOWN
            conn.last_test_message = None

        await self.db.flush()
        await self.db.refresh(conn)
        self.invalidate_engine(connection_id)
        return self._to_response(conn)

    async def delete_connection(self, connection_id: UUID, user_id: UUID) -> dict:
        """
        Delete a connection.

        Refuses the delete when transfer jobs reference the connection so that
        history is not silently destroyed by the database-level cascade.
        """
        conn = await self._get_connection_or_404(connection_id, user_id)

        referencing = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                or_(
                    TransferJob.source_connection_id == connection_id,
                    TransferJob.target_connection_id == connection_id,
                )
            )
        )
        if (referencing.scalar() or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This connection is referenced by existing transfers. "
                    "Delete those transfers first."
                ),
            )

        await self.db.delete(conn)
        await self.db.flush()
        self.invalidate_engine(connection_id)
        return {"message": "Connection deleted successfully"}

    async def test_connection(self, connection_id: UUID, user_id: UUID) -> ConnectionTest:
        """Test database connectivity and update status."""
        conn = await self._get_connection_or_404(connection_id, user_id)
        engine = None

        try:
            url = self.build_url(conn, sync=True)
            engine = create_engine(
                url,
                connect_args=self.connect_args(conn),
                poolclass=NullPool,
            )

            start_time = time.time()
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            latency = (time.time() - start_time) * 1000  # ms

            # Update connection status
            conn.last_tested_at = datetime.now(UTC)
            conn.last_test_status = ConnectionStatus.SUCCESS
            conn.last_test_message = f"Connected successfully ({latency:.1f}ms)"
            await self.db.flush()

            return ConnectionTest(
                success=True,
                message="Connection successful",
                latency_ms=round(latency, 1),
            )

        except Exception as e:
            # Driver messages can embed hosts, users and DSN fragments; keep
            # the full detail in server logs and store a scrubbed summary.
            logger.warning("Connection test failed for %s: %s", connection_id, e)
            reason = _safe_connection_error(str(e))
            conn.last_tested_at = datetime.now(UTC)
            conn.last_test_status = ConnectionStatus.FAILED
            conn.last_test_message = reason[:200]
            await self.db.flush()

            return ConnectionTest(
                success=False,
                message=f"Connection failed: {reason}",
            )
        finally:
            if engine is not None:
                engine.dispose()

    async def get_connection_model(self, connection_id: UUID, user_id: UUID) -> DatabaseConnection:
        """
        Get the raw connection model (for internal use by other services).

        Deactivated connections are refused: discovery and transfers are the
        paths that touch remote databases, and a deactivated connection must
        not be usable from either.
        """
        conn = await self._get_connection_or_404(connection_id, user_id)
        if not conn.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Connection '{conn.name}' is deactivated",
            )
        return conn

    @staticmethod
    def _fingerprint(conn: DatabaseConnection) -> tuple:
        """Identify the credential/endpoint set an engine was built for."""
        return (
            conn.host,
            conn.port,
            conn.database_name,
            conn.username,
            conn.password,
            conn.db_type.value,
            conn.ssl_enabled,
            conn.updated_at.isoformat() if conn.updated_at else None,
        )

    def get_sync_engine(self, conn: DatabaseConnection):
        """
        Return a pooled engine for a remote connection, reusing a cached one
        when the credentials and endpoint are unchanged.
        """
        key = str(conn.id)
        fingerprint = self._fingerprint(conn)

        cached = engine_cache.get(key, fingerprint)
        if cached is not None:
            return cached

        engine = create_engine(
            self.build_url(conn, sync=True),
            connect_args=self.connect_args(conn),
            pool_size=2,
            max_overflow=2,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
        return engine_cache.put(key, fingerprint, engine)

    @staticmethod
    def invalidate_engine(connection_id: UUID) -> None:
        """Drop a cached engine, e.g. after an update or delete."""
        engine_cache.invalidate(str(connection_id))

    async def _get_connection_or_404(
        self, connection_id: UUID, user_id: UUID
    ) -> DatabaseConnection:
        """Get connection or raise 404."""
        result = await self.db.execute(
            select(DatabaseConnection).where(
                DatabaseConnection.id == connection_id,
                DatabaseConnection.user_id == user_id,
            )
        )
        conn = result.scalar_one_or_none()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection not found",
            )
        return conn

    def _to_response(self, conn: DatabaseConnection) -> ConnectionResponse:
        """Convert model to response, decrypting display fields."""
        return ConnectionResponse(
            id=conn.id,
            name=conn.name,
            db_type=conn.db_type.value,
            host=decrypt_value(conn.host),
            port=conn.port,
            database_name=conn.database_name,
            username=decrypt_value(conn.username),
            ssl_enabled=conn.ssl_enabled,
            is_active=conn.is_active,
            last_tested_at=conn.last_tested_at,
            last_test_status=conn.last_test_status.value,
            last_test_message=conn.last_test_message,
            created_at=conn.created_at,
            updated_at=conn.updated_at,
        )
