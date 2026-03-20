import asyncio
from app.models.database import SessionLocal
from app.services.email_service import email_service

async def main():
    db = SessionLocal()
    success = await email_service.send_daily_report(db)
    print(f"Email sent successfully: {success}")
    db.close()

asyncio.run(main())
