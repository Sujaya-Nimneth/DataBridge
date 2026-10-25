"""
Pydantic schemas for data transfer endpoints.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TransferCreate(BaseModel):
    """Schema for creating a new transfer job."""

    source_connection_id: UUID
    source_schema: str | None = None
    source_table: str

    target_connection_id: UUID
    target_schema: str | None = None
    target_table: str

    column_mappings: dict | None = None
    filter_query: str | None = None
    create_target_table: bool = True


class TransferProgress(BaseModel):
    """Schema for transfer progress."""

    status: str
    total_rows: int | None = None
    transferred_rows: int = 0
    percentage: float = 0.0
    current_batch: int | None = None
    elapsed_seconds: float | None = None
    estimated_remaining_seconds: float | None = None


class TransferResponse(BaseModel):
    """Schema for transfer job response."""

    id: UUID
    user_id: UUID

    source_connection_id: UUID
    source_connection_name: str | None = None
    source_schema: str | None = None
    source_table: str

    target_connection_id: UUID
    target_connection_name: str | None = None
    target_schema: str | None = None
    target_table: str

    column_mappings: dict | None = None
    filter_query: str | None = None
    create_target_table: bool = True

    status: str
    total_rows: int | None = None
    transferred_rows: int = 0
    progress: TransferProgress | None = None

    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None

    created_at: datetime

    model_config = {"from_attributes": True}


class TransferLogResponse(BaseModel):
    """Schema for transfer log entry."""

    id: UUID
    level: str
    message: str
    timestamp: datetime

    model_config = {"from_attributes": True}
