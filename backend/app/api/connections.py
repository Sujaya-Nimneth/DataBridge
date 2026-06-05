"""
Connection management API routes.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.connection import ConnectionCreate, ConnectionUpdate, ConnectionResponse, ConnectionTest
from app.services.connection_service import ConnectionService
from app.security import decode_token, security_scheme

router = APIRouter(prefix="/connections", tags=["Connections"])


def _get_user_id(credentials: HTTPAuthorizationCredentials) -> UUID:
    """Extract user ID from JWT token."""
    payload = decode_token(credentials.credentials)
    return UUID(payload["sub"])


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """List all database connections for the authenticated user."""
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.list_connections(user_id)


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(
    data: ConnectionCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new database connection.

    Credentials are encrypted before storage using Fernet symmetric encryption.
    Supports PostgreSQL and MySQL database types.
    """
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.create_connection(user_id, data)


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(
    connection_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific database connection."""
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.get_connection(connection_id, user_id)


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: UUID,
    data: ConnectionUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing database connection."""
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.update_connection(connection_id, user_id, data)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a database connection and all associated data."""
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.delete_connection(connection_id, user_id)


@router.post("/{connection_id}/test", response_model=ConnectionTest)
async def test_connection(
    connection_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Test database connectivity.

    Attempts to connect and execute a simple query (SELECT 1).
    Updates the connection's last_test_status and last_tested_at fields.
    """
    user_id = _get_user_id(credentials)
    service = ConnectionService(db)
    return await service.test_connection(connection_id, user_id)
