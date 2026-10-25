# ADR-0004: Alembic in production, create_all in development only

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The app can create its schema either through `Base.metadata.create_all`
or through Alembic migrations. Running both invites drift: `create_all`
silently produces whatever the current models say, while migrations
encode an explicit history.

## Decision

`create_all` runs **only** when `DEBUG=true` (a convenience for a fresh
development checkout). Production bootstraps exclusively through
`alembic upgrade head` — the compose stack runs a one-shot `migrate`
service that backend and worker wait for. CI renders every migration
offline (`alembic upgrade head --sql`) so a broken revision fails the
build before it can break a deployment.

## Consequences

- Schema changes must always ship as a migration.
- A fresh non-debug deployment without the migrate step fails loudly
  (missing tables) instead of silently diverging from migration history.
