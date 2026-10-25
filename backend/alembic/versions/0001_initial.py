"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The types are created up front (checkfirst) and only *referenced* by the
# tables below: with the default create_type=True each create_table would
# emit CREATE TYPE again and fail with DuplicateObject on PostgreSQL.
user_role = postgresql.ENUM("admin", "user", name="user_role", create_type=False)
database_type = postgresql.ENUM("postgresql", "mysql", name="database_type", create_type=False)
connection_status = postgresql.ENUM(
    "success", "failed", "unknown", name="connection_status", create_type=False
)
transfer_status = postgresql.ENUM(
    "pending", "running", "completed", "failed", "cancelled",
    name="transfer_status", create_type=False,
)
log_level = postgresql.ENUM("info", "warning", "error", name="log_level", create_type=False)

# Instances that actually create the types (used by the loop below).
_user_role_ddl = sa.Enum("admin", "user", name="user_role")
_database_type_ddl = sa.Enum("postgresql", "mysql", name="database_type")
_connection_status_ddl = sa.Enum("success", "failed", "unknown", name="connection_status")
_transfer_status_ddl = sa.Enum(
    "pending", "running", "completed", "failed", "cancelled", name="transfer_status"
)
_log_level_ddl = sa.Enum("info", "warning", "error", name="log_level")


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (
        _user_role_ddl,
        _database_type_ddl,
        _connection_status_ddl,
        _transfer_status_ddl,
        _log_level_ddl,
    ):
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "database_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("db_type", database_type, nullable=False),
        sa.Column("host", sa.Text(), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("database_name", sa.String(length=255), nullable=False),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("password", sa.Text(), nullable=False),
        sa.Column("ssl_enabled", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_status", connection_status, nullable=False),
        sa.Column("last_test_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_database_connections_user_id", "database_connections", ["user_id"]
    )

    op.create_table(
        "transfer_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("database_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_schema", sa.String(length=255), nullable=True),
        sa.Column("source_table", sa.String(length=255), nullable=False),
        sa.Column(
            "target_connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("database_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_schema", sa.String(length=255), nullable=True),
        sa.Column("target_table", sa.String(length=255), nullable=False),
        sa.Column("column_mappings", postgresql.JSONB(), nullable=True),
        sa.Column("filter_query", sa.Text(), nullable=True),
        sa.Column("create_target_table", sa.Boolean(), nullable=False),
        sa.Column("status", transfer_status, nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("transferred_rows", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_transfer_jobs_user_created", "transfer_jobs", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_transfer_jobs_user_status", "transfer_jobs", ["user_id", "status"]
    )

    op.create_table(
        "transfer_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transfer_job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transfer_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("level", log_level, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_transfer_logs_transfer_job_id", "transfer_logs", ["transfer_job_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_transfer_logs_transfer_job_id", table_name="transfer_logs")
    op.drop_table("transfer_logs")
    op.drop_index("ix_transfer_jobs_user_status", table_name="transfer_jobs")
    op.drop_index("ix_transfer_jobs_user_created", table_name="transfer_jobs")
    op.drop_table("transfer_jobs")
    op.drop_index(
        "ix_database_connections_user_id", table_name="database_connections"
    )
    op.drop_table("database_connections")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    for enum_type in (
        _log_level_ddl,
        _transfer_status_ddl,
        _connection_status_ddl,
        _database_type_ddl,
        _user_role_ddl,
    ):
        enum_type.drop(bind, checkfirst=True)
