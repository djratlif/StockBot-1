from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from typing import Dict, List

from app.models.database import get_db
from app.models.models import BotConfig
from app.models.schemas import (
    BotConfigResponse, BotConfigUpdate, BotStatus,
    APIResponse, TradingDecision, TradingIntervalConfig
)
from app.services.portfolio_service import portfolio_service
from app.services.stock_service import stock_service
from app.services.ai_service import ai_service
from app.services.trading_bot_service import trading_bot_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/config", response_model=BotConfigResponse)
async def get_bot_config(db: Session = Depends(get_db)):
    """Get current bot configuration"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            # Create default configuration if none exists
            config = BotConfig(
                max_daily_trades=5,
                max_position_size=0.20,
                risk_tolerance="MEDIUM",
                is_active=False
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            logger.info("Created default bot configuration")
        
        return BotConfigResponse.from_orm(config)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bot config: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/config", response_model=BotConfigResponse)
async def update_bot_config(
    config_update: BotConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update bot configuration"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            # Create new config if it doesn't exist
            config = BotConfig()
            db.add(config)
        
        # Update configuration fields
        for field, value in config_update.dict(exclude_unset=True).items():
            setattr(config, field, value)
        
        db.commit()
        db.refresh(config)
        
        logger.info(f"Bot configuration updated: {config_update.dict(exclude_unset=True)}")
        return BotConfigResponse.from_orm(config)
    except Exception as e:
        logger.error(f"Error updating bot config: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/status", response_model=BotStatus)
async def get_bot_status(db: Session = Depends(get_db)):
    """Get current bot status and trading information"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            # Create default configuration if none exists
            config = BotConfig(
                max_daily_trades=5,
                max_position_size=0.20,
                risk_tolerance="MEDIUM",
                is_active=False
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            logger.info("Created default bot configuration")
        
        portfolio = portfolio_service.get_portfolio(db)
        if not portfolio:
            # Initialize portfolio if it doesn't exist
            portfolio = portfolio_service.initialize_portfolio(db)
        
        # Get market status
        market_status = stock_service.get_market_status()
        
        # Get today's trade count
        trades_today = portfolio_service.get_trades_today(db)
        
        # Get last trade time
        from app.models.models import Trades
        last_trade = db.query(Trades).order_by(Trades.executed_at.desc()).first()
        
        # Get continuous trading status safely
        try:
            bot_service_status = trading_bot_service.get_status()
            continuous_trading = bot_service_status["is_running"]
            trading_interval_minutes = bot_service_status["trading_interval_minutes"]
        except Exception as e:
            logger.warning(f"Could not get trading bot service status: {str(e)}")
            continuous_trading = False
            trading_interval_minutes = 5
        
        return BotStatus(
            is_active=config.is_active,
            is_trading_hours=market_status.get("is_open", False),
            trades_today=trades_today,
            max_daily_trades=config.max_daily_trades,
            cash_available=portfolio.cash_balance,
            portfolio_value=portfolio.total_value,
            last_trade_time=last_trade.executed_at if last_trade else None,
            continuous_trading=continuous_trading,
            trading_interval_minutes=trading_interval_minutes
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bot status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/start", response_model=APIResponse)
async def start_bot(db: Session = Depends(get_db)):
    """Start the trading bot with continuous trading"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            # Create default configuration if none exists
            config = BotConfig(
                max_daily_trades=5,
                max_position_size=0.20,
                risk_tolerance="MEDIUM",
                is_active=False
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            logger.info("Created default bot configuration")
        
        config.is_active = True
        db.commit()
        
        # Add activity log entry
        from app.models.models import ActivityLog
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('US/Eastern')
        activity = ActivityLog(
            action="BOT_STARTED",
            details="Trading bot has been activated and is ready for continuous trading",
            timestamp=datetime.now(est)
        )
        db.add(activity)
        db.commit()
        
        logger.info("Trading bot started")
        
        # Start continuous trading in background
        try:
            await trading_bot_service.start_continuous_trading()
            continuous_trading_started = True
        except Exception as e:
            logger.warning(f"Could not start continuous trading: {str(e)}")
            continuous_trading_started = False
        
        # Get trading bot status
        bot_status = trading_bot_service.get_status()
        
        return APIResponse(
            success=True,
            message="Trading bot started successfully" + (" with continuous trading" if continuous_trading_started else ""),
            data={
                "is_active": True,
                "continuous_trading": continuous_trading_started,
                "trading_interval_minutes": bot_status["trading_interval_minutes"]
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting bot: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/stop", response_model=APIResponse)
async def stop_bot(db: Session = Depends(get_db)):
    """Stop the trading bot and continuous trading"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            raise HTTPException(status_code=404, detail="Bot configuration not found")
        
        config.is_active = False
        db.commit()
        
        # Stop continuous trading
        await trading_bot_service.stop_continuous_trading()
        
        # Add activity log entry
        from app.models.models import ActivityLog
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('US/Eastern')
        activity = ActivityLog(
            action="BOT_STOPPED",
            details="Trading bot has been deactivated and continuous trading has been stopped",
            timestamp=datetime.now(est)
        )
        db.add(activity)
        db.commit()
        
        logger.info("Trading bot stopped")
        return APIResponse(
            success=True,
            message="Trading bot stopped successfully",
            data={"is_active": False, "continuous_trading": False}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping bot: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/analyze/{symbol}")
async def analyze_stock(symbol: str, db: Session = Depends(get_db)):
    """Analyze a specific stock using AI"""
    try:
        symbol = symbol.upper()
        
        # Get bot configuration
        config = db.query(BotConfig).first()
        if not config:
            raise HTTPException(status_code=404, detail="Bot configuration not found")
        
        # Get portfolio information
        portfolio = portfolio_service.get_portfolio(db)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        
        # Get current holdings
        current_holdings = portfolio_service.get_current_holdings_dict(db)
        
        # Analyze stock with AI
        decision = ai_service.analyze_stock_for_trading(
            symbol=symbol,
            portfolio_cash=portfolio.cash_balance,
            current_holdings=current_holdings,
            portfolio_value=portfolio.total_value,
            risk_tolerance=config.risk_tolerance,
            max_position_size=config.max_position_size
        )
        
        if not decision:
            return APIResponse(
                success=True,
                message=f"AI recommends HOLD for {symbol}",
                data={"symbol": symbol, "action": "HOLD", "reasoning": "No trading action recommended"}
            )
        
        return APIResponse(
            success=True,
            message=f"AI analysis completed for {symbol}",
            data={
                "symbol": decision.symbol,
                "action": decision.action.value,
                "quantity": decision.quantity,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "current_price": decision.current_price
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing stock {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/execute-trade/{symbol}")
async def execute_ai_trade(symbol: str, db: Session = Depends(get_db)):
    """Analyze and execute a trade for a specific stock"""
    try:
        symbol = symbol.upper()
        
        # Get bot configuration
        config = db.query(BotConfig).first()
        if not config:
            raise HTTPException(status_code=404, detail="Bot configuration not found")
        
        if not config.is_active:
            raise HTTPException(status_code=400, detail="Bot is not active")
        
        # Check if we can make more trades today
        if not portfolio_service.can_make_trade(db, config.max_daily_trades):
            raise HTTPException(status_code=400, detail="Daily trade limit reached")
        
        # Check market hours
        market_status = stock_service.get_market_status()
        if not market_status.get("is_open", False):
            raise HTTPException(status_code=400, detail="Market is closed")
        
        # Get portfolio information
        portfolio = portfolio_service.get_portfolio(db)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        
        # Get current holdings
        current_holdings = portfolio_service.get_current_holdings_dict(db)
        
        # Analyze stock with AI
        decision = ai_service.analyze_stock_for_trading(
            symbol=symbol,
            portfolio_cash=portfolio.cash_balance,
            current_holdings=current_holdings,
            portfolio_value=portfolio.total_value,
            risk_tolerance=config.risk_tolerance,
            max_position_size=config.max_position_size
        )
        
        if not decision:
            return APIResponse(
                success=True,
                message=f"No trade executed for {symbol} - AI recommends HOLD",
                data={"symbol": symbol, "action": "HOLD"}
            )
        
        # Validate the decision
        if not ai_service.validate_trading_decision(decision, portfolio.cash_balance, current_holdings):
            raise HTTPException(status_code=400, detail="Invalid trading decision")
        
        # Execute the trade
        trade_result = portfolio_service.execute_trade(db, decision)
        
        if not trade_result:
            raise HTTPException(status_code=500, detail="Failed to execute trade")
        
        return APIResponse(
            success=True,
            message=f"Trade executed successfully: {decision.action.value} {decision.quantity} shares of {symbol}",
            data={
                "trade_id": trade_result.id,
                "symbol": trade_result.symbol,
                "action": trade_result.action.value,
                "quantity": trade_result.quantity,
                "price": trade_result.price,
                "total_amount": trade_result.total_amount,
                "reasoning": trade_result.ai_reasoning
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing AI trade for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/market-sentiment")
async def get_market_sentiment():
    """Get AI-powered market sentiment analysis"""
    try:
        # Get trending stocks for sentiment analysis
        trending_symbols = stock_service.get_trending_stocks()[:5]  # Top 5
        
        sentiment = ai_service.get_market_sentiment(trending_symbols)
        
        return APIResponse(
            success=True,
            message="Market sentiment analysis completed",
            data={"sentiment": sentiment, "symbols_analyzed": trending_symbols}
        )
    except Exception as e:
        logger.error(f"Error getting market sentiment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/start-simple", response_model=APIResponse)
async def start_bot_simple(db: Session = Depends(get_db)):
    """Start the trading bot without continuous trading (for testing)"""
    try:
        config = db.query(BotConfig).first()
        if not config:
            # Create default configuration if none exists
            config = BotConfig(
                max_daily_trades=5,
                max_position_size=0.20,
                risk_tolerance="MEDIUM",
                is_active=False
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            logger.info("Created default bot configuration")
        
        config.is_active = True
        db.commit()
        
        # Add activity log entry
        from app.models.models import ActivityLog
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('US/Eastern')
        activity = ActivityLog(
            action="BOT_STARTED",
            details="Trading bot has been activated (simple mode - no continuous trading)",
            timestamp=datetime.now(est)
        )
        db.add(activity)
        db.commit()
        
        logger.info("Trading bot started in simple mode")
        
        return APIResponse(
            success=True,
            message="Trading bot started successfully in simple mode",
            data={
                "is_active": True,
                "continuous_trading": False,
                "mode": "simple"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting bot in simple mode: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/trading-interval", response_model=APIResponse)
async def set_trading_interval(
    interval_config: TradingIntervalConfig,
    db: Session = Depends(get_db)
):
    """Set the trading interval for continuous trading"""
    try:
        # Check if bot configuration exists
        config = db.query(BotConfig).first()
        if not config:
            raise HTTPException(status_code=404, detail="Bot configuration not found")
        
        # Set the trading interval
        trading_bot_service.set_trading_interval(interval_config.interval_minutes)
        
        # Add activity log entry
        from app.models.models import ActivityLog
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('US/Eastern')
        activity = ActivityLog(
            action="TRADING_INTERVAL_UPDATED",
            details=f"Trading interval updated to {interval_config.interval_minutes} minutes",
            timestamp=datetime.now(est)
        )
        db.add(activity)
        db.commit()
        
        logger.info(f"Trading interval updated to {interval_config.interval_minutes} minutes")
        
        return APIResponse(
            success=True,
            message=f"Trading interval updated to {interval_config.interval_minutes} minutes",
            data={
                "interval_minutes": interval_config.interval_minutes,
                "is_running": trading_bot_service.get_status()["is_running"]
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting trading interval: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/trading-status", response_model=APIResponse)
async def get_trading_status():
    """Get detailed continuous trading status"""
    try:
        status = trading_bot_service.get_status()
        
        return APIResponse(
            success=True,
            message="Trading status retrieved successfully",
            data=status
        )
    except Exception as e:
        logger.error(f"Error getting trading status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")