"""
Data transfer API routes.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.transfer import TransferCreate, TransferLogResponse, TransferResponse
from app.security import get_current_user
from app.services.transfer_service import TransferService

router = APIRouter(prefix="/transfers", tags=["Data Transfers"])


@router.post("", response_model=TransferResponse, status_code=201)
async def create_transfer(
    data: TransferCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create and start a data transfer job.

    The transfer runs asynchronously via Celery workers.
    Returns the job details with a status of 'running'.
    Poll the GET endpoint for progress updates.
    """
    service = TransferService(db)
    return await service.create_transfer(current_user.id, data)


@router.get("", response_model=list[TransferResponse])
async def list_transfers(
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List transfer jobs for the authenticated user."""
    service = TransferService(db)
    return await service.list_transfers(current_user.id, status, limit, offset)


@router.get("/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed transfer job information including real-time progress.

    For running transfers, includes percentage complete, elapsed time,
    and estimated remaining time.
    """
    service = TransferService(db)
    return await service.get_transfer(transfer_id, current_user.id)


@router.get("/{transfer_id}/logs", response_model=list[TransferLogResponse])
async def get_transfer_logs(
    transfer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get execution logs for a transfer job.

    Returns chronologically ordered log entries with level (info/warning/error)
    and timestamps.
    """
    service = TransferService(db)
    return await service.get_transfer_logs(transfer_id, current_user.id)


@router.post("/{transfer_id}/cancel", response_model=TransferResponse)
async def cancel_transfer(
    transfer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a running or pending transfer job.

    Revokes the Celery task and updates the job status to 'cancelled'.
    """
    service = TransferService(db)
    return await service.cancel_transfer(transfer_id, current_user.id)
