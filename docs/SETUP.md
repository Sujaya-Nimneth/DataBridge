# Environment Setup Guide

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Docker | 20.10+ | Container runtime |
| Docker Compose | 2.0+ | Multi-container orchestration |
| Python | 3.11+ | Backend (if running without Docker) |
| Node.js | 20+ | Frontend (if running without Docker) |
| PostgreSQL | 14+ | Application database (if running without Docker) |
| Redis | 7+ | Celery broker (if running without Docker) |

---

## Option 1: Docker Compose (Recommended)

This is the fastest way to get the entire platform running.

### Step 1: Clone and navigate

```bash
git clone <repository-url>
cd "recruitment task-EraBiz"
```

### Step 2: Start all services

```bash
docker compose up --build
```

This command:
1. Builds the backend Docker image (Python 3.11 + dependencies)
2. Builds the frontend Docker image (Node 20 + dependencies)
3. Starts PostgreSQL 16 (application database)
4. Starts Redis 7 (Celery broker)
5. Starts the FastAPI backend (port 8000)
6. Starts the Celery worker
7. Starts the Vite dev server (port 5173)

### Step 3: Verify services

| Service | URL | Expected |
|---------|-----|----------|
| Frontend | http://localhost:5173 | Login page |
| Backend | http://localhost:8000 | JSON health check |
| API Docs | http://localhost:8000/docs | Swagger UI |

### Step 4: Stop services

```bash
docker compose down        # Stop containers
docker compose down -v     # Stop + remove volumes (wipes database)
```

---

## Option 2: Manual Setup

### Step 1: Set up PostgreSQL

Create the application database:

```bash
# If using Docker for just PostgreSQL:
docker run -d --name databridge-db \
  -e POSTGRES_USER=databridge \
  -e POSTGRES_PASSWORD=databridge \
  -e POSTGRES_DB=databridge \
  -p 5432:5432 \
  postgres:16-alpine

# Or if you have PostgreSQL installed locally:
createdb -U postgres databridge
psql -U postgres -c "CREATE USER databridge WITH PASSWORD 'databridge';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE databridge TO databridge;"
```

### Step 2: Set up Redis

```bash
# Using Docker:
docker run -d --name databridge-redis -p 6379:6379 redis:7-alpine

# Or install locally:
# macOS: brew install redis && redis-server
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
```

### Step 3: Set up the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

**Edit `.env` with your settings:**

```env
# Database
DATABASE_URL=postgresql+asyncpg://databridge:databridge@localhost:5432/databridge
DATABASE_SYNC_URL=postgresql+psycopg2://databridge:databridge@localhost:5432/databridge

# Redis
REDIS_URL=redis://localhost:6379/0

# Security (generate new keys for production!)
SECRET_KEY=your-secret-key-at-least-32-characters-long
ENCRYPTION_KEY=your-fernet-encryption-key
```

**Generate secure keys:**

```python
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Generate ENCRYPTION_KEY (Fernet key)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Start the API server:**

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Start the Celery worker** (separate terminal):

```bash
cd backend
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
```

### Step 4: Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | DataBridge | Application name |
| `APP_VERSION` | 1.0.0 | Application version |
| `DEBUG` | false | Enable debug mode |
| `DATABASE_URL` | (required) | Async PostgreSQL URL |
| `DATABASE_SYNC_URL` | (required) | Sync PostgreSQL URL |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection URL |
| `SECRET_KEY` | (required) | JWT signing key (min 32 chars) |
| `ENCRYPTION_KEY` | (required) | Fernet encryption key |
| `JWT_ALGORITHM` | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token TTL |
| `CORS_ORIGINS` | ["http://localhost:5173"] | Allowed CORS origins (JSON array) |
| `TRANSFER_BATCH_SIZE` | 1000 | Rows per transfer batch |
| `TRANSFER_MAX_PREVIEW_ROWS` | 100 | Max preview rows |
| `POOL_SIZE` | 5 | SQLAlchemy pool size |
| `MAX_OVERFLOW` | 10 | SQLAlchemy max overflow |

---

## Database Migrations

The application auto-creates tables on startup. For production, use Alembic:

```bash
cd backend

# Generate migration
alembic revision --autogenerate -m "describe your change"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## Troubleshooting

### Port conflicts

If ports 5432, 6379, 8000, or 5173 are in use:

```bash
# Check what's using a port
lsof -i :5432

# Change ports in docker-compose.yml or .env files
```

### Database connection issues

```bash
# Verify PostgreSQL is running
docker exec -it databridge-db pg_isready

# Check logs
docker compose logs db
```

### Celery worker not processing

```bash
# Check Redis connection
docker exec -it databridge-redis redis-cli ping

# Check worker logs
docker compose logs worker
```

### Frontend proxy issues

Ensure `vite.config.js` proxy target matches the backend URL:
```js
proxy: {
  '/api': { target: 'http://localhost:8000' }
}
```
