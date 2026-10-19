"""
Application configuration using Pydantic BaseSettings.
Loads from environment variables and .env file.
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings

DEFAULT_SECRET_KEY = "your-secret-key-change-in-production-minimum-32-characters-long"
DEFAULT_ENCRYPTION_KEY = "your-fernet-key-change-in-production"


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
    def reject_placeholder_secrets(self) -> "Settings":
        """
        Refuse to boot outside debug mode with the documented placeholder secrets.

        Running production on defaults is how a mistyped encryption key silently
        makes every stored credential permanently undecryptable.
        """
        if self.DEBUG:
            return self

        placeholders = {DEFAULT_SECRET_KEY, DEFAULT_ENCRYPTION_KEY}
        if self.SECRET_KEY in placeholders or self.ENCRYPTION_KEY in placeholders:
            raise ValueError(
                "Refusing to start with the default secret. "
                "Set SECRET_KEY and ENCRYPTION_KEY in your environment."
            )
        return self


settings = Settings()
