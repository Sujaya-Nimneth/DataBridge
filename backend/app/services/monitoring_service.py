"""
Monitoring service: aggregates platform metrics, connection health,
transfer history, and activity feeds.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import ConnectionStatus, TransferStatus
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob


class MonitoringService:
    """Aggregates platform-wide metrics and monitoring data."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard_stats(self, user_id: UUID) -> dict:
        """Get aggregated dashboard statistics for a user in a single query."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        transfer_row = (
            await self.db.execute(
                select(
                    func.count(TransferJob.id).label("total_transfers"),
                    func.count(
                        case(
                            (TransferJob.status == TransferStatus.RUNNING, 1),
                        )
                    ).label("running_transfers"),
                    func.count(
                        case(
                            (
                                and_(
                                    TransferJob.status == TransferStatus.COMPLETED,
                                    TransferJob.completed_at >= today_start,
                                ),
                                1,
                            )
                        )
                    ).label("completed_today"),
                    func.count(
                        case(
                            (
                                and_(
                                    TransferJob.status == TransferStatus.FAILED,
                                    TransferJob.completed_at >= today_start,
                                ),
                                1,
                            )
                        )
                    ).label("failed_today"),
                    func.count(
                        case(
                            (
                                TransferJob.status == TransferStatus.COMPLETED,
                                1,
                            )
                        )
                    ).label("completed_total"),
                    func.count(
                        case(
                            (
                                TransferJob.status == TransferStatus.FAILED,
                                1,
                            )
                        )
                    ).label("failed_total"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    TransferJob.status == TransferStatus.COMPLETED,
                                    TransferJob.transferred_rows,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("total_rows"),
                ).where(TransferJob.user_id == user_id)
            )
        ).one()

        connection_row = (
            await self.db.execute(
                select(
                    func.count(DatabaseConnection.id).label("total_connections"),
                    func.count(
                        case(
                            (
                                DatabaseConnection.last_test_status
                                == ConnectionStatus.SUCCESS,
                                1,
                            )
                        )
                    ).label("active_connections"),
                ).where(DatabaseConnection.user_id == user_id)
            )
        ).one()

        finished = transfer_row.completed_total + transfer_row.failed_total
        success_rate = (
            round((transfer_row.completed_total / finished) * 100, 1)
            if finished
            else 0.0
        )

        return {
            "total_connections": connection_row.total_connections or 0,
            "active_connections": connection_row.active_connections or 0,
            "total_transfers": transfer_row.total_transfers or 0,
            "running_transfers": transfer_row.running_transfers or 0,
            "completed_today": transfer_row.completed_today or 0,
            "failed_today": transfer_row.failed_today or 0,
            "total_rows_transferred": int(transfer_row.total_rows or 0),
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
                "last_tested_at": (
                    c.last_tested_at.isoformat() if c.last_tested_at else None
                ),
                "message": c.last_test_message,
            }
            for c in connections
        ]

    async def get_recent_activity(self, user_id: UUID, limit: int = 20) -> list[dict]:
        """Get recent activity feed combining transfers and logs."""
        source = DatabaseConnection.__table__.alias("source_conn")
        target = DatabaseConnection.__table__.alias("target_conn")

        result = await self.db.execute(
            select(
                TransferJob,
                source.c.name.label("source_name"),
                target.c.name.label("target_name"),
            )
            .outerjoin(source, source.c.id == TransferJob.source_connection_id)
            .outerjoin(target, target.c.id == TransferJob.target_connection_id)
            .where(TransferJob.user_id == user_id)
            .order_by(TransferJob.created_at.desc())
            .limit(limit)
        )

        return [
            {
                "id": str(job.id),
                "type": "transfer",
                "description": (
                    f"Transfer: {source_name or 'Unknown'}/{job.source_table} → "
                    f"{target_name or 'Unknown'}/{job.target_table}"
                ),
                "status": job.status.value,
                "rows": job.transferred_rows,
                "timestamp": job.created_at.isoformat(),
            }
            for job, source_name, target_name in result.all()
        ]

    async def get_metrics(self, user_id: UUID) -> dict:
        """Get operational metrics for the user with aggregate queries."""
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(days=6)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Transfers by status in one pass
        status_rows = (
            await self.db.execute(
                select(TransferJob.status, func.count(TransferJob.id))
                .where(TransferJob.user_id == user_id)
                .group_by(TransferJob.status)
            )
        ).all()
        counts_by_status = {status.value: count for status, count in status_rows}
        status_counts = {
            status.value: counts_by_status.get(status.value, 0)
            for status in TransferStatus
        }

        # Daily buckets for the last 7 days in one pass
        day = func.date_trunc("day", TransferJob.created_at)
        daily_rows = (
            await self.db.execute(
                select(day.label("day"), func.count(TransferJob.id))
                .where(
                    TransferJob.user_id == user_id,
                    TransferJob.created_at >= window_start,
                )
                .group_by(day)
                .order_by(day)
            )
        ).all()
        counts_by_day = {
            bucket.date().isoformat(): count for bucket, count in daily_rows
        }

        daily_transfers = []
        for offset in range(6, -1, -1):
            key = (window_start + timedelta(days=offset)).date().isoformat()
            daily_transfers.append({"date": key, "count": counts_by_day.get(key, 0)})

        # Average duration computed in the database
        avg_duration = (
            await self.db.execute(
                select(
                    func.avg(
                        func.extract(
                            "epoch", TransferJob.completed_at - TransferJob.started_at
                        )
                    )
                ).where(
                    TransferJob.user_id == user_id,
                    TransferJob.status == TransferStatus.COMPLETED,
                    TransferJob.started_at.isnot(None),
                    TransferJob.completed_at.isnot(None),
                )
            )
        ).scalar()

        return {
            "status_counts": status_counts,
            "daily_transfers": daily_transfers,
            "average_duration_seconds": (
                round(float(avg_duration), 1) if avg_duration is not None else None
            ),
        }
