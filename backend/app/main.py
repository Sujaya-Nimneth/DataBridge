"""
DataBridge - Data Connectivity & Transfer Platform
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.middleware.error_handler import register_error_handlers
from app.api import auth, connections, discovery, transfers, monitoring

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
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
    """Detailed health check."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
    }
