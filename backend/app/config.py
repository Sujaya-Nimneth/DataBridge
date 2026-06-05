"""
Application configuration using Pydantic BaseSettings.
Loads from environment variables and .env file.
"""

from pydantic_settings import BaseSettings
from typing import Optional


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
    SECRET_KEY: str = "your-secret-key-change-in-production-minimum-32-characters-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Encryption (Fernet key for encrypting stored credentials)
    ENCRYPTION_KEY: str = "your-fernet-key-change-in-production"

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


settings = Settings()
