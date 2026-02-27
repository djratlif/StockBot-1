from app.celery_app import celery_app
import asyncio
from app.models.database import SessionLocal
from app.models.models import BotConfig, ActivityLog, AllocationType
import logging
from datetime import datetime
import pytz

logger = logging.getLogger(__name__)

# To run the async loop within a synchronous celery task
def run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Eager mode: We are already inside a running asyncio loop (FastAPI worker)
        # We can't use run_until_complete, so we just return the corollary to be awaited
        # or run it as a task. In eager mode context, triggering is fire-and-forget anyway.
        task = loop.create_task(coro)
        return "Dispatched to running loop"
    else:
        # Standard Celery worker mode
        return asyncio.run(coro)

@celery_app.task(name='execute_trading_cycle')
def execute_trading_cycle():
    """Background task to execute a single cycle of the trading bot"""
    from app.services.trading_bot_service import trading_bot_service
    
    db = SessionLocal()
    try:
        config = db.query(BotConfig).first()
        if not config or not config.is_active:
            logger.info("Bot is not active, skipping cycle")
            return "Bot inactive"
            
        # Call the existing logic which we will refactor to be a single cycle
        # We must use a separate session inside the async function, so let's close this one first 
        # to prevent "not bound to a Session" errors spanning across async boundaries.
        db.close()
        
        # Open fresh session inside the coroutine wrapper to avoid thread issues
        async def _run_with_new_db():
            db_new = SessionLocal()
            try:
                config_new = db_new.query(BotConfig).first()
                await trading_bot_service._analyze_and_trade(db_new, config_new)
            finally:
                db_new.close()
                
        return run_async(_run_with_new_db())
    except Exception as e:
        logger.error(f"Error in execute_trading_cycle task: {str(e)}")
        db.rollback()
        raise e
    finally:
        db.close()
