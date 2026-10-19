"""
Transfer service: orchestrates data transfer operations between database connections.
Dispatches background tasks and tracks progress.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transfer import TransferJob, TransferLog
from app.enums import LogLevel, TransferStatus
from app.sql_utils import UnsafeFilterError, validate_filter_query
from app.models.connection import DatabaseConnection
from app.schemas.transfer import TransferCreate, TransferResponse, TransferLogResponse, TransferProgress
from app.services.connection_service import ConnectionService
from fastapi import HTTPException, status


class TransferService:
    """Manages data transfer job lifecycle, dispatching, and monitoring."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.conn_service = ConnectionService(db)

    async def create_transfer(
        self, user_id: UUID, data: TransferCreate
    ) -> TransferResponse:
        """Create and optionally start a transfer job."""
        # Validate source and target connections exist and belong to user
        try:
            filter_query = validate_filter_query(data.filter_query)
        except UnsafeFilterError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )

        source = await self.conn_service.get_connection_model(
            data.source_connection_id, user_id
        )
        target = await self.conn_service.get_connection_model(
            data.target_connection_id, user_id
        )

        # Create the transfer job
        job = TransferJob(
            user_id=user_id,
            source_connection_id=data.source_connection_id,
            source_schema=data.source_schema,
            source_table=data.source_table,
            target_connection_id=data.target_connection_id,
            target_schema=data.target_schema,
            target_table=data.target_table,
            column_mappings=data.column_mappings,
            filter_query=filter_query,
            create_target_table=data.create_target_table,
            status=TransferStatus.PENDING,
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)

        # Add initial log entry
        log = TransferLog(
            transfer_job_id=job.id,
            level=LogLevel.INFO,
            message=f"Transfer job created: {source.name} → {target.name}",
        )
        self.db.add(log)
        await self.db.flush()

        # Dispatch Celery task
        try:
            from app.workers.transfer_tasks import execute_transfer
            task = execute_transfer.delay(str(job.id))
            job.celery_task_id = task.id
            job.status = TransferStatus.RUNNING
            job.started_at = datetime.now(timezone.utc)
            await self.db.flush()
        except Exception as e:
            # If Celery is not available, mark as pending
            log = TransferLog(
                transfer_job_id=job.id,
                level=LogLevel.WARNING,
                message=f"Background worker unavailable, job queued: {str(e)[:200]}",
            )
            self.db.add(log)
            await self.db.flush()

        return await self._to_response(job)

    async def list_transfers(
        self,
        user_id: UUID,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TransferResponse]:
        """List transfer jobs for a user."""
        query = (
            select(TransferJob)
            .where(TransferJob.user_id == user_id)
            .order_by(TransferJob.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if status_filter:
            query = query.where(TransferJob.status == TransferStatus(status_filter))

        result = await self.db.execute(query)
        jobs = result.scalars().all()
        return [await self._to_response(j) for j in jobs]

    async def get_transfer(
        self, transfer_id: UUID, user_id: UUID
    ) -> TransferResponse:
        """Get detailed transfer job info including progress."""
        job = await self._get_job_or_404(transfer_id, user_id)
        return await self._to_response(job, include_progress=True)

    async def get_transfer_logs(
        self, transfer_id: UUID, user_id: UUID
    ) -> list[TransferLogResponse]:
        """Get execution logs for a transfer job."""
        # Verify ownership
        await self._get_job_or_404(transfer_id, user_id)

        result = await self.db.execute(
            select(TransferLog)
            .where(TransferLog.transfer_job_id == transfer_id)
            .order_by(TransferLog.timestamp.asc())
        )
        logs = result.scalars().all()
        return [TransferLogResponse.model_validate(l) for l in logs]

    async def cancel_transfer(
        self, transfer_id: UUID, user_id: UUID
    ) -> TransferResponse:
        """Cancel a running transfer job."""
        job = await self._get_job_or_404(transfer_id, user_id)

        if job.status not in (TransferStatus.PENDING, TransferStatus.RUNNING):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel transfer in '{job.status.value}' state",
            )

        # Revoke Celery task if running
        if job.celery_task_id:
            try:
                from app.workers.celery_app import celery_app
                celery_app.control.revoke(job.celery_task_id, terminate=True)
            except Exception:
                pass

        job.status = TransferStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)

        log = TransferLog(
            transfer_job_id=job.id,
            level=LogLevel.WARNING,
            message="Transfer cancelled by user",
        )
        self.db.add(log)
        await self.db.flush()

        return await self._to_response(job)

    async def _get_job_or_404(
        self, transfer_id: UUID, user_id: UUID
    ) -> TransferJob:
        """Get transfer job or raise 404."""
        result = await self.db.execute(
            select(TransferJob).where(
                TransferJob.id == transfer_id,
                TransferJob.user_id == user_id,
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer job not found",
            )
        return job

    async def _to_response(
        self, job: TransferJob, include_progress: bool = False
    ) -> TransferResponse:
        """Convert model to response with optional progress info."""
        # Get connection names
        source_name = None
        target_name = None
        try:
            result = await self.db.execute(
                select(DatabaseConnection).where(
                    DatabaseConnection.id == job.source_connection_id
                )
            )
            source = result.scalar_one_or_none()
            if source:
                source_name = source.name

            result = await self.db.execute(
                select(DatabaseConnection).where(
                    DatabaseConnection.id == job.target_connection_id
                )
            )
            target = result.scalar_one_or_none()
            if target:
                target_name = target.name
        except Exception:
            pass

        progress = None
        if include_progress and job.status == TransferStatus.RUNNING:
            percentage = 0.0
            if job.total_rows and job.total_rows > 0:
                percentage = (job.transferred_rows / job.total_rows) * 100

            elapsed = None
            estimated_remaining = None
            if job.started_at:
                elapsed = (datetime.now(timezone.utc) - job.started_at).total_seconds()
                if percentage > 0:
                    estimated_remaining = (elapsed / percentage) * (100 - percentage)

            progress = TransferProgress(
                status=job.status.value,
                total_rows=job.total_rows,
                transferred_rows=job.transferred_rows,
                percentage=round(percentage, 1),
                elapsed_seconds=round(elapsed, 1) if elapsed else None,
                estimated_remaining_seconds=round(estimated_remaining, 1) if estimated_remaining else None,
            )

        return TransferResponse(
            id=job.id,
            user_id=job.user_id,
            source_connection_id=job.source_connection_id,
            source_connection_name=source_name,
            source_schema=job.source_schema,
            source_table=job.source_table,
            target_connection_id=job.target_connection_id,
            target_connection_name=target_name,
            target_schema=job.target_schema,
            target_table=job.target_table,
            column_mappings=job.column_mappings,
            filter_query=job.filter_query,
            create_target_table=job.create_target_table,
            status=job.status.value,
            total_rows=job.total_rows,
            transferred_rows=job.transferred_rows,
            progress=progress,
            started_at=job.started_at,
            completed_at=job.completed_at,
            error_message=job.error_message,
            created_at=job.created_at,
        )
