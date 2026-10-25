# Contributing to DataBridge

Thanks for your interest in improving DataBridge.

## Development setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # DEBUG=true works out of the box

# Frontend
cd frontend
npm install

# Local hooks (optional but recommended)
pip install pre-commit && pre-commit install
```

## Everyday commands

| Task | Command |
|------|---------|
| Backend tests + coverage | `cd backend && python -m pytest` |
| Backend lint / format | `ruff check . && ruff format --check .` |
| Backend types | `mypy app` |
| Frontend tests | `cd frontend && npm test` |
| Frontend lint / format | `npm run lint && npm run format:check` |
| Full stack (hot reload) | `docker compose -f docker-compose.dev.yml up` |

All of these run in CI on every pull request; run them locally before
pushing.

## Making changes

- **Branch** from `main`, keep commits focused, use conventional commit
  messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Schema changes** must ship as an Alembic migration
  (`alembic revision --autogenerate -m "..."`). `create_all` only runs
  in DEBUG (see `docs/adr/0004`).
- **New dependencies** must be pinned exactly and justified — runtime
  deps go in `backend/requirements.txt`, dev tooling in
  `backend/requirements-dev.txt`. `pip-audit`/`npm audit` run in CI.
- **Tests** are expected with behaviour changes. The transfer worker is
  tested end-to-end against SQLite databases
  (`tests/test_transfer_worker.py`) — extend that suite when changing
  the transfer engine.

## Security issues

Do not open public issues for security problems — see `SECURITY.md`.
