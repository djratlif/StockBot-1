from app.models.database import SessionLocal
from app.models.models import ActivityLog

db = SessionLocal()
logs = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(20).all()
for log in logs:
    print(f"[{log.timestamp}] {log.action}: {log.details}")
db.close()
