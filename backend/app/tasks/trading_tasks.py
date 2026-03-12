from app.celery_app import celery_app
import asyncio
from app.models.database import SessionLocal
from app.models.models import BotConfig
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

@celery_app.task(name='analyze_single_stock_task')
def analyze_single_stock_task(
    provider_name, provider_api_key, symbol,
    usable_cash, allocation_exceeded, allocation_overage,
    portfolio_total_value, risk_tolerance_value, strategy_profile,
    max_position_size, current_holdings
):
    """Background task to analyze a single stock with a specific AI provider"""
    from app.services.ai_service import ai_service
    from app.services.stock_service import stock_service
    from app.models.database import SessionLocal
    from app.models.models import RiskTolerance, ActivityLog
    
    est = pytz.timezone('US/Eastern')
    
    # We must open a DB session to log the exact API Request, and then close it
    db = SessionLocal()
    try:
        try:
            db.add(ActivityLog(
                action=f"{provider_name}_API_REQUEST",
                details=f"[{provider_name}] External API Request: Analyzing {symbol}",
                timestamp=datetime.now(est)
            ))
            db.commit()
        except Exception:
            pass
    finally:
        db.close()

    async def _run_analysis():
        # Re-fetch is instantaneous because Alpaca is cached in Redis
        info = await stock_service.get_stock_info(symbol)
        if isinstance(info, dict):
            from app.models.schemas import StockInfo
            info = StockInfo(**info)
            
        history = await stock_service.get_historical_data(symbol, period="1mo")
        news = await stock_service.fetch_news(symbol, limit=3)

        decision = await asyncio.wait_for(
            ai_service.analyze_stock_for_trading(
                symbol=symbol,
                portfolio_cash=usable_cash,
                current_holdings=current_holdings,
                portfolio_value=portfolio_total_value,
                risk_tolerance=RiskTolerance(risk_tolerance_value),
                strategy_profile=strategy_profile,
                recent_news=news,
                max_position_size=max_position_size,
                allocation_exceeded=allocation_exceeded,
                allocation_overage=allocation_overage,
                db_session=None,
                ai_provider=provider_name,
                api_key=provider_api_key,
                pre_fetched_info=info,
                pre_fetched_history=history
            ),
            timeout=90.0
        )
        
        if decision:
            return {
                "decision": {
                    "action": decision.action.value,
                    "symbol": decision.symbol,
                    "quantity": decision.quantity,
                    "confidence": decision.confidence,
                    "reasoning": decision.reasoning,
                    "current_price": decision.current_price,
                    "ai_provider": decision.ai_provider
                },
                "symbol": symbol,
                "provider": provider_name,
                "error": None
            }
        else:
            return {"decision": None, "symbol": symbol, "provider": provider_name, "error": "No decision parsed"}

    try:
        return run_async(_run_analysis())
    except asyncio.TimeoutError:
        return {"decision": None, "symbol": symbol, "provider": provider_name, "error": "timeout"}
    except Exception as e:
        logger.error(f"Error in analyze_single_stock_task {symbol}: {e}")
        return {"decision": None, "symbol": symbol, "provider": provider_name, "error": str(e)}
