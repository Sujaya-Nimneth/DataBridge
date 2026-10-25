"""
Discovery service: inspects remote database structures using SQLAlchemy reflection.
Supports schemas, tables, views, columns, and data preview.
"""

import datetime as dt
import decimal
import uuid as uuid_module
from typing import Any
from uuid import UUID

from anyio import to_thread
from fastapi import HTTPException, status
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.enums import DatabaseType
from app.models.connection import DatabaseConnection
from app.schemas.discovery import ColumnInfo, DataPreview, SchemaInfo, TableInfo
from app.services.connection_service import ConnectionService
from app.sql_utils import UnsafeFilterError, qualify_table, validate_filter_query

SYSTEM_SCHEMAS = {
    "information_schema",
    "pg_catalog",
    "pg_toast",
    "mysql",
    "performance_schema",
    "sys",
}


def _default_schema(conn: DatabaseConnection) -> str:
    """Return the schema to inspect when the caller did not specify one."""
    if conn.db_type == DatabaseType.POSTGRESQL:
        return "public"
    return conn.database_name


def _json_safe(value: Any) -> Any:
    """
    Convert a database value into something JSON can represent.

    Values keep their native type where JSON supports it (numbers, booleans)
    instead of being flattened to strings, which previously made every numeric
    and boolean column render as text in the explorer.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, dt.timedelta):
        return value.total_seconds()
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    if isinstance(value, uuid_module.UUID):
        return str(value)
    return str(value)


class DiscoveryService:
    """Inspects remote databases for schema/table/column discovery and data preview."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.conn_service = ConnectionService(db)

    async def get_schemas(self, connection_id: UUID, user_id: UUID) -> list[SchemaInfo]:
        """List all schemas in the connected database."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        return await to_thread.run_sync(self._get_schemas_sync, conn)

    def _get_schemas_sync(self, conn: DatabaseConnection) -> list[SchemaInfo]:
        engine = self.conn_service.get_sync_engine(conn)
        inspector = inspect(engine)
        schemas = []
        for name in inspector.get_schema_names():
            if name in SYSTEM_SCHEMAS:
                continue
            table_count = len(inspector.get_table_names(schema=name))
            schemas.append(SchemaInfo(name=name, table_count=table_count))
        return sorted(schemas, key=lambda s: s.name)

    async def get_tables(
        self, connection_id: UUID, user_id: UUID, schema: str | None = None
    ) -> list[TableInfo]:
        """List all tables and views in a schema."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        return await to_thread.run_sync(self._get_tables_sync, conn, schema)

    def _get_tables_sync(self, conn: DatabaseConnection, schema: str | None) -> list[TableInfo]:
        engine = self.conn_service.get_sync_engine(conn)
        inspector = inspect(engine)
        schema = schema or _default_schema(conn)

        tables = [
            TableInfo(name=name, schema_name=schema, type="table")
            for name in inspector.get_table_names(schema=schema)
        ]

        try:
            tables.extend(
                TableInfo(name=name, schema_name=schema, type="view")
                for name in inspector.get_view_names(schema=schema)
            )
        except Exception:
            # Some engines/drivers cannot enumerate views; tables still work.
            pass

        return sorted(tables, key=lambda t: t.name)

    async def get_columns(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: str | None = None,
    ) -> list[ColumnInfo]:
        """Get column metadata for a table."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        try:
            return await to_thread.run_sync(self._get_columns_sync, conn, table_name, schema)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to inspect table: {str(e)[:200]}",
            ) from e

    def _get_columns_sync(
        self, conn: DatabaseConnection, table_name: str, schema: str | None
    ) -> list[ColumnInfo]:
        engine = self.conn_service.get_sync_engine(conn)
        inspector = inspect(engine)
        schema = schema or _default_schema(conn)

        try:
            pk_constraint = inspector.get_pk_constraint(table_name, schema=schema)
            pk_columns: set[str] = set(pk_constraint.get("constrained_columns") or [])
        except Exception:
            pk_columns = set()

        try:
            fk_columns: set[str] = set()
            for fk in inspector.get_foreign_keys(table_name, schema=schema):
                fk_columns.update(fk.get("constrained_columns") or [])
        except Exception:
            fk_columns = set()

        columns = []
        for col in inspector.get_columns(table_name, schema=schema):
            columns.append(
                ColumnInfo(
                    name=col["name"],
                    type=str(col["type"]),
                    nullable=col.get("nullable", True),
                    default=str(col["default"]) if col.get("default") else None,
                    is_primary_key=col["name"] in pk_columns,
                    is_foreign_key=col["name"] in fk_columns,
                    max_length=getattr(col["type"], "length", None),
                    comment=col.get("comment"),
                )
            )
        return columns

    async def preview_data(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: str | None = None,
        page: int = 1,
        page_size: int = 50,
        filter_query: str | None = None,
    ) -> DataPreview:
        """Preview data from a table with pagination and optional filtering."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)

        try:
            safe_filter = validate_filter_query(filter_query)
        except UnsafeFilterError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

        page_size = min(page_size, settings.TRANSFER_MAX_PREVIEW_ROWS)

        try:
            return await to_thread.run_sync(
                self._preview_sync,
                conn,
                table_name,
                schema,
                page,
                page_size,
                safe_filter,
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to preview data: {str(e)[:200]}",
            ) from e

    def _preview_sync(
        self,
        conn: DatabaseConnection,
        table_name: str,
        schema: str | None,
        page: int,
        page_size: int,
        filter_query: str | None,
    ) -> DataPreview:
        engine = self.conn_service.get_sync_engine(conn)
        schema = schema or _default_schema(conn)
        qualified_table = qualify_table(engine, schema, table_name)
        where_clause = f" WHERE {filter_query}" if filter_query else ""

        inspector = inspect(engine)
        columns_info = inspector.get_columns(table_name, schema=schema)
        column_names = [c["name"] for c in columns_info]
        column_types = [str(c["type"]) for c in columns_info]
        order_column = self._order_column(inspector, table_name, schema, columns_info)

        offset = (page - 1) * page_size

        with engine.connect() as connection:
            total_rows = (
                connection.execute(
                    text(f"SELECT COUNT(*) FROM {qualified_table}{where_clause}")
                ).scalar()
                or 0
            )

            # Ordering is required for stable pagination: without it the
            # database may return rows in a different order per query, so
            # pages would duplicate or skip records.
            order_clause = f" ORDER BY {order_column}" if order_column else ""
            data_query = (
                f"SELECT * FROM {qualified_table}{where_clause}"
                f"{order_clause} LIMIT :limit OFFSET :offset"
            )
            result = connection.execute(text(data_query), {"limit": page_size, "offset": offset})
            rows = [[_json_safe(v) for v in row] for row in result]

        return DataPreview(
            columns=column_names,
            column_types=column_types,
            rows=rows,
            total_rows=total_rows,
            page=page,
            page_size=page_size,
            has_more=(offset + page_size) < total_rows,
        )

    @staticmethod
    def _order_column(
        inspector, table_name: str, schema: str, columns_info: list[dict]
    ) -> str | None:
        """Prefer the primary key, then fall back to the first column."""
        try:
            pk = inspector.get_pk_constraint(table_name, schema=schema)
            pk_columns = pk.get("constrained_columns") or []
        except Exception:
            pk_columns = []

        preparer = inspector.dialect.identifier_preparer
        if pk_columns:
            return ", ".join(preparer.quote(c) for c in pk_columns)
        if columns_info:
            return str(preparer.quote(columns_info[0]["name"]))
        return None

    async def get_row_count(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: str | None = None,
    ) -> int:
        """Get the row count for a table."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        return await to_thread.run_sync(self._get_row_count_sync, conn, table_name, schema)

    def _get_row_count_sync(
        self, conn: DatabaseConnection, table_name: str, schema: str | None
    ) -> int:
        engine = self.conn_service.get_sync_engine(conn)
        schema = schema or _default_schema(conn)
        qualified_table = qualify_table(engine, schema, table_name)
        with engine.connect() as connection:
            return connection.execute(text(f"SELECT COUNT(*) FROM {qualified_table}")).scalar() or 0
