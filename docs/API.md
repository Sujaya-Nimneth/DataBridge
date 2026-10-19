# API Documentation

## Base URL

```
http://localhost:8000/api
```

## Authentication

All endpoints except registration and login require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Interactive documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Endpoints

### Authentication

#### POST `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

**Response (201):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST `/api/auth/login`

Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):** Same as register response.

#### POST `/api/auth/refresh`

Refresh an expired access token.

**Request Body:**
```json
{
  "refresh_token": "eyJ..."
}
```

#### GET `/api/auth/me`

Get current user profile. **Requires authentication.**

---

### Connections

#### GET `/api/connections`

List all database connections for the authenticated user.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Production DB",
    "db_type": "postgresql",
    "host": "db.example.com",
    "port": 5432,
    "database_name": "mydb",
    "username": "admin",
    "ssl_enabled": false,
    "is_active": true,
    "last_test_status": "success",
    "last_tested_at": "2024-01-01T00:00:00Z",
    "last_test_message": "Connected successfully (12.5ms)",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST `/api/connections`

Create a new database connection. Credentials are encrypted before storage.

**Request Body:**
```json
{
  "name": "Production DB",
  "db_type": "postgresql",
  "host": "db.example.com",
  "port": 5432,
  "database_name": "mydb",
  "username": "admin",
  "password": "secretpassword",
  "ssl_enabled": false
}
```

**Supported `db_type` values:** `postgresql`, `mysql`

When `ssl_enabled` is `true` the driver connects with `sslmode=require`
(PostgreSQL) or TLS enabled (MySQL). Credentials are encrypted at rest and are
never returned by the API; `host` and `username` are returned decrypted for
display.

#### GET `/api/connections/{id}`

Get details of a specific connection.

#### PUT `/api/connections/{id}`

Update a connection. All fields are optional. Password can be omitted to keep the current value.

#### DELETE `/api/connections/{id}`

Delete a connection.

Returns **409 Conflict** when any transfer job references the connection,
because deleting it would destroy transfer history. Delete those transfers
first, or keep the connection.

#### POST `/api/connections/{id}/test`

Test database connectivity.

**Response (200):**
```json
{
  "success": true,
  "message": "Connection successful",
  "latency_ms": 12.5
}
```

---

### Data Discovery

#### GET `/api/discovery/{connection_id}/schemas`

List all schemas in a database (system schemas are filtered).

**Response (200):**
```json
[
  { "name": "public", "table_count": 15 },
  { "name": "analytics", "table_count": 8 }
]
```

#### GET `/api/discovery/{connection_id}/tables`

List tables and views in a schema.

**Query Parameters:**
- `schema` (optional) — Schema name. Defaults to `public` (PG) or database name (MySQL).

**Response (200):**
```json
[
  { "name": "users", "schema_name": "public", "type": "table" },
  { "name": "user_summary", "schema_name": "public", "type": "view" }
]
```

#### GET `/api/discovery/{connection_id}/tables/{table_name}/columns`

Get column metadata.

**Query Parameters:**
- `schema` (optional)

**Response (200):**
```json
[
  {
    "name": "id",
    "type": "INTEGER",
    "nullable": false,
    "default": "nextval('users_id_seq')",
    "is_primary_key": true,
    "is_foreign_key": false,
    "max_length": null
  }
]
```

#### GET `/api/discovery/{connection_id}/tables/{table_name}/preview`

> The optional `filter_query` parameter accepts a single SQL `WHERE` expression.
> Statement separators, comments, DDL/DML keywords and sub-queries are rejected
> with **400 Bad Request**. Results are ordered by primary key so pagination is
> stable, and values keep their native JSON types.

Preview data from a table with pagination.

**Query Parameters:**
- `schema` (optional)
- `page` (default: 1)
- `page_size` (default: 50, max: 100)
- `filter_query` (optional) — SQL WHERE clause

**Response (200):**
```json
{
  "columns": ["id", "name", "email"],
  "column_types": ["INTEGER", "VARCHAR(255)", "VARCHAR(255)"],
  "rows": [
    [1, "John", "john@example.com"],
    [2, "Jane", "jane@example.com"]
  ],
  "total_rows": 1500,
  "page": 1,
  "page_size": 50,
  "has_more": true
}
```

#### GET `/api/discovery/{connection_id}/tables/{table_name}/count`

Get total row count.

**Response (200):**
```json
{ "table": "users", "row_count": 1500 }
```

---

### Data Transfers

#### POST `/api/transfers`

Create and start a data transfer job. Runs asynchronously via Celery.

**Request Body:**
```json
{
  "source_connection_id": "uuid",
  "source_schema": "public",
  "source_table": "users",
  "target_connection_id": "uuid",
  "target_schema": "public",
  "target_table": "users_backup",
  "column_mappings": null,
  "filter_query": "status = 'active'",
  "create_target_table": true
}
```

#### GET `/api/transfers`

List transfer history.

**Query Parameters:**
- `status` (optional) — Filter by status: `pending`, `running`, `completed`, `failed`, `cancelled`
- `limit` (default: 50)
- `offset` (default: 0)

#### GET `/api/transfers/{id}`

Get detailed transfer info including real-time progress.

**Response includes `progress` for running transfers:**
```json
{
  "progress": {
    "status": "running",
    "total_rows": 10000,
    "transferred_rows": 4500,
    "percentage": 45.0,
    "elapsed_seconds": 12.5,
    "estimated_remaining_seconds": 15.3
  }
}
```

#### GET `/api/transfers/{id}/logs`

Get execution logs for a transfer.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "level": "info",
    "message": "Transfer started",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]
```

#### POST `/api/transfers/{id}/cancel`

Cancel a running or pending transfer.

---

### Monitoring

#### GET `/api/monitoring/dashboard`

Aggregated dashboard statistics.

**Response (200):**
```json
{
  "total_connections": 5,
  "active_connections": 3,
  "total_transfers": 42,
  "running_transfers": 1,
  "completed_today": 8,
  "failed_today": 0,
  "total_rows_transferred": 150000,
  "success_rate": 95.2
}
```

#### GET `/api/monitoring/connections/status`

Health status of all connections.

#### GET `/api/monitoring/activity`

Recent activity feed.

**Query Parameters:**
- `limit` (default: 20, max: 100)

#### GET `/api/monitoring/metrics`

Operational metrics including status distribution, daily counts, and average duration.

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": true,
  "status_code": 422,
  "message": "Validation error",
  "details": [
    {
      "field": "body → email",
      "message": "value is not a valid email address",
      "type": "value_error"
    }
  ]
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate email) |
| 422 | Validation Error |
| 500 | Internal Server Error |
