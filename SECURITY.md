# Security Policy

## Supported versions

Only the latest `main` branch receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately to
**sujayanimneth@outlook.com** with the subject `DataBridge security`.
Include reproduction steps and, where possible, a proof of concept. You
will receive an acknowledgement within 72 hours. Please do not open a
public GitHub issue for security problems.

## Security model (summary)

- JWT access tokens (30 min) + rotating refresh tokens tracked by `jti`
  with revocation and reuse detection.
- Per-IP rate limits on `/api/auth/register|login|refresh`.
- Database credentials Fernet-encrypted at rest; keys supplied via
  environment and validated at startup.
- User-supplied SQL identifiers validated and dialect-quoted; filter
  fragments checked against a denylist (see `docs/adr/0002` for the
  residual-risk statement).
- Ownership scoping on every query; admin-only surfaces enforced by role.
- Dependency advisories audited in CI (pip-audit, npm audit) with
  Dependabot for updates.

## Hardening notes for deployments

- Run behind TLS (the bundled compose stack is plain HTTP on purpose,
  for local use).
- Keep `DEBUG=false` (also enables rate limits and JSON logs).
- Restrict `CORS_ORIGINS` to your real frontend origin.
