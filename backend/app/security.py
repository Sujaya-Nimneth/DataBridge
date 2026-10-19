"""
Security utilities: JWT token management, password hashing, and Fernet encryption
for protecting stored database credentials.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from cryptography.fernet import Fernet
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db

# --- Password Hashing ---

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    plain_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)


# --- JWT Token Management ---

security_scheme = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with longer expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve the authenticated, active user from a bearer access token.

    This is the single source of truth for authentication: it rejects refresh
    tokens, malformed subjects and deactivated accounts before any handler runs.
    """
    from app.models.user import User

    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_id = UUID(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


# --- Fernet Encryption for Database Credentials ---

def _get_fernet() -> Fernet:
    """Get Fernet instance. Generates a valid key from settings if needed."""
    key = settings.ENCRYPTION_KEY
    # If the key is not a valid Fernet key, derive one
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # Derive a valid Fernet key from the provided string
        import base64
        import hashlib
        derived = hashlib.sha256(key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(derived)
        return Fernet(fernet_key)


def encrypt_value(value: str) -> str:
    """Encrypt a string value using Fernet symmetric encryption."""
    if not value:
        return value
    f = _get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a Fernet-encrypted string."""
    if not encrypted_value:
        return encrypted_value
    f = _get_fernet()
    return f.decrypt(encrypted_value.encode()).decode()
