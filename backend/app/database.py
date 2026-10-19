"""
Database engine and session management for the application database.
Uses async SQLAlchemy for non-blocking database operations.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


def _pool_kwargs(url: str) -> dict:
    """
    Pool tuning that the target dialect actually supports.

    SQLite uses NullPool and rejects pool_size/max_overflow, so passing them
    unconditionally breaks any non-PostgreSQL deployment (including tests).
    """
    if url.startswith("sqlite"):
        return {}
    return {
        "pool_size": settings.POOL_SIZE,
        "max_overflow": settings.MAX_OVERFLOW,
        "pool_timeout": settings.POOL_TIMEOUT,
        "pool_pre_ping": True,
    }


# Create async engine for the application database
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    **_pool_kwargs(settings.DATABASE_URL),
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """
    Dependency that provides a database session per request.
    Automatically closes the session when the request completes.
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Create tables when migrations have not been run.

    Production deployments must use ``alembic upgrade head``; this fallback only
    exists so a fresh development checkout can boot without extra steps.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose of the engine connection pool."""
    await engine.dispose()
