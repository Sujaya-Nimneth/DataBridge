"""
Monitoring and metrics API routes.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.security import get_current_user
from app.services.monitoring_service import MonitoringService

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated dashboard statistics.

    Returns total connections, active connections, transfer counts,
    success rate, rows transferred, and more.
    """
    service = MonitoringService(db)
    return await service.get_dashboard_stats(current_user.id)


@router.get("/connections/status")
async def get_connection_statuses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get health status of all database connections."""
    service = MonitoringService(db)
    return await service.get_connection_statuses(current_user.id)


@router.get("/activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent activity feed.

    Returns transfer events and status changes ordered by most recent.
    """
    service = MonitoringService(db)
    return await service.get_recent_activity(current_user.id, limit)


@router.get("/metrics")
async def get_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get operational metrics.

    Returns transfer status distribution, daily transfer counts (7 days),
    and average transfer duration.
    """
    service = MonitoringService(db)
    return await service.get_metrics(current_user.id)
