"""
Connection service: manages database connections with encryption,
dynamic engine creation, and connectivity testing.
"""

import time
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import create_engine, text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connection import DatabaseConnection, DatabaseType, ConnectionStatus
from app.schemas.connection import ConnectionCreate, ConnectionUpdate, ConnectionResponse, ConnectionTest
from app.security import encrypt_value, decrypt_value
from app.config import settings
from fastapi import HTTPException, status


class ConnectionService:
    """Manages database connection lifecycle, encryption, and testing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _build_connection_url(self, conn: DatabaseConnection, sync: bool = True) -> str:
        """Build a database connection URL from decrypted credentials."""
        host = decrypt_value(conn.host)
        username = decrypt_value(conn.username)
        password = decrypt_value(conn.password)

        if conn.db_type == DatabaseType.POSTGRESQL:
            driver = "postgresql+psycopg2" if sync else "postgresql+asyncpg"
        else:
            driver = "mysql+pymysql" if sync else "mysql+aiomysql"

        return f"{driver}://{username}:{password}@{host}:{conn.port}/{conn.database_name}"

    async def create_connection(
        self, user_id: UUID, data: ConnectionCreate
    ) -> ConnectionResponse:
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

    async def get_connection(
        self, connection_id: UUID, user_id: UUID
    ) -> ConnectionResponse:
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

        # Reset test status on update
        conn.last_test_status = ConnectionStatus.UNKNOWN
        conn.last_test_message = None

        await self.db.flush()
        await self.db.refresh(conn)
        return self._to_response(conn)

    async def delete_connection(
        self, connection_id: UUID, user_id: UUID
    ) -> dict:
        """Delete a connection."""
        conn = await self._get_connection_or_404(connection_id, user_id)
        await self.db.delete(conn)
        await self.db.flush()
        return {"message": "Connection deleted successfully"}

    async def test_connection(
        self, connection_id: UUID, user_id: UUID
    ) -> ConnectionTest:
        """Test database connectivity and update status."""
        conn = await self._get_connection_or_404(connection_id, user_id)

        try:
            url = self._build_connection_url(conn, sync=True)
            engine = create_engine(url, connect_args={"connect_timeout": 10})

            start_time = time.time()
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            latency = (time.time() - start_time) * 1000  # ms

            engine.dispose()

            # Update connection status
            conn.last_tested_at = datetime.now(timezone.utc)
            conn.last_test_status = ConnectionStatus.SUCCESS
            conn.last_test_message = f"Connected successfully ({latency:.1f}ms)"
            await self.db.flush()

            return ConnectionTest(
                success=True,
                message=f"Connection successful",
                latency_ms=round(latency, 1),
            )

        except Exception as e:
            conn.last_tested_at = datetime.now(timezone.utc)
            conn.last_test_status = ConnectionStatus.FAILED
            conn.last_test_message = str(e)[:500]
            await self.db.flush()

            return ConnectionTest(
                success=False,
                message=f"Connection failed: {str(e)[:200]}",
            )

    async def get_connection_model(
        self, connection_id: UUID, user_id: UUID
    ) -> DatabaseConnection:
        """Get the raw connection model (for internal use by other services)."""
        return await self._get_connection_or_404(connection_id, user_id)

    def get_sync_engine(self, conn: DatabaseConnection):
        """Create a synchronous SQLAlchemy engine for a connection."""
        url = self._build_connection_url(conn, sync=True)
        return create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=5)

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
