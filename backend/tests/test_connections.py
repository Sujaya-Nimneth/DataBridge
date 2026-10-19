"""Connection management, ownership isolation and delete policy."""

from uuid import UUID

import pytest
from sqlalchemy import select

from app.models.transfer import TransferJob
from app.models.user import User

pytestmark = pytest.mark.asyncio

CONNECTION = {
    "name": "Local PG",
    "db_type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database_name": "app",
    "username": "postgres",
    "password": "p@ss:word/with#specials",
    "ssl_enabled": True,
}


async def _create_connection(client, headers, **overrides):
    payload = {**CONNECTION, **overrides}
    response = await client.post("/api/connections", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_and_list_connections(client, auth_headers):
    created = await _create_connection(client, auth_headers)

    assert created["name"] == CONNECTION["name"]
    assert created["db_type"] == "postgresql"
    assert created["last_test_status"] == "unknown"
    # Passwords are never returned to the client.
    assert "password" not in created

    listing = await client.get("/api/connections", headers=auth_headers)
    assert listing.status_code == 200
    assert [c["id"] for c in listing.json()] == [created["id"]]


async def test_credentials_are_encrypted_at_rest(client, auth_headers, session_factory):
    from app.models.connection import DatabaseConnection
    from app.security import decrypt_value

    created = await _create_connection(client, auth_headers)

    async with session_factory() as session:
        row = (
            await session.execute(
                select(DatabaseConnection).where(
                    DatabaseConnection.id == UUID(created["id"])
                )
            )
        ).scalar_one()

        assert row.password != CONNECTION["password"]
        assert decrypt_value(row.password) == CONNECTION["password"]
        assert row.ssl_enabled is True


async def test_connection_url_escapes_special_characters(client, auth_headers, session_factory):
    from app.models.connection import DatabaseConnection
    from app.services.connection_service import ConnectionService

    created = await _create_connection(client, auth_headers)

    async with session_factory() as session:
        row = (
            await session.execute(
                select(DatabaseConnection).where(
                    DatabaseConnection.id == UUID(created["id"])
                )
            )
        ).scalar_one()
        url = ConnectionService(session).build_url(row)

    # URL.create keeps the password intact as an attribute while escaping the
    # characters that would otherwise corrupt the DSN.
    assert url.password == CONNECTION["password"]
    rendered = url.render_as_string(hide_password=False)
    assert "p%40ss%3Aword%2Fwith%23specials" in rendered
    # Exactly one @ separates credentials from the host, so a password
    # containing @ cannot shift the host boundary.
    assert rendered.count("@") == 1
    assert url.host == "localhost"


async def test_ssl_is_applied_to_connect_args(client, auth_headers, session_factory):
    from app.models.connection import DatabaseConnection
    from app.services.connection_service import ConnectionService

    created = await _create_connection(client, auth_headers)

    async with session_factory() as session:
        row = (
            await session.execute(
                select(DatabaseConnection).where(
                    DatabaseConnection.id == UUID(created["id"])
                )
            )
        ).scalar_one()
        args = ConnectionService.connect_args(row)

    assert args["sslmode"] == "require"


async def test_other_users_cannot_read_a_connection(client, auth_headers):
    created = await _create_connection(client, auth_headers)

    other = await client.post(
        "/api/auth/register",
        json={
            "email": "other@example.com",
            "password": "supersecret123",
            "full_name": "Other User",
        },
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = await client.get(
        f"/api/connections/{created['id']}", headers=other_headers
    )
    assert response.status_code == 404

    listing = await client.get("/api/connections", headers=other_headers)
    assert listing.json() == []


async def test_deleting_a_connection_with_transfers_is_blocked(
    client, auth_headers, session_factory
):
    created = await _create_connection(client, auth_headers)
    target = await _create_connection(client, auth_headers, name="Target")

    async with session_factory() as session:
        user = (await session.execute(select(User))).scalars().first()
        session.add(
            TransferJob(
                user_id=user.id,
                source_connection_id=UUID(created["id"]),
                source_table="orders",
                target_connection_id=UUID(target["id"]),
                target_table="orders",
            )
        )
        await session.commit()

    response = await client.delete(
        f"/api/connections/{created['id']}", headers=auth_headers
    )

    assert response.status_code == 409
    assert "transfer" in response.json()["message"].lower()


async def test_deleting_an_unused_connection_succeeds(client, auth_headers):
    created = await _create_connection(client, auth_headers)

    response = await client.delete(
        f"/api/connections/{created['id']}", headers=auth_headers
    )

    assert response.status_code == 200
    listing = await client.get("/api/connections", headers=auth_headers)
    assert listing.json() == []


async def test_invalid_filter_is_rejected_on_preview(client, auth_headers):
    created = await _create_connection(client, auth_headers)

    response = await client.get(
        f"/api/discovery/{created['id']}/tables/orders/preview",
        params={"filter_query": "1=1; DROP TABLE users"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "disallowed" in response.json()["message"].lower()
