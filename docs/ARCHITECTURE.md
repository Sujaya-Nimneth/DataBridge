# Architecture Documentation

## System Overview

DataBridge follows a layered architecture separating the frontend, backend API, business logic, background processing, and data storage. Here's how everything fits together.

## Architecture Layers

### 1. Frontend (Presentation Layer)

**Technology**: React 18 + Vite

The frontend is a Single Page Application (SPA) that communicates with the backend exclusively through REST API calls.

**Component Architecture:**
```
App.jsx (Router + Auth Guard)
├── Sidebar.jsx (Navigation)
├── Login.jsx (Auth forms)
├── Dashboard.jsx (Stats + Activity)
├── Connections.jsx (CRUD + Test)
├── Explorer.jsx (Schema Tree + Preview)
├── Transfers.jsx (Wizard + History)
└── Monitoring.jsx (Metrics + Logs)
```

**Key Design Decisions:**
- **Vanilla CSS Design System**: I went with custom CSS over Tailwind/Bootstrap to have full control over the dark-theme glassmorphism design. It also avoids framework lock-in.
- **Context API for Auth**: React Context handles auth state well enough here. Pulling in Redux or Zustand would be overkill for managing a single user session.
- **Polling for Progress**: Transfer progress uses chained-`setTimeout` polling (see `usePolling`) so a slow response can never stack overlapping requests; in-flight requests are aborted on unmount. WebSockets would be more efficient at scale, but polling is simpler, reliable, and auto-stops when transfers finish.

---

### 2. API Layer (Routing)

**Technology**: FastAPI with APIRouter

Each domain area has its own router module:

| Module | Prefix | Responsibility |
|--------|--------|---------------|
| `auth.py` | `/api/auth` | Registration, login, token refresh/rotation, logout (rate limited) |
| `connections.py` | `/api/connections` | Connection CRUD + testing + activation |
| `discovery.py` | `/api/discovery` | Schema/table/column inspection |
| `transfers.py` | `/api/transfers` | Transfer job management |
| `monitoring.py` | `/api/monitoring` | Dashboard stats + metrics |
| `admin.py` | `/api/admin` | Admin-only platform views |

**Key Design Decisions:**
- **JWT Bearer Auth**: All protected routes use `HTTPBearer` dependency for token extraction. This keeps auth concerns separate from business logic.
- **Consistent Error Responses**: Global exception handlers ensure all errors return a uniform JSON structure: `{error, status_code, message}`.

---

### 3. Service Layer (Business Logic)

Each API route delegates to a corresponding service class that encapsulates business logic:

```
API Route → Service → ORM Models / External Connections
```

**Services:**
- **AuthService**: User registration, authentication, token management
- **ConnectionService**: CRUD, credential encryption/decryption, dynamic engine creation, connectivity testing
- **DiscoveryService**: Schema reflection using SQLAlchemy `inspect()`, data preview with pagination
- **TransferService**: Job creation, Celery dispatch, progress tracking, cancellation
- **MonitoringService**: Metric aggregation, connection health, activity feeds

**Key Design Decisions:**
- **Service per domain**: Keeps controllers thin and makes business logic independently testable.
- **Cached engines with fingerprints**: Each user connection gets its own SQLAlchemy engine, reused through a thread-safe cache (TTL + LRU cap) keyed by a credential fingerprint. Editing or deleting a connection invalidates its engine, so stale credentials never serve queries.

---

### 4. Data Access Layer

**Technology**: SQLAlchemy 2.0 (async) + PostgreSQL

**Models:**
```
User ──────┐
           ├──▶ DatabaseConnection ──┐
           │                         ├──▶ TransferJob ──▶ TransferLog
           └─────────────────────────┘
```

**Key Design Decisions:**
- **UUID Primary Keys**: UUIDs prevent enumeration attacks and make distributed ID generation possible down the road.
- **Encrypted Credentials**: Connection passwords and hostnames are Fernet-encrypted before storage. The encryption key lives in environment variables, keeping data and keys separate.
- **Async Sessions**: The app DB uses async SQLAlchemy sessions for non-blocking I/O. User database connections use sync engines because SQLAlchemy's `inspect()` requires them.

---

### 5. Background Processing Layer

**Technology**: Celery + Redis

Transfer execution runs in Celery workers to prevent blocking the API server during long-running data moves.

**Transfer Execution Flow:**
```
1. API creates TransferJob (status: pending)
2. Dispatches Celery task with job ID
3. Worker connects to source & target DBs
4. Validates identifiers + column mappings against the reflected source
5. Creates a per-job staging table on the target
6. Streams source rows into staging in batches (SSCursor on MySQL)
7. Checks for cancellation between batches
8. Publishes staged data atomically (rename, or DELETE+INSERT in one
   transaction when the target exists); failure/cancel drops staging
9. Updates progress via Celery state + app DB, with guarded status
   transitions so a late worker cannot overwrite CANCELLED
```

A Celery Beat task reaps jobs orphaned by crashed workers (RUNNING too
long) or failed dispatch (PENDING too long).

**Key Design Decisions:**
- **Celery over FastAPI BackgroundTasks**: FastAPI's built-in background tasks run in-process and are lost on restart. Celery gives me persistent queuing, retries, and proper state tracking.
- **Batch Processing**: Data moves in configurable batches (default 1000 rows) so large tables don't blow up memory.
- **Progress via Dual Channel**: Progress updates go to both Celery state (Redis) and the app database. This way progress survives worker restarts and stays accessible from any API instance.

---

## Security Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Security Layers                    │
├──────────────────────────────────────────────────────┤
│  1. CORS Policy       → Restrict allowed origins     │
│  2. Rate Limiting      → slowapi on auth endpoints    │
│  3. JWT Auth           → Verify identity per request  │
│  4. Token Rotation     → jti-tracked refresh tokens,  │
│                          reuse revokes all sessions   │
│  5. Input Validation   → Pydantic schema enforcement  │
│  6. Identifier Safety  → pattern + dialect quoting    │
│  7. Filter Validation  → WHERE-fragment denylist      │
│  8. Credential Encrypt → Fernet for stored passwords  │
│  9. Password Hashing   → bcrypt (one-way)            │
│ 10. SQL Safety         → SQLAlchemy parameterization  │
│ 11. Error Sanitization → No internal details in API   │
└──────────────────────────────────────────────────────┘
```

## Trade-offs & Assumptions

| Trade-off | Decision | Alternative |
|-----------|----------|------------|
| Polling vs WebSockets | Polling (simpler) | WebSockets for real-time updates |
| Sync schema reflection | SQLAlchemy inspect() requires sync | Could use raw async SQL queries |
| Single-process Celery | Sufficient for demo | Multi-worker with Flower monitoring |
| Filter validation style | Denylist + identifier pattern (see ADR-002) | SQL parser / read-only sessions |
| Transfer atomicity | Staging table + publish (see ADR-003) | Single huge transaction |
| LocalStorage for JWT | Simple implementation, mitigated by short access-token life + refresh rotation and revocation | HttpOnly cookies (more secure) |

## Scalability Considerations

1. **Horizontal API Scaling**: FastAPI is stateless; multiple instances behind a load balancer
2. **Worker Scaling**: Add more Celery workers for concurrent transfers
3. **Connection Pooling**: SQLAlchemy pool per user connection with configurable limits
4. **Database Partitioning**: Transfer logs could be partitioned by date for large volumes
5. **Caching**: Redis can cache schema metadata to reduce reflection overhead
