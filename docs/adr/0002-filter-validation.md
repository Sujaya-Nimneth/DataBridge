# ADR-0002: Denylist validation for user-supplied WHERE fragments

- **Status**: Accepted (residual risk documented)
- **Date**: 2026-10-25

## Context

Explorer previews and transfer filters accept a raw SQL `WHERE` fragment
from the client. A predicate cannot be parameterised — it is an
expression, not a value — while the connection it runs against is
user-supplied and therefore not trusted.

## Decision

Validate the fragment against a conservative denylist (statement
separators, comments, DML/DDL keywords, sub-selects, and known
dangerous functions such as `pg_sleep`, `benchmark`, `waitfor`,
`load_file`), cap its length, and **validate every identifier**
(schema, table, column names) against `^[A-Za-z_][A-Za-z0-9_]{0,63}$`
before it is quoted with the target dialect's preparer.

## Alternatives considered

- **Full SQL parsing** (sqlglot/pglast): highest fidelity, but a new
  dependency per dialect and a parser bug becomes a security bug.
- **Read-only sessions** (`default_transaction_read_only`): excellent
  defence in depth, but engines are pooled and shared between the
  read-only discovery path and transfers that must write.

## Residual risk

A denylist cannot be complete. Mitigations: identifiers can no longer
smuggle syntax (pattern + quoting), the fragment cannot contain
statement separators or comments, and dangerous functions are refused.
Connections run with the user's own credentials, limiting blast radius
to databases they already control. Read-only sessions remain the
recommended next hardening step.
