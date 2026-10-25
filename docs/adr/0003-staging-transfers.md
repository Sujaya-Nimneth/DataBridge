# ADR-0003: Atomic transfers via per-job staging tables

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The original transfer loop inserted each batch in its own transaction.
A failure halfway left a partially-loaded target table, re-running a
failed job duplicated rows, and a cancelled transfer still "completed".
There was no way to make a large cross-database copy atomic by simply
wrapping it in one transaction without holding a giant transaction open
across two databases (which is impossible — they are different servers).

## Decision

Load rows into a per-job staging table on the target database, then
publish atomically:

- **target table missing** — a single `ALTER TABLE staging RENAME TO
  target` publishes it;
- **target table exists** — `DELETE FROM target` + `INSERT INTO target
  SELECT ... FROM staging` inside one transaction replaces its content.

Failures and cancellations drop the staging table, leaving the target
untouched; re-running a failed job is therefore always safe.

## Consequences

- The target briefly holds a second copy of the data (staging + old
  content) during publish; disk usage peaks around 2× table size.
- Publish is a single transaction on PostgreSQL, SQLite and
  MySQL/InnoDB alike (plain DML, no DDL).
- Publish is not perfectly atomic on MySQL when the target exists if a
  crash lands exactly between rename/replace steps — the window is
  milliseconds and the staging table makes recovery deterministic.
- Cancellation is cooperative: the worker checks job status between
  batches, and status transitions are guarded so a late worker cannot
  overwrite `CANCELLED`.
