"""
Per-IP rate limiting for abuse-prone endpoints (login, register, refresh).

Disabled in DEBUG mode so development and the test suite are unaffected;
production deployments always run with it enabled.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=not settings.DEBUG,
)
