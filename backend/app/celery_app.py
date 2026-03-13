from celery import Celery
import os
from dotenv import load_dotenv
from app.config import settings

load_dotenv()

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery app
celery_app = Celery(
    'stockbot_tasks',
    broker=redis_url,
    backend=redis_url,
    include=['app.tasks.trading_tasks']
)

# Optional configuration, see the application user guide.
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],  # Ignore other content
    result_serializer='json',
    timezone='America/New_York',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    task_always_eager=False,  # Always use Redis queue even in dev locally
)
