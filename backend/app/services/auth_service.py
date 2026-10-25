"""
Authentication service: user registration, login, and token management.

Refresh tokens are rotated on every use and tracked server-side by their
``jti``: presenting an already-rotated token is treated as theft and revokes
every session for that user.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserResponse
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; normalise before comparing."""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


class AuthService:
    """Handles user authentication and registration."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: UserCreate) -> TokenResponse:
        """Register a new user and return tokens."""
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
        )
        self.db.add(user)
        await self.db.flush()

        return await self._issue_tokens(user)

    async def login(self, data: UserLogin) -> TokenResponse:
        """Authenticate user and return tokens."""
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        return await self._issue_tokens(user)

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Issue new tokens using a valid refresh token, rotating it."""
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        jti = payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is not revocable; log in again",
            )

        record = (
            await self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        ).scalar_one_or_none()

        if record is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not recognised",
            )

        if record.revoked_at is not None:
            # Reuse of a rotated token: assume compromise, kill every session.
            # Commit explicitly: the 401 below must not roll back the revocation.
            await self._revoke_all(record.user_id)
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token already used; all sessions revoked",
            )

        if _aware(record.expires_at) <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired",
            )

        user_id = payload.get("sub")
        result = await self.db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        # Rotate: the presented token can never be used again.
        record.revoked_at = datetime.now(UTC)
        await self._purge_expired()

        return await self._issue_tokens(user)

    async def logout(self, user_id: UUID) -> dict:
        """Revoke every refresh token for the user."""
        await self._revoke_all(user_id)
        return {"message": "Logged out successfully"}

    async def _issue_tokens(self, user: User) -> TokenResponse:
        """Create an access/refresh pair and persist the refresh token."""
        token_data = {"sub": str(user.id)}
        access = create_access_token(token_data)
        refresh = create_refresh_token(token_data)
        refresh_payload = decode_token(refresh)

        self.db.add(
            RefreshToken(
                jti=refresh_payload["jti"],
                user_id=user.id,
                expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=UTC),
            )
        )
        await self.db.flush()

        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            user=UserResponse.model_validate(user),
        )

    async def _revoke_all(self, user_id: UUID) -> None:
        """Revoke all outstanding refresh tokens for a user."""
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        now = datetime.now(UTC)
        for record in result.scalars():
            record.revoked_at = now
        await self.db.flush()

    async def _purge_expired(self) -> None:
        """Delete expired refresh tokens so the table does not grow forever."""
        await self.db.execute(
            delete(RefreshToken)
            .where(RefreshToken.expires_at <= datetime.now(UTC))
            .execution_options(synchronize_session=False)
        )
