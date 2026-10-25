# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- MySQL connections work again — PyMySQL was used everywhere but never
  declared as a dependency (`ModuleNotFoundError` on any MySQL path).
- `docker compose up --build` on a fresh clone now runs Alembic before
  serving traffic (one-shot `migrate` service); previously the API came
  up against an empty schema and the first login returned 500.
- README secret setup used a quoted heredoc, writing literal `$(...)`
  commands into `.env` as the actual secrets.
- Cancelled transfers can no longer be overwritten to `completed` by a
  late worker; status transitions are guarded.
- Invalid `status` filter on `GET /api/transfers` returns 422 instead of
  500.

### Security

- Replaced `python-jose` 3.3.0 (CVE-2024-33663/33664) with PyJWT, and
  upgraded all runtime dependencies with known advisories (pip-audit and
  npm audit both clean).
- SQL identifiers (schemas, tables, columns, mapping names) are
  validated against a conservative pattern and quoted with the target
  dialect's preparer — including in the Celery worker, which previously
  hand-built quoted SQL from unvalidated strings.
- Filter denylist extended with dangerous functions (`pg_sleep`,
  `benchmark`, `waitfor`, `load_file`, …).
- Rate limiting on register/login/refresh (disabled in DEBUG).
- Refresh tokens rotate on every use; reuse revokes all sessions;
  `POST /api/auth/logout` revokes server-side.
- Driver exception details no longer reach clients or the stored
  connection-test message.
- Startup fails fast on an invalid Fernet `ENCRYPTION_KEY` (previously
  silently derived a key from any input) and rejects placeholder-ish
  secrets outside DEBUG.

### Changed

- Transfers are atomic: rows stage in a per-job table and publish only
  on full success (rename, or transactional DELETE+INSERT); failures and
  cancellations leave the target untouched.
- MySQL sources stream with SSCursor instead of buffering whole tables.
- Cross-dialect type mapping (ARRAY/JSONB → JSON, UUID → CHAR(36)) and
  primary keys are carried to auto-created tables.
- Remote engines honour `ssl_enabled` and connect timeouts in the worker.
- `/health` probes PostgreSQL and Redis and returns 503 when they are
  down; production logs are structured JSON with request IDs.
- Compose: Postgres/Redis bound to localhost, `POSTGRES_PASSWORD`
  required, restart policies, memory limits, healthchecks, Celery Beat
  service reaping orphaned jobs.

### Added

- Column mapping UI in the transfer wizard (skip/rename columns).
- Confirmation dialogs for cancelling transfers and deleting connections.
- Inline per-field 422 error rendering; Explorer retry state.
- Connection activation (deactivate/reactivate; inactive connections are
  refused by discovery and transfers).
- Admin role enforcement with `GET /api/admin/users` and a Monitoring
  "Users" tab for admins.
- Quality gates: ruff (lint+format), mypy, ESLint, Prettier, pre-commit,
  pytest-cov (70% floor), Vitest frontend suite, pip-audit/npm-audit CI
  jobs, Dependabot.
- Demo stack (`docker-compose.demo.yml`) with seeded source/target
  databases.
- ADRs (docs/adr), CONTRIBUTING, SECURITY policy, testing guide, MIT
  LICENSE file.
