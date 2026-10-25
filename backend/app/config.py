"""
Application configuration using Pydantic BaseSettings.
Loads from environment variables and .env file.
"""

from cryptography.fernet import Fernet, InvalidToken
from pydantic import model_validator
from pydantic_settings import BaseSettings

DEFAULT_SECRET_KEY = "your-secret-key-change-in-production-minimum-32-characters-long"
# A syntactically valid Fernet key so dev bootstrapping works out of the box;
# production rejects this exact value (and any weak look-alike) below.
DEFAULT_ENCRYPTION_KEY = "RGF0YUJyaWRnZS1leGFtcGxlLWtleS1kb250LXVzZSE="

_WEAK_SECRET_MARKERS = ("change-this", "your-", "example", "placeholder", "$(")


def _is_weak_secret(value: str) -> bool:
    """Detect placeholder-ish secrets: known defaults, template markers or shell leftovers."""
    lowered = value.lower()
    return (
        value in {DEFAULT_SECRET_KEY, DEFAULT_ENCRYPTION_KEY}
        or any(marker in lowered for marker in _WEAK_SECRET_MARKERS)
        or "$(" in value
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "DataBridge"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # Database (Application's own PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://databridge:databridge@localhost:5432/databridge"
    DATABASE_SYNC_URL: str = "postgresql+psycopg2://databridge:databridge@localhost:5432/databridge"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Authentication
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Encryption (Fernet key for encrypting stored credentials)
    ENCRYPTION_KEY: str = DEFAULT_ENCRYPTION_KEY

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Transfer Settings
    TRANSFER_BATCH_SIZE: int = 1000
    TRANSFER_MAX_PREVIEW_ROWS: int = 100

    # Connection Pool
    POOL_SIZE: int = 5
    MAX_OVERFLOW: int = 10
    POOL_TIMEOUT: int = 30

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        """
        Guard against misconfigured secrets at boot.

        ENCRYPTION_KEY must always be a real Fernet key — a silently derived
        key would make stored credentials permanently undecryptable after any
        config change. Outside debug mode, placeholder-ish or too-short
        secrets are rejected outright.
        """
        try:
            Fernet(self.ENCRYPTION_KEY.encode())
        except (InvalidToken, ValueError, TypeError) as exc:
            raise ValueError(
                "ENCRYPTION_KEY is not a valid Fernet key. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            ) from exc

        if self.DEBUG:
            return self

        if _is_weak_secret(self.SECRET_KEY):
            raise ValueError(
                "Refusing to start with a placeholder SECRET_KEY. "
                "Set SECRET_KEY in your environment to a strong random value."
            )
        if len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if _is_weak_secret(self.ENCRYPTION_KEY):
            raise ValueError(
                "Refusing to start with a placeholder ENCRYPTION_KEY. "
                "Set ENCRYPTION_KEY in your environment to a generated Fernet key."
            )
        return self


settings = Settings()
