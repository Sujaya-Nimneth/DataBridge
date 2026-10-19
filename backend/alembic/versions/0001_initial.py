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

user_role = sa.Enum("admin", "user", name="user_role")
database_type = sa.Enum("postgresql", "mysql", name="database_type")
connection_status = sa.Enum("success", "failed", "unknown", name="connection_status")
transfer_status = sa.Enum("pending", "running", "completed", "failed", "cancelled", name="transfer_status")
log_level = sa.Enum("info", "warning", "error", name="log_level")


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (
        user_role, database_type, connection_status, transfer_status, log_level,
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
        log_level, transfer_status, connection_status, database_type, user_role,
    ):
        enum_type.drop(bind, checkfirst=True)
