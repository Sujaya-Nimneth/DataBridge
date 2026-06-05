"""
Discovery service: inspects remote database structures using SQLAlchemy reflection.
Supports schemas, tables, views, columns, and data preview.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import inspect, text, create_engine
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connection import DatabaseConnection, DatabaseType
from app.schemas.discovery import SchemaInfo, TableInfo, ColumnInfo, DataPreview
from app.services.connection_service import ConnectionService
from app.config import settings
from fastapi import HTTPException, status


class DiscoveryService:
    """Inspects remote databases for schema/table/column discovery and data preview."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.conn_service = ConnectionService(db)

    async def get_schemas(
        self, connection_id: UUID, user_id: UUID
    ) -> list[SchemaInfo]:
        """List all schemas in the connected database."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        engine = self.conn_service.get_sync_engine(conn)

        try:
            inspector = inspect(engine)
            schema_names = inspector.get_schema_names()

            schemas = []
            for name in schema_names:
                # Skip system schemas
                if name in ("information_schema", "pg_catalog", "pg_toast",
                            "mysql", "performance_schema", "sys"):
                    continue
                table_count = len(inspector.get_table_names(schema=name))
                schemas.append(SchemaInfo(name=name, table_count=table_count))

            return schemas
        finally:
            engine.dispose()

    async def get_tables(
        self, connection_id: UUID, user_id: UUID, schema: Optional[str] = None
    ) -> list[TableInfo]:
        """List all tables and views in a schema."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        engine = self.conn_service.get_sync_engine(conn)

        try:
            inspector = inspect(engine)

            # Default schema
            if not schema:
                if conn.db_type == DatabaseType.POSTGRESQL:
                    schema = "public"
                else:
                    schema = conn.database_name

            tables = []

            # Get tables
            for table_name in inspector.get_table_names(schema=schema):
                tables.append(TableInfo(
                    name=table_name,
                    schema_name=schema,
                    type="table",
                ))

            # Get views
            try:
                for view_name in inspector.get_view_names(schema=schema):
                    tables.append(TableInfo(
                        name=view_name,
                        schema_name=schema,
                        type="view",
                    ))
            except Exception:
                pass  # Some databases may not support view listing

            return sorted(tables, key=lambda t: t.name)
        finally:
            engine.dispose()

    async def get_columns(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: Optional[str] = None,
    ) -> list[ColumnInfo]:
        """Get column metadata for a table."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        engine = self.conn_service.get_sync_engine(conn)

        try:
            inspector = inspect(engine)

            if not schema:
                schema = "public" if conn.db_type == DatabaseType.POSTGRESQL else conn.database_name

            # Get primary keys
            try:
                pk_constraint = inspector.get_pk_constraint(table_name, schema=schema)
                pk_columns = set(pk_constraint.get("constrained_columns", []))
            except Exception:
                pk_columns = set()

            # Get foreign keys
            try:
                fk_info = inspector.get_foreign_keys(table_name, schema=schema)
                fk_columns = set()
                for fk in fk_info:
                    fk_columns.update(fk.get("constrained_columns", []))
            except Exception:
                fk_columns = set()

            columns = []
            for col in inspector.get_columns(table_name, schema=schema):
                col_type = str(col["type"])
                max_length = None
                if hasattr(col["type"], "length") and col["type"].length:
                    max_length = col["type"].length

                columns.append(ColumnInfo(
                    name=col["name"],
                    type=col_type,
                    nullable=col.get("nullable", True),
                    default=str(col["default"]) if col.get("default") else None,
                    is_primary_key=col["name"] in pk_columns,
                    is_foreign_key=col["name"] in fk_columns,
                    max_length=max_length,
                    comment=col.get("comment"),
                ))

            return columns
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to inspect table: {str(e)[:200]}",
            )
        finally:
            engine.dispose()

    async def preview_data(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        filter_query: Optional[str] = None,
    ) -> DataPreview:
        """Preview data from a table with pagination and optional filtering."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        engine = self.conn_service.get_sync_engine(conn)

        if page_size > settings.TRANSFER_MAX_PREVIEW_ROWS:
            page_size = settings.TRANSFER_MAX_PREVIEW_ROWS

        try:
            if not schema:
                schema = "public" if conn.db_type == DatabaseType.POSTGRESQL else conn.database_name

            # Build qualified table name
            qualified_table = f'"{schema}"."{table_name}"'
            if conn.db_type == DatabaseType.MYSQL:
                qualified_table = f"`{schema}`.`{table_name}`"

            with engine.connect() as connection:
                # Get total count
                count_query = f"SELECT COUNT(*) FROM {qualified_table}"
                if filter_query:
                    count_query += f" WHERE {filter_query}"
                total_rows = connection.execute(text(count_query)).scalar()

                # Get column info
                inspector = inspect(engine)
                columns_info = inspector.get_columns(table_name, schema=schema)
                column_names = [c["name"] for c in columns_info]
                column_types = [str(c["type"]) for c in columns_info]

                # Get paginated data
                offset = (page - 1) * page_size
                data_query = f"SELECT * FROM {qualified_table}"
                if filter_query:
                    data_query += f" WHERE {filter_query}"
                data_query += f" LIMIT {page_size} OFFSET {offset}"

                result = connection.execute(text(data_query))
                rows = []
                for row in result:
                    rows.append([
                        str(v) if v is not None else None
                        for v in row
                    ])

                return DataPreview(
                    columns=column_names,
                    column_types=column_types,
                    rows=rows,
                    total_rows=total_rows,
                    page=page,
                    page_size=page_size,
                    has_more=(offset + page_size) < total_rows,
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to preview data: {str(e)[:200]}",
            )
        finally:
            engine.dispose()

    async def get_row_count(
        self,
        connection_id: UUID,
        user_id: UUID,
        table_name: str,
        schema: Optional[str] = None,
    ) -> int:
        """Get the row count for a table."""
        conn = await self.conn_service.get_connection_model(connection_id, user_id)
        engine = self.conn_service.get_sync_engine(conn)

        try:
            if not schema:
                schema = "public" if conn.db_type == DatabaseType.POSTGRESQL else conn.database_name

            qualified_table = f'"{schema}"."{table_name}"'
            if conn.db_type == DatabaseType.MYSQL:
                qualified_table = f"`{schema}`.`{table_name}`"

            with engine.connect() as connection:
                result = connection.execute(text(f"SELECT COUNT(*) FROM {qualified_table}"))
                return result.scalar()
        finally:
            engine.dispose()
