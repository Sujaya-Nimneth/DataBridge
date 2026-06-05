"""
Pydantic schemas for data transfer endpoints.
"""

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    """Schema for creating a new transfer job."""
    source_connection_id: UUID
    source_schema: Optional[str] = None
    source_table: str

    target_connection_id: UUID
    target_schema: Optional[str] = None
    target_table: str

    column_mappings: Optional[dict] = None
    filter_query: Optional[str] = None
    create_target_table: bool = True


class TransferProgress(BaseModel):
    """Schema for transfer progress."""
    status: str
    total_rows: Optional[int] = None
    transferred_rows: int = 0
    percentage: float = 0.0
    current_batch: Optional[int] = None
    elapsed_seconds: Optional[float] = None
    estimated_remaining_seconds: Optional[float] = None


class TransferResponse(BaseModel):
    """Schema for transfer job response."""
    id: UUID
    user_id: UUID

    source_connection_id: UUID
    source_connection_name: Optional[str] = None
    source_schema: Optional[str] = None
    source_table: str

    target_connection_id: UUID
    target_connection_name: Optional[str] = None
    target_schema: Optional[str] = None
    target_table: str

    column_mappings: Optional[dict] = None
    filter_query: Optional[str] = None
    create_target_table: bool = True

    status: str
    total_rows: Optional[int] = None
    transferred_rows: int = 0
    progress: Optional[TransferProgress] = None

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    created_at: datetime

    model_config = {"from_attributes": True}


class TransferLogResponse(BaseModel):
    """Schema for transfer log entry."""
    id: UUID
    level: str
    message: str
    timestamp: datetime

    model_config = {"from_attributes": True}
