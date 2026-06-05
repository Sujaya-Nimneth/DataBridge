"""
Data transfer API routes.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.transfer import TransferCreate, TransferResponse, TransferLogResponse
from app.services.transfer_service import TransferService
from app.security import decode_token, security_scheme

router = APIRouter(prefix="/transfers", tags=["Data Transfers"])


def _get_user_id(credentials: HTTPAuthorizationCredentials) -> UUID:
    payload = decode_token(credentials.credentials)
    return UUID(payload["sub"])


@router.post("", response_model=TransferResponse, status_code=201)
async def create_transfer(
    data: TransferCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Create and start a data transfer job.

    The transfer runs asynchronously via Celery workers.
    Returns the job details with a status of 'running'.
    Poll the GET endpoint for progress updates.
    """
    user_id = _get_user_id(credentials)
    service = TransferService(db)
    return await service.create_transfer(user_id, data)


@router.get("", response_model=list[TransferResponse])
async def list_transfers(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """List transfer jobs for the authenticated user."""
    user_id = _get_user_id(credentials)
    service = TransferService(db)
    return await service.list_transfers(user_id, status, limit, offset)


@router.get("/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed transfer job information including real-time progress.

    For running transfers, includes percentage complete, elapsed time,
    and estimated remaining time.
    """
    user_id = _get_user_id(credentials)
    service = TransferService(db)
    return await service.get_transfer(transfer_id, user_id)


@router.get("/{transfer_id}/logs", response_model=list[TransferLogResponse])
async def get_transfer_logs(
    transfer_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get execution logs for a transfer job.

    Returns chronologically ordered log entries with level (info/warning/error)
    and timestamps.
    """
    user_id = _get_user_id(credentials)
    service = TransferService(db)
    return await service.get_transfer_logs(transfer_id, user_id)


@router.post("/{transfer_id}/cancel", response_model=TransferResponse)
async def cancel_transfer(
    transfer_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a running or pending transfer job.

    Revokes the Celery task and updates the job status to 'cancelled'.
    """
    user_id = _get_user_id(credentials)
    service = TransferService(db)
    return await service.cancel_transfer(transfer_id, user_id)
