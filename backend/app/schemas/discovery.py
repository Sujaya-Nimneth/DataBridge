"""
Pydantic schemas for data discovery endpoints.
"""

from typing import Optional, Any
from pydantic import BaseModel


class SchemaInfo(BaseModel):
    """Schema (namespace) information."""
    name: str
    table_count: int = 0


class ColumnInfo(BaseModel):
    """Column metadata information."""
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    max_length: Optional[int] = None
    comment: Optional[str] = None


class TableInfo(BaseModel):
    """Table metadata information."""
    name: str
    schema_name: Optional[str] = None
    type: str = "table"  # "table" or "view"
    row_count: Optional[int] = None
    columns: list[ColumnInfo] = []


class DataPreview(BaseModel):
    """Data preview response with pagination."""
    columns: list[str]
    column_types: list[str]
    rows: list[list[Any]]
    total_rows: int
    page: int
    page_size: int
    has_more: bool
