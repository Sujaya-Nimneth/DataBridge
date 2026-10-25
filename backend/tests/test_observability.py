"""
Operational behaviour: deep health checks and request IDs.
"""


class _FakeConnection:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def execute(self, *_args, **_kwargs):
        return None


class _FakeEngine:
    def connect(self):
        return _FakeConnection()


class _FakeRedis:
    async def ping(self):
        return True

    async def aclose(self):
        return None


async def test_health_reports_dependency_status(client, monkeypatch):
    """/health must actually probe the database and Redis."""
    import app.main as main_module

    class _BrokenEngine:
        def connect(self):
            raise RuntimeError("database unreachable")

    def _broken_redis(*_args, **_kwargs):
        raise RuntimeError("redis unreachable")

    monkeypatch.setattr(main_module, "engine", _BrokenEngine())
    monkeypatch.setattr("redis.asyncio.from_url", _broken_redis)

    response = await client.get("/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unhealthy"
    assert body["checks"]["database"] == "down"
    assert body["checks"]["redis"] == "down"


async def test_health_returns_200_when_dependencies_up(client, monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(main_module, "engine", _FakeEngine())
    monkeypatch.setattr("redis.asyncio.from_url", lambda *_a, **_k: _FakeRedis())

    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "version": main_module.settings.APP_VERSION,
        "checks": {"database": "up", "redis": "up"},
    }


async def test_responses_carry_request_ids(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    # a caller-supplied ID is honoured
    response = await client.get("/", headers={"X-Request-ID": "trace-123"})
    assert response.headers["X-Request-ID"] == "trace-123"


async def test_health_is_unauthenticated(client):
    """/health must be reachable without a token for load balancers."""
    response = await client.get("/health")
    assert response.status_code != 401
