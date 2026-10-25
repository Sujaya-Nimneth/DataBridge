"""End-to-end smoke coverage of the monitoring and transfer APIs."""

import pytest
from sqlalchemy import select

from app.enums import LogLevel, TransferStatus
from app.models.connection import DatabaseConnection
from app.models.transfer import TransferJob, TransferLog
from app.models.user import User

pytestmark = pytest.mark.asyncio


async def _seed_transfer(session_factory, status=TransferStatus.COMPLETED, rows=120):
    async with session_factory() as session:
        user = (await session.execute(select(User))).scalars().first()
        source = DatabaseConnection(
            user_id=user.id,
            name="Source",
            db_type="postgresql",
            host="enc",
            port=5432,
            database_name="src",
            username="enc",
            password="enc",
        )
        target = DatabaseConnection(
            user_id=user.id,
            name="Target",
            db_type="postgresql",
            host="enc",
            port=5432,
            database_name="tgt",
            username="enc",
            password="enc",
        )
        session.add_all([source, target])
        await session.flush()

        job = TransferJob(
            user_id=user.id,
            source_connection_id=source.id,
            source_table="orders",
            target_connection_id=target.id,
            target_table="orders",
            status=status,
            total_rows=rows,
            transferred_rows=rows,
        )
        session.add(job)
        await session.flush()
        session.add(
            TransferLog(
                transfer_job_id=job.id,
                level=LogLevel.INFO,
                message="seeded",
            )
        )
        await session.commit()
        return job.id


async def test_dashboard_aggregates_transfers(client, auth_headers, session_factory):
    await _seed_transfer(session_factory)

    response = await client.get("/api/monitoring/dashboard", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_transfers"] == 1
    assert body["success_rate"] == 100.0
    assert body["total_rows_transferred"] == 120


async def test_metrics_returns_seven_days(client, auth_headers, session_factory):
    await _seed_transfer(session_factory)

    response = await client.get("/api/monitoring/metrics", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body["daily_transfers"]) == 7
    assert sum(day["count"] for day in body["daily_transfers"]) == 1
    assert body["status_counts"]["completed"] == 1
    assert set(body["status_counts"]) == {"pending", "running", "completed", "failed", "cancelled"}


async def test_activity_feed_includes_connection_names(client, auth_headers, session_factory):
    await _seed_transfer(session_factory)

    response = await client.get("/api/monitoring/activity", headers=auth_headers)

    assert response.status_code == 200
    activity = response.json()
    assert len(activity) == 1
    assert "Source/orders" in activity[0]["description"]
    assert "Target/orders" in activity[0]["description"]


async def test_transfer_list_returns_connection_names(client, auth_headers, session_factory):
    await _seed_transfer(session_factory)

    response = await client.get("/api/transfers", headers=auth_headers)

    assert response.status_code == 200
    transfers = response.json()
    assert len(transfers) == 1
    assert transfers[0]["source_connection_name"] == "Source"
    assert transfers[0]["target_connection_name"] == "Target"


async def test_transfer_logs_are_ordered(client, auth_headers, session_factory):
    job_id = await _seed_transfer(session_factory)

    response = await client.get(f"/api/transfers/{job_id}/logs", headers=auth_headers)

    assert response.status_code == 200
    logs = response.json()
    assert [log["message"] for log in logs] == ["seeded"]
    assert logs[0]["level"] == "info"


async def test_other_users_cannot_read_a_transfer(client, auth_headers, session_factory):
    job_id = await _seed_transfer(session_factory)

    other = await client.post(
        "/api/auth/register",
        json={
            "email": "stranger@example.com",
            "password": "supersecret123",
            "full_name": "Stranger",
        },
    )
    headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    assert (await client.get(f"/api/transfers/{job_id}", headers=headers)).status_code == 404
    assert (await client.get(f"/api/transfers/{job_id}/logs", headers=headers)).status_code == 404
    cancel = await client.post(f"/api/transfers/{job_id}/cancel", headers=headers)
    assert cancel.status_code == 404


async def test_cancelling_a_completed_transfer_is_rejected(client, auth_headers, session_factory):
    job_id = await _seed_transfer(session_factory)

    response = await client.post(f"/api/transfers/{job_id}/cancel", headers=auth_headers)

    assert response.status_code == 400


async def test_invalid_transfer_filter_is_rejected(client, auth_headers):
    response = await client.post(
        "/api/transfers",
        json={
            "source_connection_id": "00000000-0000-0000-0000-000000000001",
            "source_table": "orders",
            "target_connection_id": "00000000-0000-0000-0000-000000000002",
            "target_table": "orders",
            "filter_query": "1=1; DROP TABLE users",
        },
        headers=auth_headers,
    )

    assert response.status_code == 400
