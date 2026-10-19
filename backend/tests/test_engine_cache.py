"""Remote engine cache behaviour."""

from sqlalchemy import create_engine

from app.services.engine_cache import EngineCache


def _engine():
    return create_engine("sqlite://")


def test_cache_returns_engine_for_matching_fingerprint():
    cache = EngineCache()
    engine = _engine()
    cache.put("a", ("fp",), engine)

    assert cache.get("a", ("fp",)) is engine


def test_cache_evicts_when_fingerprint_changes():
    cache = EngineCache()
    engine = _engine()
    cache.put("a", ("fp",), engine)

    assert cache.get("a", ("other",)) is None
    # The stale engine must not be reusable under the new credentials.
    assert cache.get("a", ("fp",)) is None


def test_invalidate_drops_the_entry():
    cache = EngineCache()
    cache.put("a", ("fp",), _engine())

    cache.invalidate("a")

    assert cache.get("a", ("fp",)) is None


def test_cache_evicts_oldest_entry_beyond_capacity():
    cache = EngineCache(max_entries=2)
    cache.put("a", ("fp",), _engine())
    cache.put("b", ("fp",), _engine())
    cache.put("c", ("fp",), _engine())

    assert cache.get("c", ("fp",)) is not None
    assert cache.get("a", ("fp",)) is None


def test_expired_entries_are_not_returned():
    cache = EngineCache(ttl=-1)
    cache.put("a", ("fp",), _engine())

    assert cache.get("a", ("fp",)) is None


def test_clear_disposes_everything():
    cache = EngineCache()
    cache.put("a", ("fp",), _engine())
    cache.put("b", ("fp",), _engine())

    cache.clear()

    assert cache.get("a", ("fp",)) is None
    assert cache.get("b", ("fp",)) is None
