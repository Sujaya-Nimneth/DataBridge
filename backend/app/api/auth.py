"""
Authentication API routes.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import TokenRefresh, TokenResponse, UserCreate, UserLogin, UserResponse
from app.security import get_current_user
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.

    Returns JWT access and refresh tokens along with user profile.
    """
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email and password.

    Returns JWT access and refresh tokens along with user profile.
    """
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    """
    Refresh an expired access token using a valid refresh token.

    The presented refresh token is rotated: it cannot be used again.
    """
    service = AuthService(db)
    return await service.refresh_token(data.refresh_token)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all refresh tokens for the authenticated user."""
    service = AuthService(db)
    return await service.logout(current_user.id)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
