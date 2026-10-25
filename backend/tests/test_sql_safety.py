"""SQL safety helpers and enum persistence."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql

from app.enums import (
    ConnectionStatus,
    DatabaseType,
    LogLevel,
    TransferStatus,
    UserRole,
    enum_column,
)
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob, TransferLog
from app.sql_utils import (
    UnsafeFilterError,
    qualify_table,
    quote_identifier,
    validate_filter_query,
)


@pytest.mark.parametrize(
    "fragment",
    [
        "status = 'active'",
        "created_at > '2024-01-01'",
        "amount >= 100 AND region <> 'EU'",
        "name IS NOT NULL",
    ],
)
def test_valid_filters_are_accepted(fragment):
    assert validate_filter_query(fragment) == fragment


@pytest.mark.parametrize(
    "fragment",
    [
        "1=1; DROP TABLE users",
        "id = 1 -- trailing comment",
        "id = 1 /* block */",
        "1=1 UNION SELECT password FROM users",
        "(SELECT password FROM users LIMIT 1) = 'x'",
        "1=1; DELETE FROM transfer_logs",
    ],
)
def test_dangerous_filters_are_rejected(fragment):
    with pytest.raises(UnsafeFilterError):
        validate_filter_query(fragment)


def test_empty_filter_is_normalised_to_none():
    assert validate_filter_query("   ") is None
    assert validate_filter_query(None) is None


def test_overlong_filter_is_rejected():
    with pytest.raises(UnsafeFilterError):
        validate_filter_query("a = 1 AND " * 500)


def test_identifiers_are_quoted_per_dialect():
    engine = create_engine("postgresql+psycopg2://u:p@localhost/db")
    assert quote_identifier(engine, 'weird"name') == '"weird""name"'
    assert qualify_table(engine, "public", "orders") == '"public"."orders"'
    assert qualify_table(engine, None, "orders") == '"orders"'
    engine.dispose()


@pytest.mark.parametrize(
    "enum_cls, expected",
    [
        (TransferStatus, ["pending", "running", "completed", "failed", "cancelled"]),
        (LogLevel, ["info", "warning", "error"]),
        (DatabaseType, ["postgresql", "mysql"]),
        (ConnectionStatus, ["success", "failed", "unknown"]),
        (UserRole, ["admin", "user"]),
    ],
)
def test_enum_column_persists_values(enum_cls, expected):
    column_type = enum_column(enum_cls, "test_enum")
    assert column_type.enums == expected


def test_models_use_lowercase_enum_labels():
    """
    Regression guard: SQLAlchemy persists member *names* unless
    values_callable is supplied, which broke every raw-SQL status update.
    """
    assert TransferJob.__table__.c.status.type.enums == [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
    ]
    assert TransferLog.__table__.c.level.type.enums == ["info", "warning", "error"]
    assert DatabaseConnection.__table__.c.db_type.type.enums == ["postgresql", "mysql"]


def test_postgres_ddl_uses_lowercase_labels():
    from sqlalchemy.schema import CreateTable

    ddl = str(CreateTable(TransferJob.__table__).compile(dialect=postgresql.dialect()))
    assert "transfer_status" in ddl
    # The label values live in the enum type, not the DDL text, so assert on
    # the type itself to keep the check meaningful.
    assert "RUNNING" not in TransferJob.__table__.c.status.type.enums
