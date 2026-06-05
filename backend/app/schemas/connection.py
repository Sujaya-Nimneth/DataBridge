"""
Pydantic schemas for database connection management endpoints.
"""

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class ConnectionCreate(BaseModel):
    """Schema for creating a new database connection."""
    name: str = Field(..., min_length=1, max_length=255)
    db_type: str = Field(..., pattern="^(postgresql|mysql)$")
    host: str = Field(..., min_length=1)
    port: int = Field(..., ge=1, le=65535)
    database_name: str = Field(..., min_length=1, max_length=255)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    ssl_enabled: bool = False


class ConnectionUpdate(BaseModel):
    """Schema for updating an existing connection."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    host: Optional[str] = Field(None, min_length=1)
    port: Optional[int] = Field(None, ge=1, le=65535)
    database_name: Optional[str] = Field(None, min_length=1, max_length=255)
    username: Optional[str] = Field(None, min_length=1)
    password: Optional[str] = None
    ssl_enabled: Optional[bool] = None


class ConnectionResponse(BaseModel):
    """Schema for connection response (credentials hidden)."""
    id: UUID
    name: str
    db_type: str
    host: str
    port: int
    database_name: str
    username: str
    ssl_enabled: bool
    is_active: bool
    last_tested_at: Optional[datetime] = None
    last_test_status: str
    last_test_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTest(BaseModel):
    """Schema for connection test result."""
    success: bool
    message: str
    latency_ms: Optional[float] = None
