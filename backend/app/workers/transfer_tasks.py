"""
Celery tasks for executing data transfers between databases.
Handles batch processing, progress tracking, and error recovery.
"""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, MetaData, Table, create_engine, inspect, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.enums import DatabaseType, LogLevel, TransferStatus
from app.security import decrypt_value
from app.workers.celery_app import celery_app

# Reuse a single engine per worker process instead of creating one per task.
_app_engine: Engine | None = None
_app_session_factory: sessionmaker | None = None


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


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def execute_transfer(self, job_id: str):
    """
    Execute a data transfer between two database connections.

    Process:
    1. Load job config from app DB
    2. Connect to source and target databases
    3. Read source data in batches
    4. Optionally create target table
    5. Insert data into target with column mapping
    6. Track progress via Celery state updates
    7. Handle errors and update final status
    """
    app_session = _get_app_session()
    source_engine = None
    target_engine = None

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

        # Load source connection details
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

        # Build connection URLs
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

        source_engine = create_engine(source_url, pool_pre_ping=True)
        target_engine = create_engine(target_url, pool_pre_ping=True)

        _add_log(app_session, job_id, LogLevel.INFO, "Connected to source and target databases")

        # Determine schema
        source_schema = job["source_schema"]
        target_schema = job["target_schema"]

        if not source_schema:
            source_schema = (
                "public"
                if source_conn["db_type"] == DatabaseType.POSTGRESQL.value
                else source_conn["database_name"]
            )
        if not target_schema:
            target_schema = (
                "public"
                if target_conn["db_type"] == DatabaseType.POSTGRESQL.value
                else target_conn["database_name"]
            )

        source_table = job["source_table"]
        target_table = job["target_table"]

        # Get source table info
        source_inspector = inspect(source_engine)
        source_columns = source_inspector.get_columns(source_table, schema=source_schema)

        # Build qualified table names for SQL
        if source_conn["db_type"] == DatabaseType.POSTGRESQL.value:
            src_qualified = f'"{source_schema}"."{source_table}"'
        else:
            src_qualified = f"`{source_schema}`.`{source_table}`"

        if target_conn["db_type"] == DatabaseType.POSTGRESQL.value:
            tgt_qualified = f'"{target_schema}"."{target_table}"'
        else:
            tgt_qualified = f"`{target_schema}`.`{target_table}`"

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
            select_cols = list(column_mappings.keys())
            target_col_names = [column_mappings[c] for c in select_cols]
        else:
            select_cols = source_col_names
            target_col_names = source_col_names

        # Create target table if requested
        if job["create_target_table"]:
            try:
                # Reflect source table and create equivalent in target
                source_meta = MetaData()
                source_meta.reflect(bind=source_engine, schema=source_schema, only=[source_table])
                src_table_obj = source_meta.tables.get(
                    f"{source_schema}.{source_table}" if source_schema else source_table
                )

                if src_table_obj is not None:
                    # Create target table with mapped column names
                    target_meta = MetaData(schema=target_schema)
                    target_columns = []
                    for col in src_table_obj.columns:
                        if col.name in select_cols:
                            new_name = column_mappings.get(col.name, col.name)
                            target_columns.append(Column(new_name, col.type, nullable=col.nullable))

                    if target_columns:
                        Table(target_table, target_meta, *target_columns)
                        target_meta.create_all(target_engine, checkfirst=True)
                        _add_log(
                            app_session,
                            job_id,
                            LogLevel.INFO,
                            f"Target table '{target_table}' created/verified",
                        )
            except Exception as e:
                _add_log(
                    app_session,
                    job_id,
                    LogLevel.WARNING,
                    f"Could not auto-create target table: {str(e)[:200]}",
                )

        # Transfer data in batches
        batch_size = settings.TRANSFER_BATCH_SIZE
        transferred = 0

        with source_engine.connect() as src_conn:
            # Build SELECT query
            if source_conn["db_type"] == DatabaseType.POSTGRESQL.value:
                cols_sql = ", ".join(f'"{c}"' for c in select_cols)
            else:
                cols_sql = ", ".join(f"`{c}`" for c in select_cols)

            select_sql = f"SELECT {cols_sql} FROM {src_qualified}"
            if job["filter_query"]:
                select_sql += f" WHERE {job['filter_query']}"

            # Stream results
            result = src_conn.execution_options(stream_results=True).execute(text(select_sql))

            batch = []
            for row in result:
                row_dict = {}
                for i, col_name in enumerate(target_col_names):
                    val = row[i]
                    row_dict[col_name] = val
                batch.append(row_dict)

                if len(batch) >= batch_size:
                    # Insert batch into target
                    _insert_batch(
                        target_engine,
                        tgt_qualified,
                        target_col_names,
                        batch,
                        target_conn["db_type"],
                    )
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
                            f"Transferred {transferred}/{total_rows} rows ({percent:.1f}%)",
                        )

            # Insert remaining rows
            if batch:
                _insert_batch(
                    target_engine,
                    tgt_qualified,
                    target_col_names,
                    batch,
                    target_conn["db_type"],
                )
                transferred += len(batch)

        # Mark as completed
        _set_status(
            app_session,
            job_id,
            TransferStatus.COMPLETED,
            transferred_rows=transferred,
            completed_at=datetime.now(UTC),
        )

        _add_log(
            app_session,
            job_id,
            LogLevel.INFO,
            f"Transfer completed: {transferred} rows transferred",
        )

        return {"status": TransferStatus.COMPLETED.value, "transferred_rows": transferred}

    except Exception as e:
        # Mark as failed
        error_msg = str(e)[:500]
        try:
            _set_status(
                app_session,
                job_id,
                TransferStatus.FAILED,
                error_message=error_msg,
                completed_at=datetime.now(UTC),
            )
            _add_log(app_session, job_id, LogLevel.ERROR, f"Transfer failed: {error_msg}")
        except Exception:
            pass

        raise

    finally:
        if source_engine is not None:
            source_engine.dispose()
        if target_engine is not None:
            target_engine.dispose()
        app_session.close()


def _insert_batch(engine, qualified_table, column_names, batch, db_type):
    """Insert a batch of rows into the target table."""
    if not batch:
        return

    if db_type == DatabaseType.POSTGRESQL.value:
        cols = ", ".join(f'"{c}"' for c in column_names)
    else:
        cols = ", ".join(f"`{c}`" for c in column_names)

    placeholders = ", ".join(f":{c}" for c in column_names)

    insert_sql = f"INSERT INTO {qualified_table} ({cols}) VALUES ({placeholders})"

    with engine.begin() as conn:
        conn.execute(text(insert_sql), batch)
