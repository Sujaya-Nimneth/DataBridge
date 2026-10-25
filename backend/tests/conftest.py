"""
Shared pytest fixtures.

Tests run against an in-memory SQLite database so the suite needs no external
services. PostgreSQL-specific behaviour is covered by compiling statements for
the Postgres dialect rather than executing them.
"""

import os

# Settings are validated at import time; provide non-placeholder secrets.
# The ENCRYPTION_KEY must be a valid Fernet key (invalid keys fail fast).
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-1234")
os.environ.setdefault(
    "ENCRYPTION_KEY",
    "cdLz4uF5bVNrMnOWBT4wJpZhGcS6vqkXyR8EaTfDgUh=",  # test-only Fernet key
)
os.environ.setdefault("DEBUG", "true")

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(session_factory):
    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register a user and return bearer headers for it."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "tester@example.com",
            "password": "supersecret123",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
