import asyncio
from app.models.database import SessionLocal
from app.services.email_service import email_service

async def test_email():
    print("Connecting to database...")
    db = SessionLocal()
    try:
        print("Triggering daily report dispatch...")
        success = await email_service.send_daily_report(db)
        if success:
            print("Success! The email was sent to your inbox.")
        else:
            print("Failed. The SMTP configuration might be invalid or missing.")
    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_email())
