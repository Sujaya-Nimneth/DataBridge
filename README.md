# DataBridge - Data Connectivity & Transfer Platform

<p align="center">
  <strong>A full-stack web application for connecting to multiple database systems, exploring data structures, and transferring data between sources.</strong>
</p>

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **🔐 Secure Authentication** | JWT-based auth with bcrypt password hashing and Fernet-encrypted credential storage |
| **🔌 Connection Management** | Add, edit, test, and remove PostgreSQL & MySQL connections |
| **🔍 Data Discovery** | Explore schemas, tables, views, columns with metadata and data preview |
| **🔄 Data Transfer** | Move data between databases with progress tracking, filtering, and column mapping |
| **📊 Monitoring Dashboard** | Real-time stats, connection health, activity feed, and operational metrics |
| **⚡ Background Processing** | Celery workers for async transfer execution with Redis broker |
| **🐳 Containerized** | Full Docker Compose setup for one-command deployment |

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────────────────────┐     ┌─────────────────┐
│                 │     │         Backend (FastAPI)          │     │                 │
│   React SPA     │────▶│  Auth │ Connections │ Discovery   │────▶│   PostgreSQL    │
│   (Vite)        │     │  Transfers │ Monitoring            │     │   (App DB)      │
│                 │     │                                    │     │                 │
│  Port: 5173     │     │  Port: 8000                        │     │  Port: 5432     │
└─────────────────┘     └──────────────┬───────────────────┘     └─────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │    Celery Workers         │
                        │    (Background Tasks)     │
                        │                          │
                        │  Redis Broker (Port 6379) │
                        └──────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
                   ┌──────────┐              ┌──────────┐
                   │PostgreSQL│              │  MySQL   │
                   │(User DB) │              │(User DB) │
                   └──────────┘              └──────────┘
```

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11)
- **ORM**: SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL (application data)
- **Auth**: JWT (python-jose) + bcrypt (passlib)
- **Encryption**: Fernet (cryptography)
- **Background Tasks**: Celery + Redis
- **Migrations**: Alembic
- **API Docs**: Swagger UI (built-in with FastAPI)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 6
- **Routing**: React Router v6
- **HTTP Client**: Axios (with JWT interceptors)
- **Styling**: Vanilla CSS (custom design system)
- **Notifications**: react-hot-toast
- **Icons**: react-icons

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Message Broker**: Redis 7
- **Database**: PostgreSQL 16

---

## ⚡ Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Git

### 1. Clone the repository
```bash
git clone <repository-url>
cd DataBridge
```

### 2. Configure secrets
The API refuses to start with placeholder secrets, so set real values first:
```bash
cat > .env <<'EOF'
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
EOF
```
Docker Compose reads these variables from the environment or a `.env` file next
to `docker-compose.yml`.

### 3. Start all services with Docker Compose
```bash
docker compose up --build
```

This starts 5 services:
| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React application |
| **Backend API** | http://localhost:8000 | FastAPI server |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **PostgreSQL** | localhost:5432 | Application database |
| **Redis** | localhost:6379 | Celery broker |

### 4. Create an account
Navigate to http://localhost:5173 and register a new account.

### 5. Add your first database connection
Go to **Connections** → **Add Connection** and enter your database details.

---

## 📁 Manual Setup (Without Docker)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Apply database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Start Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend

# Install dependencies
npm ci

# Start dev server
npm run dev
```

### Tests

```bash
cd backend
python -m pytest
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, component architecture, and design decisions |
| [API Reference](docs/API.md) | Complete REST API documentation |
| [Setup Guide](docs/SETUP.md) | Detailed environment configuration and deployment guide |
| [Swagger UI](http://localhost:8000/docs) | Interactive API documentation (when running) |

---

## 📐 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, connections, discovery, transfers, monitoring)
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Business logic layer
│   │   ├── workers/      # Celery background tasks
│   │   ├── middleware/   # Error handling
│   │   ├── config.py     # Application settings
│   │   ├── database.py   # Database engine & session
│   │   ├── security.py   # JWT, encryption, password hashing
│   │   └── main.py       # FastAPI entry point
│   ├── alembic/          # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios client & API modules
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context (auth)
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Page components
│   │   ├── App.jsx       # Root component with routing
│   │   ├── main.jsx      # Entry point
│   │   └── index.css     # Design system
│   ├── package.json
│   └── Dockerfile
├── docs/                 # Documentation
├── docker-compose.yml
└── README.md
```

---

## 🔑 Security Features

1. **JWT Authentication** — Short-lived access tokens (30 min) + refresh tokens (7 days)
2. **Password Hashing** — bcrypt via passlib
3. **Credential Encryption** — Fernet symmetric encryption for stored database credentials
4. **CORS Protection** — Configured allowed origins
5. **Input Validation** — Pydantic schemas for all API inputs
6. **SQL Injection Prevention** — Parameterized queries via SQLAlchemy
7. **Error Handling** — Structured error responses without leaking internals

---

## 🧪 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **FastAPI over Django** | I needed async support and built-in API docs — FastAPI handles I/O-heavy DB operations much better |
| **Celery for transfers** | Transfers can run for minutes on large tables, so they need proper background processing with retry support |
| **Fernet encryption** | The app needs to decrypt credentials to connect to user databases — symmetric encryption fits this use case, with the key stored separately in env vars |
| **SQLAlchemy inspect()** | Lets me reflect any user database schema dynamically without knowing its structure ahead of time |
| **Vanilla CSS** | Gives me full control over the dark-theme glassmorphism design without any framework overhead |
| **Batch processing** | Without batching, a 10M-row transfer would exhaust memory — configurable batch sizes keep it safe |

---

## 📝 License

MIT
