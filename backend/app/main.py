"""
DataBridge - Data Connectivity & Transfer Platform
Main FastAPI application entry point.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.responses import JSONResponse

from app.api import auth, connections, discovery, monitoring, transfers
from app.config import settings
from app.database import close_db, engine, init_db
from app.middleware.error_handler import register_error_handlers
from app.middleware.request_context import RequestContextMiddleware, configure_logging
from app.rate_limit import limiter

# Configure logging: readable text in debug, structured JSON in production.
configure_logging(settings.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    if settings.DEBUG:
        await init_db()
        logger.info("Database tables initialized")
    yield
    await close_db()
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="""
## DataBridge

A web application for connecting to multiple database systems, exploring data structures,
and transferring data between sources.

### Features
- 🔐 **Secure Authentication** - JWT-based access with encrypted credential storage
- 🔌 **Connection Management** - PostgreSQL & MySQL with encrypted credentials
- 🔍 **Data Discovery** - Explore schemas, tables, columns, and preview data
- 🔄 **Data Transfer** - Move data between databases with progress tracking
- 📊 **Monitoring** - Dashboard stats, activity feed, and operational metrics

### Authentication
All endpoints except `/api/auth/register` and `/api/auth/login` require a Bearer token.
Include the JWT access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request IDs on every request/response pair
app.add_middleware(RequestContextMiddleware)

# Rate limiting for abuse-prone endpoints (see app.rate_limit)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request, exc):
    """Keep the rate-limit response in the common error envelope."""
    return JSONResponse(
        status_code=429,
        content={
            "error": True,
            "status_code": 429,
            "message": "Too many requests. Please try again later.",
        },
    )


# Register error handlers
register_error_handlers(app)

# Register API routes
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(connections.router, prefix=settings.API_PREFIX)
app.include_router(discovery.router, prefix=settings.API_PREFIX)
app.include_router(transfers.router, prefix=settings.API_PREFIX)
app.include_router(monitoring.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Liveness + readiness probe.

    Actually checks the application database and Redis so an orchestrator
    stops routing traffic to a node whose dependencies are down, rather
    than trusting a static "healthy" string.
    """
    checks: dict[str, str] = {}

    try:
        async with asyncio.timeout(3):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        checks["database"] = "up"
    except Exception as exc:
        logger.warning("Health check: database unreachable: %s", exc)
        checks["database"] = "down"

    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, socket_timeout=3)
        try:
            async with asyncio.timeout(3):
                await client.ping()
            checks["redis"] = "up"
        finally:
            await client.aclose()
    except Exception as exc:
        logger.warning("Health check: redis unreachable: %s", exc)
        checks["redis"] = "down"

    healthy = all(value == "up" for value in checks.values())
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "version": settings.APP_VERSION,
            "checks": checks,
        },
    )
