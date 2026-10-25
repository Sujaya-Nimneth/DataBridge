"""
Celery tasks for executing data transfers between databases.

Transfers are atomic by construction: rows are first loaded into a per-job
staging table, and only published to the target table once every row has
arrived. Failures and cancellations drop the staging table, leaving the
target untouched — a failed job can simply be re-run without duplicates.
"""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import cast

import pymysql.cursors
from sqlalchemy import (
    JSON,
    Column,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import URL, CursorResult, Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.enums import DatabaseType, LogLevel, TransferStatus
from app.security import decrypt_value
from app.sql_utils import (
    qualify_table,
    quote_identifier,
    validate_identifier,
)
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Reuse a single engine per worker process instead of creating one per task.
_app_engine: Engine | None = None
_app_session_factory: sessionmaker | None = None

# Jobs stuck in these states for this long are assumed dead (crashed worker
# or a dispatch that never reached the broker) and are failed by the reaper.
STALE_RUNNING_AFTER = timedelta(hours=2)
STALE_PENDING_AFTER = timedelta(minutes=30)


def _get_app_session() -> Session:
    """Create a synchronous session for the application database."""
    global _app_engine, _app_session_factory
    if _app_engine is None or _app_session_factory is None:
        _app_engine = create_engine(
            settings.DATABASE_SYNC_URL,
            pool_pre_ping=True,
            pool_size=settings.POOL_SIZE,
            max_overflow=settings.MAX_OVERFLOW,
        )
        _app_session_factory = sessionmaker(bind=_app_engine)
    return _app_session_factory()


def _build_url(db_type, host, port, database_name, username, password):
    """Build a sync database URL using proper escaping."""
    driver = "postgresql+psycopg2" if db_type == DatabaseType.POSTGRESQL.value else "mysql+pymysql"
    return URL.create(
        drivername=driver,
        username=username,
        password=password,
        host=host,
        port=port,
        database=database_name,
    )


def _create_remote_engine(conn_row, url, *, streaming: bool = False) -> Engine:
    """
    Create an engine for a user database with driver-appropriate arguments.

    ``streaming`` selects a true server-side cursor for MySQL sources, where
    ``stream_results`` is ignored and the default client cursor would buffer
    the entire source table in worker memory.
    """
    connect_args: dict = {"connect_timeout": 10}
    db_type = conn_row["db_type"]
    if db_type == DatabaseType.MYSQL.value:
        if conn_row.get("ssl_enabled"):
            connect_args["ssl"] = {}
        if streaming:
            connect_args["cursorclass"] = pymysql.cursors.SSCursor
    elif conn_row.get("ssl_enabled"):
        connect_args["sslmode"] = "require"
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def _default_schema(db_type: str, database_name: str) -> str:
    """Mirror ConnectionService's default-schema rules."""
    return "public" if db_type == DatabaseType.POSTGRESQL.value else database_name


def _staging_table_name(target_table: str, job_id: str) -> str:
    """A per-job staging table name that fits the 64-char identifier limit."""
    return f"{target_table[:48]}__stg_{job_id.replace('-', '')[:10]}"


def _mapped_type(col_type):
    """
    Translate reflected types into cross-dialect-safe equivalents.

    PostgreSQL-only types (ARRAY, JSONB, UUID) and unlengthed VARCHARs
    cannot be DDL'd against MySQL; map them to types every supported
    engine understands.
    """
    if isinstance(col_type, ARRAY | JSONB):
        return JSON()
    if isinstance(col_type, PG_UUID):
        return String(36)
    if isinstance(col_type, String) and not col_type.length:
        return Text()
    return col_type


def _add_log(session, job_id, level: LogLevel, message):
    """Add a log entry for a transfer job."""
    session.execute(
        text("""
            INSERT INTO transfer_logs (id, transfer_job_id, level, message, timestamp)
            VALUES (:id, :job_id, :level, :message, :ts)
        """),
        {
            "id": str(uuid.uuid4()),
            "job_id": str(job_id),
            "level": level.value,
            "message": message,
            "ts": datetime.now(UTC),
        },
    )
    session.commit()


def _set_status(session, job_id, status: TransferStatus, **extra):
    """Update a job's status plus any additional columns."""
    assignments = ["status = :status"]
    params = {"id": job_id, "status": status.value}
    for column, value in extra.items():
        assignments.append(f"{column} = :{column}")
        params[column] = value

    session.execute(
        text(f"UPDATE transfer_jobs SET {', '.join(assignments)} WHERE id = :id"),
        params,
    )
    session.commit()


def _set_status_if(session, job_id, expected: TransferStatus, new: TransferStatus, **extra) -> bool:
    """
    Transition a job's status only if it is still in ``expected``.

    This is what prevents a finished worker from overwriting a status the
    user set meanwhile (e.g. CANCELLED mid-transfer).
    """
    assignments = ["status = :new"]
    params = {"id": job_id, "new": new.value, "expected": expected.value}
    for column, value in extra.items():
        assignments.append(f"{column} = :{column}")
        params[column] = value

    result = session.execute(
        text(
            f"UPDATE transfer_jobs SET {', '.join(assignments)} "
            "WHERE id = :id AND status = :expected"
        ),
        params,
    )
    session.commit()
    return bool(cast("CursorResult", result).rowcount)


def _current_status(session, job_id) -> str | None:
    """Read a job's current status (cheap cancel check between batches)."""
    return cast(
        "str | None",
        session.execute(
            text("SELECT status FROM transfer_jobs WHERE id = :id"), {"id": str(job_id)}
        ).scalar(),
    )


def _drop_table(engine: Engine, qualified_table: str) -> None:
    """Best-effort cleanup of a staging table."""
    with engine.begin() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {qualified_table}"))


def _create_staging_table(
    source_engine: Engine,
    target_engine: Engine,
    source_schema: str,
    target_schema: str,
    source_table: str,
    staging_table: str,
    select_cols: list[str],
    column_mappings: dict,
    job_id: str,
    app_session,
) -> str:
    """
    Create the staging table on the target, mirroring source columns.

    Returns the qualified staging table name. Types are translated to
    dialect-safe equivalents and primary key membership is preserved so a
    published target table keeps its identity.
    """
    source_meta = MetaData()
    source_meta.reflect(bind=source_engine, schema=source_schema, only=[source_table])
    src_table_obj = source_meta.tables.get(
        f"{source_schema}.{source_table}" if source_schema else source_table
    )
    if src_table_obj is None:
        raise ValueError(f"Source table '{source_table}' could not be reflected")

    pk_names = {col.name for col in src_table_obj.primary_key.columns}

    staging_meta = MetaData(schema=target_schema or None)
    staging_columns = []
    for col in src_table_obj.columns:
        if col.name in select_cols:
            new_name = column_mappings.get(col.name, col.name)
            staging_columns.append(
                Column(
                    new_name,
                    _mapped_type(col.type),
                    nullable=col.nullable,
                    primary_key=col.name in pk_names,
                )
            )
    if not staging_columns:
        raise ValueError("No columns selected for transfer")

    Table(staging_table, staging_meta, *staging_columns)

    stg_qualified = qualify_table(target_engine, target_schema, staging_table)
    # A previous crashed attempt may have left the staging table behind.
    _drop_table(target_engine, stg_qualified)
    staging_meta.create_all(target_engine)
    _add_log(app_session, job_id, LogLevel.INFO, f"Staging table '{staging_table}' created")
    return stg_qualified


def _publish_staging(
    target_engine: Engine,
    target_schema: str,
    target_table: str,
    staging_table: str,
    target_col_names: list[str],
) -> str:
    """
    Atomically make the staged data the target table's content.

    - target missing: a single RENAME publishes the staged table.
    - target exists: DELETE + INSERT ... SELECT inside one transaction
      replaces its content (transactional on PostgreSQL, MySQL/InnoDB
      and SQLite alike).
    """
    tgt_qualified = qualify_table(target_engine, target_schema, target_table)
    stg_qualified = qualify_table(target_engine, target_schema, staging_table)

    target_exists = inspect(target_engine).has_table(target_table, schema=target_schema or None)

    with target_engine.begin() as conn:
        if not target_exists:
            new_name = quote_identifier(target_engine, target_table)
            conn.execute(text(f"ALTER TABLE {stg_qualified} RENAME TO {new_name}"))
            return "renamed"

        cols = ", ".join(quote_identifier(target_engine, c) for c in target_col_names)
        conn.execute(text(f"DELETE FROM {tgt_qualified}"))
        conn.execute(
            text(f"INSERT INTO {tgt_qualified} ({cols}) SELECT {cols} FROM {stg_qualified}")
        )

    _drop_table(target_engine, stg_qualified)
    return "replaced"


@celery_app.task(bind=True)
def execute_transfer(self, job_id: str):
    """
    Execute a data transfer between two database connections.

    Process:
    1. Load job config and connection details from the app DB
    2. Validate identifiers and column mappings against the reflected source
    3. Create a per-job staging table on the target
    4. Stream source rows into the staging table in batches, checking for
       cancellation between batches
    5. Publish the staged data atomically on success; drop it otherwise
    """
    app_session = _get_app_session()
    source_engine = None
    target_engine = None
    staging_qualified = None
    target_engine_row = None

    try:
        # Load the transfer job
        result = app_session.execute(
            text("SELECT * FROM transfer_jobs WHERE id = :id"), {"id": job_id}
        )
        job = result.mappings().first()
        if not job:
            raise ValueError(f"Transfer job {job_id} not found")

        # Update status to running
        _set_status(
            app_session,
            job_id,
            TransferStatus.RUNNING,
            started_at=datetime.now(UTC),
        )
        _add_log(app_session, job_id, LogLevel.INFO, "Transfer started")

        # Load connection details
        source_conn = (
            app_session.execute(
                text("SELECT * FROM database_connections WHERE id = :id"),
                {"id": str(job["source_connection_id"])},
            )
            .mappings()
            .first()
        )

        target_conn = (
            app_session.execute(
                text("SELECT * FROM database_connections WHERE id = :id"),
                {"id": str(job["target_connection_id"])},
            )
            .mappings()
            .first()
        )

        if not source_conn or not target_conn:
            raise ValueError("Source or target connection not found")

        # Build connection URLs and engines
        source_url = _build_url(
            source_conn["db_type"],
            decrypt_value(source_conn["host"]),
            source_conn["port"],
            source_conn["database_name"],
            decrypt_value(source_conn["username"]),
            decrypt_value(source_conn["password"]),
        )
        target_url = _build_url(
            target_conn["db_type"],
            decrypt_value(target_conn["host"]),
            target_conn["port"],
            target_conn["database_name"],
            decrypt_value(target_conn["username"]),
            decrypt_value(target_conn["password"]),
        )

        source_engine = _create_remote_engine(source_conn, source_url, streaming=True)
        target_engine = _create_remote_engine(target_conn, target_url)

        _add_log(app_session, job_id, LogLevel.INFO, "Connected to source and target databases")

        # Determine schema
        source_schema = job["source_schema"] or _default_schema(
            source_conn["db_type"], source_conn["database_name"]
        )
        target_schema = job["target_schema"] or _default_schema(
            target_conn["db_type"], target_conn["database_name"]
        )

        source_table = job["source_table"]
        target_table = job["target_table"]

        # Identifiers become part of the SQL text: validate before any use.
        validate_identifier(source_table, "source_table")
        validate_identifier(target_table, "target_table")
        if source_schema:
            validate_identifier(source_schema, "source_schema")
        if target_schema:
            validate_identifier(target_schema, "target_schema")

        # Get source table info
        source_inspector = inspect(source_engine)
        source_columns = source_inspector.get_columns(source_table, schema=source_schema)

        src_qualified = qualify_table(source_engine, source_schema, source_table)

        # Get total row count
        with source_engine.connect() as src_conn:
            count_sql = f"SELECT COUNT(*) FROM {src_qualified}"
            if job["filter_query"]:
                count_sql += f" WHERE {job['filter_query']}"
            total_rows = int(src_conn.execute(text(count_sql)).scalar() or 0)

        app_session.execute(
            text("UPDATE transfer_jobs SET total_rows = :total WHERE id = :id"),
            {"total": total_rows, "id": job_id},
        )
        app_session.commit()

        _add_log(app_session, job_id, LogLevel.INFO, f"Source table has {total_rows} rows")

        # Update Celery state
        self.update_state(state="PROGRESS", meta={"current": 0, "total": total_rows, "percent": 0})

        # Column mapping (some drivers return JSON columns as text, and JSON
        # null deserialises back to None — both collapse to "no mapping")
        raw_mappings = job["column_mappings"]
        if isinstance(raw_mappings, str):
            raw_mappings = json.loads(raw_mappings)
        column_mappings = raw_mappings or {}

        source_col_names = [c["name"] for c in source_columns]

        if column_mappings:
            unknown = sorted(set(column_mappings) - set(source_col_names))
            if unknown:
                raise ValueError(f"column_mappings references unknown source columns: {unknown}")
            select_cols = list(column_mappings.keys())
            target_col_names = [column_mappings[c] for c in select_cols]
        else:
            select_cols = source_col_names
            target_col_names = source_col_names

        # Every transfer stages its data first; auto-create additionally
        # promises the final table even when it does not exist yet.
        target_exists = inspect(target_engine).has_table(target_table, schema=target_schema or None)
        if not job["create_target_table"] and not target_exists:
            raise ValueError(
                f"Target table '{target_table}' does not exist and create_target_table is disabled"
            )

        staging_table = _staging_table_name(target_table, str(job_id))
        staging_qualified = _create_staging_table(
            source_engine,
            target_engine,
            source_schema,
            target_schema,
            source_table,
            staging_table,
            select_cols,
            column_mappings,
            job_id,
            app_session,
        )
        # Remember for cleanup paths
        target_engine_row = target_engine

        # Transfer data into the staging table in batches
        batch_size = settings.TRANSFER_BATCH_SIZE
        transferred = 0

        with source_engine.connect() as src_conn:
            # Build SELECT query with dialect-aware column quoting
            cols_sql = ", ".join(quote_identifier(source_engine, c) for c in select_cols)

            select_sql = f"SELECT {cols_sql} FROM {src_qualified}"
            if job["filter_query"]:
                select_sql += f" WHERE {job['filter_query']}"

            # Stream results
            result = src_conn.execution_options(stream_results=True).execute(text(select_sql))

            batch = []
            cancelled = False
            for row in result:
                row_dict = {}
                for i, col_name in enumerate(target_col_names):
                    row_dict[col_name] = row[i]
                batch.append(row_dict)

                if len(batch) >= batch_size:
                    # Insert batch into staging
                    _insert_batch(target_engine, staging_qualified, target_col_names, batch)
                    transferred += len(batch)
                    batch = []

                    # Update progress
                    percent = (transferred / total_rows * 100) if total_rows > 0 else 0
                    self.update_state(
                        state="PROGRESS",
                        meta={
                            "current": transferred,
                            "total": total_rows,
                            "percent": round(percent, 1),
                        },
                    )
                    app_session.execute(
                        text("UPDATE transfer_jobs SET transferred_rows = :rows WHERE id = :id"),
                        {"rows": transferred, "id": job_id},
                    )
                    app_session.commit()

                    if transferred % (batch_size * 10) == 0:
                        _add_log(
                            app_session,
                            job_id,
                            LogLevel.INFO,
                            f"Staged {transferred}/{total_rows} rows ({percent:.1f}%)",
                        )

                    # Cancellation is cooperative: check between batches.
                    if _current_status(app_session, job_id) != TransferStatus.RUNNING.value:
                        cancelled = True
                        break

            if not cancelled and batch:
                _insert_batch(target_engine, staging_qualified, target_col_names, batch)
                transferred += len(batch)

            if cancelled:
                _add_log(
                    app_session,
                    job_id,
                    LogLevel.WARNING,
                    "Cancellation detected; staged data discarded, target untouched",
                )
                return {"status": TransferStatus.CANCELLED.value, "transferred_rows": transferred}

        # Final cancel check before publishing minimises the race window
        if _current_status(app_session, job_id) != TransferStatus.RUNNING.value:
            _add_log(
                app_session,
                job_id,
                LogLevel.WARNING,
                "Cancellation detected before publish; staged data discarded",
            )
            return {"status": TransferStatus.CANCELLED.value, "transferred_rows": transferred}

        publish_mode = _publish_staging(
            target_engine, target_schema, target_table, staging_table, target_col_names
        )
        staging_qualified = None  # published: staging no longer exists to clean up

        # Guarded completion: never overwrite a concurrent cancellation.
        if not _set_status_if(
            app_session,
            job_id,
            TransferStatus.RUNNING,
            TransferStatus.COMPLETED,
            transferred_rows=transferred,
            completed_at=datetime.now(UTC),
        ):
            _add_log(
                app_session,
                job_id,
                LogLevel.WARNING,
                "Transfer finished but the job was cancelled concurrently; "
                "the published data was kept",
            )
            return {"status": TransferStatus.CANCELLED.value, "transferred_rows": transferred}

        _add_log(
            app_session,
            job_id,
            LogLevel.INFO,
            f"Target table '{target_table}' published ({publish_mode}); "
            f"{transferred} rows transferred",
        )

        return {"status": TransferStatus.COMPLETED.value, "transferred_rows": transferred}

    except Exception as e:
        # Mark as failed — guarded, so an already-cancelled job stays cancelled.
        error_msg = str(e)[:500]
        try:
            if _set_status_if(
                app_session,
                job_id,
                TransferStatus.RUNNING,
                TransferStatus.FAILED,
                error_message=error_msg,
                completed_at=datetime.now(UTC),
            ):
                _add_log(app_session, job_id, LogLevel.ERROR, f"Transfer failed: {error_msg}")
            else:
                _add_log(
                    app_session,
                    job_id,
                    LogLevel.WARNING,
                    f"Transfer aborted after cancellation: {error_msg[:200]}",
                )
        except Exception:
            logger.exception("Failed to record failure for transfer %s", job_id)

        raise

    finally:
        if staging_qualified is not None and target_engine_row is not None:
            try:
                _drop_table(target_engine_row, staging_qualified)
            except Exception:
                logger.warning(
                    "Could not drop staging table for transfer %s (table %s)",
                    job_id,
                    staging_qualified,
                )
        if source_engine is not None:
            source_engine.dispose()
        if target_engine is not None:
            target_engine.dispose()
        app_session.close()


@celery_app.task(name="workers.reap_stale_transfers")
def reap_stale_transfers():
    """
    Fail jobs whose worker died or whose dispatch never reached the broker.

    Runs periodically via Celery Beat. Without it, a broker outage leaves
    jobs PENDING forever and a crashed worker leaves them RUNNING forever.
    """
    session = _get_app_session()
    now = datetime.now(UTC)
    try:
        stale_running = cast(
            "CursorResult",
            session.execute(
                text(
                    "UPDATE transfer_jobs SET status = 'failed', "
                    "error_message = 'Worker stopped responding; job reaped', "
                    "completed_at = :now WHERE status = 'running' AND started_at < :cutoff"
                ),
                {"now": now, "cutoff": now - STALE_RUNNING_AFTER},
            ),
        ).rowcount

        stale_pending = cast(
            "CursorResult",
            session.execute(
                text(
                    "UPDATE transfer_jobs SET status = 'failed', "
                    "error_message = 'Transfer was never dispatched; job reaped', "
                    "completed_at = :now WHERE status = 'pending' AND created_at < :cutoff"
                ),
                {"now": now, "cutoff": now - STALE_PENDING_AFTER},
            ),
        ).rowcount

        session.commit()
        if stale_running or stale_pending:
            logger.info(
                "Reaped %d stale running and %d stale pending transfers",
                stale_running,
                stale_pending,
            )
        return {"stale_running": stale_running, "stale_pending": stale_pending}
    finally:
        session.close()


def _insert_batch(engine, qualified_table, column_names, batch):
    """Insert a batch of rows into the target table."""
    if not batch:
        return

    cols = ", ".join(quote_identifier(engine, c) for c in column_names)
    placeholders = ", ".join(f":{c}" for c in column_names)

    insert_sql = f"INSERT INTO {qualified_table} ({cols}) VALUES ({placeholders})"

    with engine.begin() as conn:
        conn.execute(text(insert_sql), batch)
