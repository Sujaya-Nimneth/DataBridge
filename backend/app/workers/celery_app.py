"""
Celery application configuration.
Uses Redis as both broker and result backend.
"""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "databridge_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.transfer_tasks"],
)

# Celery configuration
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Result expiration (24 hours)
    result_expires=86400,
    # Task execution limits
    task_soft_time_limit=3600,  # 1 hour soft limit
    task_time_limit=3900,  # 1 hour 5 min hard limit
    # Retry policy
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Track task state
    task_track_started=True,
    # Periodic maintenance: fail jobs whose worker died or dispatch failed
    beat_schedule={
        "reap-stale-transfers": {
            "task": "workers.reap_stale_transfers",
            "schedule": 900.0,  # every 15 minutes
        },
    },
)
