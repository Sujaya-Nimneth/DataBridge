"""
Monitoring service: aggregates platform metrics, connection health,
transfer history, and activity feeds.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob, TransferLog
from app.enums import ConnectionStatus, TransferStatus


class MonitoringService:
    """Aggregates platform-wide metrics and monitoring data."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard_stats(self, user_id: UUID) -> dict:
        """Get aggregated dashboard statistics for a user."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Total connections
        conn_count = await self.db.execute(
            select(func.count(DatabaseConnection.id)).where(
                DatabaseConnection.user_id == user_id
            )
        )
        total_connections = conn_count.scalar() or 0

        # Active (healthy) connections
        active_conns = await self.db.execute(
            select(func.count(DatabaseConnection.id)).where(
                DatabaseConnection.user_id == user_id,
                DatabaseConnection.last_test_status == ConnectionStatus.SUCCESS,
            )
        )
        active_connections = active_conns.scalar() or 0

        # Total transfers
        total_transfers_q = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                TransferJob.user_id == user_id
            )
        )
        total_transfers = total_transfers_q.scalar() or 0

        # Active (running) transfers
        running_transfers_q = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                TransferJob.user_id == user_id,
                TransferJob.status == TransferStatus.RUNNING,
            )
        )
        running_transfers = running_transfers_q.scalar() or 0

        # Completed today
        completed_today_q = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                TransferJob.user_id == user_id,
                TransferJob.status == TransferStatus.COMPLETED,
                TransferJob.completed_at >= today_start,
            )
        )
        completed_today = completed_today_q.scalar() or 0

        # Failed today
        failed_today_q = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                TransferJob.user_id == user_id,
                TransferJob.status == TransferStatus.FAILED,
                TransferJob.completed_at >= today_start,
            )
        )
        failed_today = failed_today_q.scalar() or 0

        # Total rows transferred
        total_rows_q = await self.db.execute(
            select(func.sum(TransferJob.transferred_rows)).where(
                TransferJob.user_id == user_id,
                TransferJob.status == TransferStatus.COMPLETED,
            )
        )
        total_rows_transferred = total_rows_q.scalar() or 0

        # Success rate
        completed_q = await self.db.execute(
            select(func.count(TransferJob.id)).where(
                TransferJob.user_id == user_id,
                TransferJob.status.in_([TransferStatus.COMPLETED, TransferStatus.FAILED]),
            )
        )
        total_finished = completed_q.scalar() or 0

        success_rate = 0.0
        if total_finished > 0:
            success_q = await self.db.execute(
                select(func.count(TransferJob.id)).where(
                    TransferJob.user_id == user_id,
                    TransferJob.status == TransferStatus.COMPLETED,
                )
            )
            success_count = success_q.scalar() or 0
            success_rate = round((success_count / total_finished) * 100, 1)

        return {
            "total_connections": total_connections,
            "active_connections": active_connections,
            "total_transfers": total_transfers,
            "running_transfers": running_transfers,
            "completed_today": completed_today,
            "failed_today": failed_today,
            "total_rows_transferred": total_rows_transferred,
            "success_rate": success_rate,
        }

    async def get_connection_statuses(self, user_id: UUID) -> list[dict]:
        """Get status overview of all connections."""
        result = await self.db.execute(
            select(DatabaseConnection)
            .where(DatabaseConnection.user_id == user_id)
            .order_by(DatabaseConnection.name)
        )
        connections = result.scalars().all()

        return [
            {
                "id": str(c.id),
                "name": c.name,
                "db_type": c.db_type.value,
                "status": c.last_test_status.value,
                "last_tested_at": c.last_tested_at.isoformat() if c.last_tested_at else None,
                "message": c.last_test_message,
            }
            for c in connections
        ]

    async def get_recent_activity(self, user_id: UUID, limit: int = 20) -> list[dict]:
        """Get recent activity feed combining transfers and logs."""
        # Get recent transfer jobs
        result = await self.db.execute(
            select(TransferJob)
            .where(TransferJob.user_id == user_id)
            .order_by(TransferJob.created_at.desc())
            .limit(limit)
        )
        jobs = result.scalars().all()

        activities = []
        for job in jobs:
            # Get source/target names
            source_result = await self.db.execute(
                select(DatabaseConnection.name).where(
                    DatabaseConnection.id == job.source_connection_id
                )
            )
            target_result = await self.db.execute(
                select(DatabaseConnection.name).where(
                    DatabaseConnection.id == job.target_connection_id
                )
            )
            source_name = source_result.scalar() or "Unknown"
            target_name = target_result.scalar() or "Unknown"

            activities.append({
                "id": str(job.id),
                "type": "transfer",
                "description": f"Transfer: {source_name}/{job.source_table} → {target_name}/{job.target_table}",
                "status": job.status.value,
                "rows": job.transferred_rows,
                "timestamp": job.created_at.isoformat(),
            })

        return activities

    async def get_metrics(self, user_id: UUID) -> dict:
        """Get operational metrics for the user."""
        now = datetime.now(timezone.utc)

        # Transfers by status
        status_counts = {}
        for s in TransferStatus:
            result = await self.db.execute(
                select(func.count(TransferJob.id)).where(
                    TransferJob.user_id == user_id,
                    TransferJob.status == s,
                )
            )
            status_counts[s.value] = result.scalar() or 0

        # Transfers over last 7 days
        daily_transfers = []
        for i in range(7):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)

            result = await self.db.execute(
                select(func.count(TransferJob.id)).where(
                    TransferJob.user_id == user_id,
                    TransferJob.created_at >= day_start,
                    TransferJob.created_at < day_end,
                )
            )
            daily_transfers.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "count": result.scalar() or 0,
            })

        daily_transfers.reverse()

        # Average transfer duration (completed jobs)
        avg_duration = None
        result = await self.db.execute(
            select(TransferJob).where(
                TransferJob.user_id == user_id,
                TransferJob.status == TransferStatus.COMPLETED,
                TransferJob.started_at.isnot(None),
                TransferJob.completed_at.isnot(None),
            ).limit(100)
        )
        completed_jobs = result.scalars().all()
        if completed_jobs:
            durations = [
                (j.completed_at - j.started_at).total_seconds()
                for j in completed_jobs
            ]
            avg_duration = round(sum(durations) / len(durations), 1)

        return {
            "status_counts": status_counts,
            "daily_transfers": daily_transfers,
            "average_duration_seconds": avg_duration,
        }
