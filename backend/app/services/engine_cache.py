"""
Cache for synchronous engines pointing at user databases.

Discovery requests previously built a fresh engine (and TCP handshake) for
every call and disposed it immediately, so connection setup dominated the
latency of browsing a schema. Engines are now reused for a short TTL and
disposed on demand when a connection's credentials change or it is deleted.
"""

import threading
import time
from dataclasses import dataclass

from sqlalchemy.engine import Engine

_TTL_SECONDS = 300
_MAX_ENTRIES = 32


@dataclass
class _Entry:
    engine: Engine
    created_at: float
    fingerprint: tuple


class EngineCache:
    """Small thread-safe LRU-ish cache of remote engines keyed by connection."""

    def __init__(self, ttl: int = _TTL_SECONDS, max_entries: int = _MAX_ENTRIES):
        self._ttl = ttl
        self._max_entries = max_entries
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()

    def get(self, key: str, fingerprint: tuple) -> Engine | None:
        """Return a live engine whose credentials still match ``fingerprint``."""
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.fingerprint != fingerprint or now - entry.created_at > self._ttl:
                self._entries.pop(key, None)
                entry.engine.dispose()
                return None
            return entry.engine

    def put(self, key: str, fingerprint: tuple, engine: Engine) -> Engine:
        """Store an engine, evicting the oldest entry when the cache is full."""
        with self._lock:
            existing = self._entries.pop(key, None)
            if existing is not None:
                existing.engine.dispose()

            while len(self._entries) >= self._max_entries:
                oldest_key = min(self._entries, key=lambda k: self._entries[k].created_at)
                self._entries.pop(oldest_key).engine.dispose()

            self._entries[key] = _Entry(
                engine=engine, created_at=time.monotonic(), fingerprint=fingerprint
            )
        return engine

    def invalidate(self, key: str) -> None:
        """Dispose and forget the engine for a connection."""
        with self._lock:
            entry = self._entries.pop(key, None)
        if entry is not None:
            entry.engine.dispose()

    def clear(self) -> None:
        """Dispose every cached engine."""
        with self._lock:
            entries = list(self._entries.values())
            self._entries.clear()
        for entry in entries:
            entry.engine.dispose()


engine_cache = EngineCache()
