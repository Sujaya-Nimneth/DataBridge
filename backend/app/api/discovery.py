"""
Data discovery API routes for exploring remote database structures.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.discovery import SchemaInfo, TableInfo, ColumnInfo, DataPreview
from app.services.discovery_service import DiscoveryService
from app.security import get_current_user

router = APIRouter(prefix="/discovery", tags=["Data Discovery"])


@router.get("/{connection_id}/schemas", response_model=list[SchemaInfo])
async def list_schemas(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all schemas in a connected database.

    System schemas (information_schema, pg_catalog, etc.) are filtered out.
    """
    service = DiscoveryService(db)
    return await service.get_schemas(connection_id, current_user.id)


@router.get("/{connection_id}/tables", response_model=list[TableInfo])
async def list_tables(
    connection_id: UUID,
    schema: Optional[str] = Query(None, description="Schema name (defaults to 'public' for PG)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all tables and views in a schema.

    Returns table name, schema, and type (table/view).
    """
    service = DiscoveryService(db)
    return await service.get_tables(connection_id, current_user.id, schema)


@router.get("/{connection_id}/tables/{table_name}/columns", response_model=list[ColumnInfo])
async def get_columns(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get column metadata for a specific table.

    Returns column name, data type, nullable flag, default value,
    primary key and foreign key indicators.
    """
    service = DiscoveryService(db)
    return await service.get_columns(connection_id, current_user.id, table_name, schema)


@router.get("/{connection_id}/tables/{table_name}/preview", response_model=DataPreview)
async def preview_data(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    filter_query: Optional[str] = Query(None, description="SQL WHERE clause for filtering"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Preview data from a table with pagination.

    Supports optional SQL WHERE clause filtering and configurable page size.
    """
    service = DiscoveryService(db)
    return await service.preview_data(
        connection_id, current_user.id, table_name, schema, page, page_size, filter_query
    )


@router.get("/{connection_id}/tables/{table_name}/count")
async def get_row_count(
    connection_id: UUID,
    table_name: str,
    schema: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the total row count for a table."""
    service = DiscoveryService(db)
    count = await service.get_row_count(connection_id, current_user.id, table_name, schema)
    return {"table": table_name, "row_count": count}
