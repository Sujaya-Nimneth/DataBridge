# Testing Guide

## Philosophy

- **No external services required.** The backend suite runs against
  in-memory SQLite; the transfer engine runs against real SQLite
  source/target databases so batching, staging, publish, cancel and
  failure paths are exercised for real — not mocked.
- **PostgreSQL-specific behaviour** (DDL rendering, identifier quoting)
  is covered by compiling statements for the Postgres dialect.
- **The frontend** tests behaviour users experience: polling semantics,
  auth/session handling, interceptor token refresh, form flows.

## Running the suites

```bash
# Backend (fastapi services, worker, security, observability)
cd backend
pip install -r requirements-dev.txt
python -m pytest                 # includes coverage gate (>= 70%)

# Frontend
cd frontend
npm install
npm test                         # vitest + React Testing Library
```

## What lives where

| File | Covers |
|------|--------|
| `tests/test_auth.py` | Registration, login, token type confusion |
| `tests/test_connections.py` | CRUD, encryption at rest, tenant isolation, delete policy |
| `tests/test_sql_safety.py` | Filter denylist, identifier quoting, enum persistence |
| `tests/test_engine_cache.py` | Engine reuse, fingerprints, TTL/LRU eviction |
| `tests/test_api_flows.py` | Monitoring + transfer API flows, cross-tenant 404s |
| `tests/test_transfer_worker.py` | End-to-end transfer engine: staging, publish, cancel, failure, reaper |
| `tests/test_security_hardening.py` | Filter/identifier injection, token rotation, rate limits, activation, admin role |
| `tests/test_observability.py` | Deep health probes, request IDs |
| `frontend/src/**/*.test.jsx` | usePolling, AuthContext, axios interceptors, Login flows |

## Conventions

- Fixtures build state through the public API (`client`) wherever
  possible; only the worker tests seed rows directly.
- The worker suite patches module seams (`_build_url`,
  `_create_remote_engine`) to point the task at SQLite files, and
  ATTACHes each file as the alias `public` so the task's
  schema-qualified SQL stays valid.
- Coverage floor is enforced in `pyproject.toml` (`fail_under = 70`);
  raise it when you add meaningful coverage, never lower it to make a
  PR pass.
