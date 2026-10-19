"""
Shared enumerations and the SQLAlchemy enum factory.

All enums are declared ``str`` enums and persisted using their *values*
(lowercase) rather than their member names.  This keeps Python call sites,
raw SQL written by workers, and the database itself in agreement.
"""

import enum

from sqlalchemy import Enum as SAEnum


class DatabaseType(str, enum.Enum):
    """Supported database engines."""

    POSTGRESQL = "postgresql"
    MYSQL = "mysql"


class ConnectionStatus(str, enum.Enum):
    """Result of the most recent connectivity test."""

    SUCCESS = "success"
    FAILED = "failed"
    UNKNOWN = "unknown"


class TransferStatus(str, enum.Enum):
    """Lifecycle state of a transfer job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LogLevel(str, enum.Enum):
    """Severity of a transfer log entry."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class UserRole(str, enum.Enum):
    """Authorization role attached to a user account."""

    ADMIN = "admin"
    USER = "user"


def enum_column(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """
    Build a SQLAlchemy ``Enum`` type that stores member *values*.

    Without ``values_callable`` SQLAlchemy persists member *names* (``RUNNING``),
    which silently breaks any raw SQL that compares against ``'running'``.
    """
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )
