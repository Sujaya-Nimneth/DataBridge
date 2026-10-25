"""
Admin-only API routes.

The ADMIN role existed as stored data with no enforcement anywhere; these
endpoints give it a real (minimal) surface: platform-wide user visibility.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import UserRole
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob
from app.models.user import User
from app.security import get_current_user

router = APIRouter(prefix="/admin", tags=["Administration"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that rejects non-admin callers with 403."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )
    return current_user


class AdminUserSummary(BaseModel):
    """Platform-wide user view for administrators."""

    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    connection_count: int
    transfer_count: int


@router.get("/users", response_model=list[AdminUserSummary])
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all platform users with their connection and transfer counts."""
    users = (await db.execute(select(User).order_by(User.created_at.asc()))).scalars().all()

    connection_counts: dict[UUID, int] = {
        row[0]: row[1]
        for row in (
            await db.execute(
                select(DatabaseConnection.user_id, func.count(DatabaseConnection.id)).group_by(
                    DatabaseConnection.user_id
                )
            )
        ).all()
    }
    transfer_counts: dict[UUID, int] = {
        row[0]: row[1]
        for row in (
            await db.execute(
                select(TransferJob.user_id, func.count(TransferJob.id)).group_by(
                    TransferJob.user_id
                )
            )
        ).all()
    }

    return [
        AdminUserSummary(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
            connection_count=connection_counts.get(user.id, 0),
            transfer_count=transfer_counts.get(user.id, 0),
        )
        for user in users
    ]
