"""
Characterization tests for the Celery transfer task.

The task runs for real (eager Celery, in-memory result backend) against
SQLite source/target databases and a SQLite application database, so the
batching, mapping, table-creation, progress and status logic is exercised
end to end without external services.

SQLite has no schemas, so each engine ATTACHes its own file under the
alias ``public`` — that keeps the task's schema-qualified SQL (written for
PostgreSQL/MySQL) valid here.
"""

import sqlite3
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.enums import DatabaseType, TransferStatus
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob
from app.models.user import User
from app.security import encrypt_value
from app.workers import transfer_tasks
from app.workers.celery_app import celery_app
from app.workers.transfer_tasks import execute_transfer

BATCH_SIZE = 1000


@pytest.fixture
def worker_env(tmp_path, monkeypatch):
    """Application DB, source DB and target DB wired into the task module."""
    app_db_file = tmp_path / "app.db"
    source_file = tmp_path / "src.db"
    target_file = tmp_path / "tgt.db"

    app_engine = create_engine(f"sqlite:///{app_db_file}")
    Base.metadata.create_all(app_engine)

    files = {"src.db": str(source_file), "tgt.db": str(target_file)}
    real_create_engine = transfer_tasks.create_engine

    def sqlite_attach_engine(url, **kwargs):
        engine = real_create_engine(url, **kwargs)
        url_str = str(url)
        if url_str.startswith("sqlite:///"):
            db_file = url_str[len("sqlite:///") :]
            event.listen(
                engine,
                "connect",
                lambda dbapi_conn, _: dbapi_conn.execute(f"ATTACH DATABASE '{db_file}' AS public"),
            )
        return engine

    monkeypatch.setattr(transfer_tasks, "_app_engine", app_engine)
    monkeypatch.setattr(transfer_tasks, "_app_session_factory", sessionmaker(bind=app_engine))
    monkeypatch.setattr(
        transfer_tasks,
        "_build_url",
        lambda db_type, host, port, database_name, username, password: (
            f"sqlite:///{files[database_name]}"
        ),
    )
    monkeypatch.setattr(transfer_tasks, "create_engine", sqlite_attach_engine)

    old_eager = celery_app.conf.task_always_eager
    old_backend = celery_app.conf.result_backend
    celery_app.conf.task_always_eager = True
    celery_app.conf.result_backend = "cache+memory://"

    yield {"app_engine": app_engine, "files": files}

    celery_app.conf.task_always_eager = old_eager
    celery_app.conf.result_backend = old_backend
    app_engine.dispose()


def seed_source_db(worker_env, rows):
    """Create the source table and insert ``rows`` tuples of (name, email, score)."""
    engine = create_engine(f"sqlite:///{worker_env['files']['src.db']}")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE users ( id INTEGER PRIMARY KEY, name TEXT, email TEXT, score INTEGER)"
            )
        )
        for i in range(rows):
            conn.execute(
                text("INSERT INTO users (name, email, score) VALUES (:n, :e, :s)"),
                {"n": f"user-{i}", "e": f"user-{i}@example.com", "s": i},
            )
    engine.dispose()


def create_job(worker_env, **overrides):
    """Insert a user, two connections and a transfer job; return the job id."""
    session = sessionmaker(bind=worker_env["app_engine"])()
    user = User(
        email=f"{uuid.uuid4().hex[:10]}@example.com",
        hashed_password="x",
        full_name="Worker Test",
    )
    session.add(user)
    session.flush()

    source = DatabaseConnection(
        user_id=user.id,
        name="source",
        db_type=DatabaseType.POSTGRESQL,
        host=encrypt_value("localhost"),
        port=5432,
        database_name="src.db",
        username=encrypt_value("worker"),
        password=encrypt_value("secret"),
    )
    target = DatabaseConnection(
        user_id=user.id,
        name="target",
        db_type=DatabaseType.POSTGRESQL,
        host=encrypt_value("localhost"),
        port=5432,
        database_name="tgt.db",
        username=encrypt_value("worker"),
        password=encrypt_value("secret"),
    )
    session.add_all([source, target])
    session.flush()

    defaults: dict = {
        "user_id": user.id,
        "source_connection_id": source.id,
        "source_schema": None,
        "source_table": "users",
        "target_connection_id": target.id,
        "target_schema": None,
        "target_table": "users_copy",
        "column_mappings": None,
        "filter_query": None,
        "create_target_table": True,
        "status": TransferStatus.RUNNING,
        "started_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    job = TransferJob(**defaults)
    session.add(job)
    session.commit()

    # SQLAlchemy's Uuid type stores hex without dashes on SQLite; the task's
    # raw SQL must query with the same representation it was stored under.
    job_id = job.id.hex
    session.close()
    return job_id


def fetch_job_row(worker_env, job_id):
    with worker_env["app_engine"].connect() as conn:
        return dict(
            conn.execute(
                text(
                    "SELECT status, total_rows, transferred_rows, error_message"
                    " FROM transfer_jobs WHERE id = :id"
                ),
                {"id": job_id},
            )
            .mappings()
            .one()
        )


def fetch_logs(worker_env, job_id):
    with worker_env["app_engine"].connect() as conn:
        return [
            dict(row)
            for row in conn.execute(
                text(
                    "SELECT level, message FROM transfer_logs"
                    " WHERE transfer_job_id = :id ORDER BY timestamp"
                ),
                {"id": job_id},
            ).mappings()
        ]


def target_table_row_count(worker_env, table="users_copy"):
    with sqlite3.connect(worker_env["files"]["tgt.db"]) as conn:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def target_table_columns(worker_env, table="users_copy"):
    with sqlite3.connect(worker_env["files"]["tgt.db"]) as conn:
        return [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]


def test_transfer_copies_all_rows_across_batches(worker_env):
    rows = BATCH_SIZE * 2 + 505  # two full batches plus a remainder batch
    seed_source_db(worker_env, rows)
    job_id = create_job(worker_env)

    result = execute_transfer.apply(args=[job_id])

    assert result.successful(), result.result
    job_row = fetch_job_row(worker_env, job_id)
    assert job_row["status"] == "completed"
    assert job_row["total_rows"] == rows
    assert job_row["transferred_rows"] == rows
    assert job_row["error_message"] is None
    assert target_table_row_count(worker_env) == rows

    messages = [log["message"] for log in fetch_logs(worker_env, job_id)]
    assert any("Target table 'users_copy' created/verified" in m for m in messages)
    assert any(f"Transfer completed: {rows} rows transferred" in m for m in messages)


def test_transfer_applies_column_mappings_and_filter(worker_env):
    seed_source_db(worker_env, 100)
    job_id = create_job(
        worker_env,
        column_mappings={"id": "user_id", "name": "full_name"},
        filter_query="score >= 50",
    )

    result = execute_transfer.apply(args=[job_id])

    assert result.successful(), result.result
    job_row = fetch_job_row(worker_env, job_id)
    assert job_row["status"] == "completed"
    assert job_row["total_rows"] == 50
    assert job_row["transferred_rows"] == 50
    assert sorted(target_table_columns(worker_env)) == ["full_name", "user_id"]
    assert target_table_row_count(worker_env) == 50


def test_transfer_failure_marks_job_failed(worker_env):
    seed_source_db(worker_env, 5)
    job_id = create_job(worker_env, source_table="does_not_exist")

    result = execute_transfer.apply(args=[job_id])

    assert result.failed()
    job_row = fetch_job_row(worker_env, job_id)
    assert job_row["status"] == "failed"
    assert job_row["error_message"]
    error_logs = [log for log in fetch_logs(worker_env, job_id) if log["level"] == "error"]
    assert error_logs, "expected an ERROR-level log entry for the failure"


def test_cancel_during_transfer_is_overwritten_by_completion(worker_env):
    """
    Characterises the current cancel race: the API can mark a job cancelled
    mid-flight, but the worker never re-checks status and finishes with
    'completed', overwriting the user's cancellation.

    Phase 4 (staging + guarded transitions) will flip this expectation.
    """
    rows = BATCH_SIZE * 2
    seed_source_db(worker_env, rows)
    job_id = create_job(worker_env)

    real_insert = transfer_tasks._insert_batch
    calls = {"count": 0}

    def insert_then_cancel(*args, **kwargs):
        real_insert(*args, **kwargs)
        calls["count"] += 1
        if calls["count"] == 1:
            with worker_env["app_engine"].begin() as conn:
                conn.execute(
                    text("UPDATE transfer_jobs SET status = 'cancelled' WHERE id = :id"),
                    {"id": job_id},
                )

    transfer_tasks._insert_batch = insert_then_cancel
    try:
        result = execute_transfer.apply(args=[job_id])
    finally:
        transfer_tasks._insert_batch = real_insert

    assert result.successful(), result.result
    assert fetch_job_row(worker_env, job_id)["status"] == "completed"
    assert target_table_row_count(worker_env) == rows


def test_transfer_rejects_malicious_table_name(worker_env):
    """Identifiers smuggled straight into the jobs table fail the task safely."""
    seed_source_db(worker_env, 5)
    job_id = create_job(worker_env, source_table='users"; DROP TABLE x; --')

    result = execute_transfer.apply(args=[job_id])

    assert result.failed()
    job_row = fetch_job_row(worker_env, job_id)
    assert job_row["status"] == "failed"
    assert "source_table" in job_row["error_message"]
    with sqlite3.connect(worker_env["files"]["tgt.db"]) as conn:
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    assert tables == []
