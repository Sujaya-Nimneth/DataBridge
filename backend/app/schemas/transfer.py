"""
Pydantic schemas for data transfer endpoints.
"""

import re
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel

_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


def _require_identifier(value: str) -> str:
    """Reject anything that is not a plain, quotable SQL identifier."""
    if not _IDENTIFIER_PATTERN.match(value):
        raise ValueError(
            f"identifiers must match [A-Za-z_][A-Za-z0-9_]* (max 64 chars); got {value!r}"
        )
    return value


Identifier = Annotated[str, AfterValidator(_require_identifier)]


class TransferCreate(BaseModel):
    """Schema for creating a new transfer job."""

    source_connection_id: UUID
    source_schema: Identifier | None = None
    source_table: Identifier

    target_connection_id: UUID
    target_schema: Identifier | None = None
    target_table: Identifier

    column_mappings: dict[Identifier, Identifier] | None = None
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
