# ADR-0001: Refresh token rotation with server-side revocation

- **Status**: Accepted
- **Date**: 2026-10-25

## Context

The original design issued stateless 7-day refresh JWTs. Nothing could
revoke them: logging out only cleared browser storage, a stolen refresh
token stayed valid for its full lifetime, and tokens survived account
deactivation checks only by user lookup.

## Decision

Every refresh JWT carries a `jti` that is persisted in a `refresh_tokens`
table. On every refresh the presented token is rotated (its row marked
revoked and a new pair issued). Presenting an already-rotated token is
treated as theft: **all** refresh tokens for that user are revoked and
the request is rejected. `POST /api/auth/logout` revokes every token for
the user. Expired rows are purged opportunistically.

## Consequences

- Sessions can be killed server-side (logout, theft response).
- Revocation state is a database dependency of the auth flow; the table
  is tiny (one row per issued refresh token) and purged automatically.
- The revocation on reuse-detection is committed explicitly before the
  401 is raised, because the request-scoped session rolls back on error.
- Access tokens remain short-lived and stateless, so most requests never
  touch the table.
