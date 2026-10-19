"""
Transfer job and transfer log models for tracking data movement operations.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import LogLevel, TransferStatus, enum_column


class TransferJob(Base):
    """
    Represents a data transfer operation between two database connections.
    Tracks progress, status, and execution metadata.
    """

    __tablename__ = "transfer_jobs"
    __table_args__ = (
        Index("ix_transfer_jobs_user_created", "user_id", "created_at"),
        Index("ix_transfer_jobs_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Source
    source_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("database_connections.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_schema: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_table: Mapped[str] = mapped_column(String(255), nullable=False)

    # Target
    target_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("database_connections.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_schema: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_table: Mapped[str] = mapped_column(String(255), nullable=False)

    # Configuration
    column_mappings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    filter_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    create_target_table: Mapped[bool] = mapped_column(default=True)

    # Execution status
    status: Mapped[TransferStatus] = mapped_column(
        enum_column(TransferStatus, "transfer_status"),
        default=TransferStatus.PENDING,
    )
    total_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transferred_rows: Mapped[int] = mapped_column(Integer, default=0)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Celery task reference
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    user = relationship("User", back_populates="transfers")
    source_connection = relationship(
        "DatabaseConnection",
        back_populates="source_transfers",
        foreign_keys=[source_connection_id],
    )
    target_connection = relationship(
        "DatabaseConnection",
        back_populates="target_transfers",
        foreign_keys=[target_connection_id],
    )
    logs = relationship(
        "TransferLog", back_populates="transfer_job", cascade="all, delete-orphan",
        order_by="TransferLog.timestamp"
    )

    def __repr__(self) -> str:
        return f"<TransferJob {self.id} ({self.status.value})>"


class TransferLog(Base):
    """
    Detailed execution log entries for a transfer job.
    Provides granular visibility into transfer progress and issues.
    """

    __tablename__ = "transfer_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transfer_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    level: Mapped[LogLevel] = mapped_column(
        enum_column(LogLevel, "log_level"), default=LogLevel.INFO
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    transfer_job = relationship("TransferJob", back_populates="logs")

    def __repr__(self) -> str:
        return f"<TransferLog {self.level.value}: {self.message[:50]}>"
