"""
Data discovery API routes for exploring remote database structures.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.discovery import SchemaInfo, TableInfo, ColumnInfo, DataPreview
from app.services.discovery_service import DiscoveryService
from app.security import decode_token, security_scheme

router = APIRouter(prefix="/discovery", tags=["Data Discovery"])


def _get_user_id(credentials: HTTPAuthorizationCredentials) -> UUID:
    payload = decode_token(credentials.credentials)
    return UUID(payload["sub"])


@router.get("/{connection_id}/schemas", response_model=list[SchemaInfo])
async def list_schemas(
    connection_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    List all schemas in a connected database.

    System schemas (information_schema, pg_catalog, etc.) are filtered out.
    """
    user_id = _get_user_id(credentials)
    service = DiscoveryService(db)
    return await service.get_schemas(connection_id, user_id)


@router.get("/{connection_id}/tables", response_model=list[TableInfo])
async def list_tables(
    connection_id: UUID,
    schema: Optional[str] = Query(None, description="Schema name (defaults to 'public' for PG)"),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    List all tables and views in a schema.

    Returns table name, schema, and type (table/view).
    """
    user_id = _get_user_id(credentials)
    service = DiscoveryService(db)
    return await service.get_tables(connection_id, user_id, schema)


@router.get("/{connection_id}/tables/{table_name}/columns", response_model=list[ColumnInfo])
async def get_columns(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get column metadata for a specific table.

    Returns column name, data type, nullable flag, default value,
    primary key and foreign key indicators.
    """
    user_id = _get_user_id(credentials)
    service = DiscoveryService(db)
    return await service.get_columns(connection_id, user_id, table_name, schema)


@router.get("/{connection_id}/tables/{table_name}/preview", response_model=DataPreview)
async def preview_data(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    filter_query: Optional[str] = Query(None, description="SQL WHERE clause for filtering"),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Preview data from a table with pagination.

    Supports optional SQL WHERE clause filtering and configurable page size.
    """
    user_id = _get_user_id(credentials)
    service = DiscoveryService(db)
    return await service.preview_data(
        connection_id, user_id, table_name, schema, page, page_size, filter_query
    )


@router.get("/{connection_id}/tables/{table_name}/count")
async def get_row_count(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get the total row count for a table."""
    user_id = _get_user_id(credentials)
    service = DiscoveryService(db)
    count = await service.get_row_count(connection_id, user_id, table_name, schema)
    return {"table": table_name, "row_count": count}
