import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import pytz
from sqlalchemy.orm import Session

from app.models.database import SessionLocal
from app.models.models import BotConfig, ActivityLog
from app.services.ai_service import ai_service
from app.services.portfolio_service import portfolio_service
from app.services.stock_service import stock_service
from app.config import settings

logger = logging.getLogger(__name__)

class TradingBotService:
    def __init__(self):
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.trading_interval = 60  # 1 minute for more frequent trading during testing
        self.analysis_interval = 60   # 1 minute for market analysis
        self.last_trade_time = None
        self.est = pytz.timezone('US/Eastern')
        
    async def start_continuous_trading(self):
        """Start the continuous trading loop"""
        if self.is_running:
            logger.warning("Trading bot is already running")
            return
            
        self.is_running = True
        self.task = asyncio.create_task(self._trading_loop())
        logger.info("Continuous trading bot started")
        
    async def stop_continuous_trading(self):
        """Stop the continuous trading loop"""
        if not self.is_running:
            return
            
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Continuous trading bot stopped")
        
    async def _trading_loop(self):
        """Main trading loop that runs continuously when bot is active"""
        try:
            while self.is_running:
                db = None
                try:
                    # Get database session
                    db = SessionLocal()
                    
                    # Check if bot is still active
                    config = db.query(BotConfig).first()
                    if not config or not config.is_active:
                        logger.info("Bot is no longer active, stopping trading loop")
                        break
                    
                    # Check if market is open
                    market_status = stock_service.get_market_status()
                    if not market_status.get("is_open", False):
                        logger.info(f"Market is closed (Current time: {market_status.get('current_time', 'Unknown')}), waiting...")
                        await asyncio.sleep(60)  # Check every minute when market is closed
                        continue
                    else:
                        logger.info(f"Market is open (Current time: {market_status.get('current_time', 'Unknown')})")
                    
                    # Check if we can make more trades today
                    if not portfolio_service.can_make_trade(db, config.max_daily_trades):
                        logger.info("Daily trade limit reached, waiting until tomorrow")
                        await asyncio.sleep(3600)  # Wait 1 hour before checking again
                        continue
                    
                    # Perform trading analysis and execution
                    await self._analyze_and_trade(db, config)
                    
                    # Wait for the next trading interval
                    await asyncio.sleep(self.trading_interval)
                    
                except Exception as e:
                    logger.error(f"Error in trading loop: {str(e)}")
                    await asyncio.sleep(60)  # Wait 1 minute before retrying
                finally:
                    if db:
                        db.close()
                        
        except asyncio.CancelledError:
            logger.info("Trading loop cancelled")
        except Exception as e:
            logger.error(f"Fatal error in trading loop: {str(e)}")
        finally:
            self.is_running = False
            
    async def _analyze_and_trade(self, db: Session, config: BotConfig):
        """Analyze market and execute trades if conditions are met"""
        try:
            # Get portfolio information
            portfolio = portfolio_service.get_portfolio(db)
            if not portfolio:
                logger.error("Portfolio not found")
                return
            
            # Get current holdings
            current_holdings = portfolio_service.get_current_holdings_dict(db)
            
            # Get trending stocks to analyze
            trending_stocks = stock_service.get_trending_stocks()
            
            # Limit analysis to top stocks to avoid API rate limits
            stocks_to_analyze = trending_stocks[:10]
            
            # Add current holdings to analysis list (to consider selling)
            for symbol in current_holdings.keys():
                if symbol not in stocks_to_analyze:
                    stocks_to_analyze.append(symbol)
            
            logger.info(f"Analyzing {len(stocks_to_analyze)} stocks for trading opportunities")
            
            # Analyze each stock and collect decisions with timeout
            trading_decisions = []
            for symbol in stocks_to_analyze:
                try:
                    # Add timeout to prevent hanging on API calls
                    decision = await asyncio.wait_for(
                        ai_service.analyze_stock_for_trading(
                            symbol=symbol,
                            portfolio_cash=portfolio.cash_balance,
                            current_holdings=current_holdings,
                            portfolio_value=portfolio.total_value,
                            risk_tolerance=config.risk_tolerance,
                            max_position_size=config.max_position_size,
                            db_session=db
                        ),
                        timeout=30.0  # 30 second timeout per stock
                    )
                    
                    if decision and decision.confidence >= 5:  # Lowered threshold for more trading activity
                        trading_decisions.append(decision)
                        logger.info(f"Added trading decision for {symbol}: {decision.action} {decision.quantity} shares (Confidence: {decision.confidence}/10)")
                    elif decision:
                        logger.info(f"Low confidence decision for {symbol}: {decision.action} {decision.quantity} shares (Confidence: {decision.confidence}/10) - skipped")
                        
                        # Log low confidence decisions to activity feed
                        try:
                            activity = ActivityLog(
                                action="LOW_CONFIDENCE_DECISION",
                                details=f"AI suggested {decision.action.value} {decision.quantity} shares of {symbol} but confidence too low ({decision.confidence}/10)",
                                timestamp=datetime.now(self.est)
                            )
                            db.add(activity)
                            db.commit()
                        except Exception as log_error:
                            logger.error(f"Failed to log low confidence decision: {log_error}")
                    else:
                        logger.info(f"No trading decision generated for {symbol}")
                        
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout analyzing {symbol} - skipping")
                    
                    # Log timeout to activity feed
                    try:
                        activity = ActivityLog(
                            action="ANALYSIS_TIMEOUT",
                            details=f"Stock analysis timeout for {symbol} after 30 seconds - API rate limits may be causing delays",
                            timestamp=datetime.now(self.est)
                        )
                        db.add(activity)
                        db.commit()
                    except Exception as log_error:
                        logger.error(f"Failed to log timeout to activity: {log_error}")
                    
                    continue
                except Exception as e:
                    logger.warning(f"Error analyzing {symbol}: {str(e)}")
                    
                    # Log analysis error to activity feed
                    try:
                        activity = ActivityLog(
                            action="ANALYSIS_ERROR",
                            details=f"Failed to analyze {symbol}: {str(e)}",
                            timestamp=datetime.now(self.est)
                        )
                        db.add(activity)
                        db.commit()
                    except Exception as log_error:
                        logger.error(f"Failed to log analysis error to activity: {log_error}")
                    
                    continue
            
            # Sort decisions by confidence and execute the best ones
            trading_decisions.sort(key=lambda x: x.confidence, reverse=True)
            
            executed_trades = 0
            max_trades_per_cycle = min(2, config.max_daily_trades)  # Limit trades per cycle
            
            for decision in trading_decisions[:max_trades_per_cycle]:
                try:
                    # Double-check we can still make trades
                    if not portfolio_service.can_make_trade(db, config.max_daily_trades):
                        break
                    
                    # Validate the decision
                    if not ai_service.validate_trading_decision(decision, portfolio.cash_balance, current_holdings):
                        logger.warning(f"Invalid trading decision for {decision.symbol}")
                        continue
                    
                    # Execute the trade
                    trade_result = portfolio_service.execute_trade(db, decision)
                    
                    if trade_result:
                        executed_trades += 1
                        self.last_trade_time = datetime.now(self.est)
                        
                        # Log the trade
                        activity = ActivityLog(
                            action="AUTO_TRADE",
                            details=f"Executed {decision.action.value} {decision.quantity} shares of {decision.symbol} at ${decision.current_price:.2f} (Confidence: {decision.confidence}/10)",
                            timestamp=self.last_trade_time
                        )
                        db.add(activity)
                        
                        logger.info(f"Executed trade: {decision.action.value} {decision.quantity} shares of {decision.symbol}")
                        
                        # Update current holdings for next iteration
                        current_holdings = portfolio_service.get_current_holdings_dict(db)
                        
                        # Small delay between trades
                        await asyncio.sleep(5)
                    
                except Exception as e:
                    logger.error(f"Error executing trade for {decision.symbol}: {str(e)}")
                    continue
            
            if executed_trades > 0:
                db.commit()
                logger.info(f"Completed trading cycle: {executed_trades} trades executed")
            else:
                logger.debug("No trades executed this cycle")
                
        except Exception as e:
            logger.error(f"Error in analyze_and_trade: {str(e)}")
            db.rollback()
    
    def set_trading_interval(self, minutes: int):
        """Set the trading interval in minutes"""
        self.trading_interval = max(60, minutes * 60)  # Minimum 1 minute
        logger.info(f"Trading interval set to {minutes} minutes")
    
    def get_status(self) -> Dict:
        """Get current bot status"""
        return {
            "is_running": self.is_running,
            "trading_interval_minutes": self.trading_interval // 60,
            "last_trade_time": self.last_trade_time.isoformat() if self.last_trade_time else None
        }

# Global instance
trading_bot_service = TradingBotService()