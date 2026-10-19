"""
Database connection model for storing user-configured database connections.
Credentials are encrypted at rest using Fernet symmetric encryption.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import ConnectionStatus, DatabaseType, enum_column


class DatabaseConnection(Base):
    """
    Stores user-configured database connections.
    Sensitive fields (host, username, password) are encrypted before storage.
    """

    __tablename__ = "database_connections"
    __table_args__ = (Index("ix_database_connections_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    db_type: Mapped[DatabaseType] = mapped_column(
        enum_column(DatabaseType, "database_type"), nullable=False
    )
    host: Mapped[str] = mapped_column(Text, nullable=False)  # Encrypted
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(Text, nullable=False)  # Encrypted
    password: Mapped[str] = mapped_column(Text, nullable=False)  # Encrypted
    ssl_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Connection test tracking
    last_tested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_test_status: Mapped[ConnectionStatus] = mapped_column(
        enum_column(ConnectionStatus, "connection_status"),
        default=ConnectionStatus.UNKNOWN,
    )
    last_test_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user = relationship("User", back_populates="connections")
    source_transfers = relationship(
        "TransferJob",
        back_populates="source_connection",
        foreign_keys="TransferJob.source_connection_id",
    )
    target_transfers = relationship(
        "TransferJob",
        back_populates="target_connection",
        foreign_keys="TransferJob.target_connection_id",
    )

    def __repr__(self) -> str:
        return f"<DatabaseConnection {self.name} ({self.db_type.value})>"
