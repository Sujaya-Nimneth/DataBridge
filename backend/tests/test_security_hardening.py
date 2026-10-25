"""
Security hardening tests: filter denylist, identifier validation,
refresh-token rotation/revocation, rate limiting and error sanitisation.
"""

from app.rate_limit import limiter
from app.security import encrypt_value
from app.services.connection_service import _safe_connection_error
from app.sql_utils import (
    InvalidIdentifierError,
    UnsafeFilterError,
    validate_filter_query,
    validate_identifier,
)

# --- Filter hardening ---


def test_filter_rejects_dangerous_functions():
    for payload in (
        "id = 1 AND pg_sleep(10)",
        "id = 1 OR SLEEP(5)",
        "id = 1 AND BENCHMARK(5000000, MD5('x'))",
        "id = 1 AND WAITFOR DELAY '0:0:5'",
        "name = load_file('/etc/passwd')",
        "id = 1 AND pg_read_file('postgresql.conf') = 'x'",
    ):
        try:
            validate_filter_query(payload)
        except UnsafeFilterError:
            continue
        raise AssertionError(f"filter should have been rejected: {payload}")


def test_filter_accepts_legitimate_predicates():
    assert validate_filter_query("score >= 50") == "score >= 50"
    assert validate_filter_query("name = 'alice' AND created_at > '2026-01-01'")


# --- Identifier validation ---


def test_validate_identifier_accepts_plain_names():
    assert validate_identifier("users", "table") == "users"
    assert validate_identifier("_order_items_2", "table") == "_order_items_2"


def test_validate_identifier_rejects_injection_attempts():
    for bad in (
        'users"; DROP TABLE x; --',
        "users` WHERE 1=1 --",
        "public.users",
        "user names",
        "users;--",
        "üser",
        "",
        "a" * 65,
    ):
        try:
            validate_identifier(bad, "table")
        except InvalidIdentifierError:
            continue
        raise AssertionError(f"identifier should have been rejected: {bad!r}")


async def test_transfer_create_rejects_malicious_table_name(client, auth_headers):
    """The schema layer bounces SQL smuggled through identifiers as a 422."""
    response = await client.post(
        "/api/transfers",
        headers=auth_headers,
        json={
            "source_connection_id": "00000000-0000-0000-0000-000000000000",
            "source_table": 'users"; DROP TABLE x; --',
            "target_connection_id": "00000000-0000-0000-0000-000000000000",
            "target_table": "users_copy",
        },
    )
    assert response.status_code == 422
    assert "identifiers must match" in response.text


async def test_transfer_create_rejects_malicious_column_mapping(client, auth_headers):
    response = await client.post(
        "/api/transfers",
        headers=auth_headers,
        json={
            "source_connection_id": "00000000-0000-0000-0000-000000000000",
            "source_table": "users",
            "target_connection_id": "00000000-0000-0000-0000-000000000000",
            "target_table": "users_copy",
            "column_mappings": {"id": "x`; DELETE FROM users; --"},
        },
    )
    assert response.status_code == 422


async def test_discovery_rejects_malicious_table_name(client, auth_headers):
    """Identifier errors surface as 400, not 500."""
    response = await client.post(
        "/api/connections",
        headers=auth_headers,
        json={
            "name": "local",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database_name": "app",
            "username": "app",
            "password": "secret",
        },
    )
    assert response.status_code == 201, response.text
    connection_id = response.json()["id"]

    response = await client.get(
        f'/api/discovery/{connection_id}/tables/evil";--/columns',
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "table_name" in response.json()["message"]


# --- Refresh token rotation & revocation ---


async def _register(client, email):
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "supersecret123", "full_name": "T"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_refresh_token_rotates_and_reuse_revokes_everything(client):
    tokens = await _register(client, "rotate@example.com")

    first_refresh = await client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert first_refresh.status_code == 200
    rotated = first_refresh.json()["refresh_token"]
    assert rotated != tokens["refresh_token"]

    # Replaying the original (now rotated) token must fail...
    replay = await client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert replay.status_code == 401

    # ...and reuse detection must have killed the rotated successor too.
    successor = await client.post("/api/auth/refresh", json={"refresh_token": rotated})
    assert successor.status_code == 401


async def test_logout_revokes_refresh_tokens(client):
    tokens = await _register(client, "logout@example.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.post("/api/auth/logout", headers=headers)
    assert response.status_code == 200

    refresh = await client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401


async def test_logout_requires_authentication(client):
    assert (await client.post("/api/auth/logout")).status_code == 401


# --- Rate limiting ---


async def test_login_rate_limit(client):
    was_enabled = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    try:
        responses = [
            await client.post(
                "/api/auth/login",
                json={"email": "nobody@example.com", "password": "wrong-password"},
            )
            for _ in range(11)
        ]
        assert all(r.status_code in (401, 429) for r in responses)
        assert responses[-1].status_code == 429
        assert "Too many requests" in responses[-1].json()["message"]
    finally:
        limiter.enabled = was_enabled
        limiter.reset()


# --- Error sanitisation ---


def test_safe_connection_error_scrubs_credentials():
    raw = (
        'connection to server at "postgres.example.com" (10.0.0.5), port 5432 failed: '
        'FATAL: password authentication failed for user "appuser"\n'
        "(postgresql://appuser:sup3rsecret@postgres.example.com:5432/app)"
    )
    safe = _safe_connection_error(raw)
    assert "sup3rsecret" not in safe
    assert "appuser" not in safe or "password authentication failed" in safe
    assert "\n" not in safe


def test_safe_connection_error_handles_empty():
    assert _safe_connection_error("") == "unable to reach the database"


def test_stored_credentials_remain_encrypted():
    from app.security import decrypt_value

    token = encrypt_value("s3cr3t-value")
    assert "s3cr3t-value" not in token
    assert decrypt_value(token) == "s3cr3t-value"
