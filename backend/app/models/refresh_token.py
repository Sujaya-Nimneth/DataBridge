"""
Refresh token records enabling rotation, revocation and reuse detection.

Each issued refresh JWT carries a ``jti`` that is persisted here. A token is
valid only while its row exists, is unrevoked and unexpired — which makes
logout and theft response possible despite stateless access tokens.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RefreshToken(Base):
    """A single issued refresh token."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RefreshToken {self.jti} user={self.user_id}>"
