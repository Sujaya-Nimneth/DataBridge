"""Authentication and authorization behaviour."""

import pytest

pytestmark = pytest.mark.asyncio


async def test_register_returns_tokens_and_profile(client):
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "new@example.com",
            "password": "supersecret123",
            "full_name": "New User",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["email"] == "new@example.com"


async def test_duplicate_email_is_rejected(client, auth_headers):
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "tester@example.com",
            "password": "supersecret123",
            "full_name": "Someone Else",
        },
    )

    assert response.status_code == 409


async def test_login_with_wrong_password_is_rejected(client, auth_headers):
    response = await client.post(
        "/api/auth/login",
        json={"email": "tester@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401


async def test_login_succeeds_with_correct_password(client, auth_headers):
    response = await client.post(
        "/api/auth/login",
        json={"email": "tester@example.com", "password": "supersecret123"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["full_name"] == "Test User"


async def test_protected_route_requires_a_token(client):
    response = await client.get("/api/connections")

    assert response.status_code in (401, 403)


async def test_me_returns_the_authenticated_user(client, auth_headers):
    response = await client.get("/api/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "tester@example.com"


async def test_refresh_token_cannot_be_used_as_access_token(client, auth_headers):
    tokens = await client.post(
        "/api/auth/login",
        json={"email": "tester@example.com", "password": "supersecret123"},
    )
    refresh_token = tokens.json()["refresh_token"]

    response = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {refresh_token}"}
    )

    assert response.status_code == 401
    assert "token type" in response.json()["message"].lower()
