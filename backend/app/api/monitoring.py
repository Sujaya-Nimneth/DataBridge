"""
Monitoring and metrics API routes.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.monitoring_service import MonitoringService
from app.security import decode_token, security_scheme

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


def _get_user_id(credentials: HTTPAuthorizationCredentials) -> UUID:
    payload = decode_token(credentials.credentials)
    return UUID(payload["sub"])


@router.get("/dashboard")
async def get_dashboard(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated dashboard statistics.

    Returns total connections, active connections, transfer counts,
    success rate, rows transferred, and more.
    """
    user_id = _get_user_id(credentials)
    service = MonitoringService(db)
    return await service.get_dashboard_stats(user_id)


@router.get("/connections/status")
async def get_connection_statuses(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get health status of all database connections."""
    user_id = _get_user_id(credentials)
    service = MonitoringService(db)
    return await service.get_connection_statuses(user_id)


@router.get("/activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent activity feed.

    Returns transfer events and status changes ordered by most recent.
    """
    user_id = _get_user_id(credentials)
    service = MonitoringService(db)
    return await service.get_recent_activity(user_id, limit)


@router.get("/metrics")
async def get_metrics(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Get operational metrics.

    Returns transfer status distribution, daily transfer counts (7 days),
    and average transfer duration.
    """
    user_id = _get_user_id(credentials)
    service = MonitoringService(db)
    return await service.get_metrics(user_id)
