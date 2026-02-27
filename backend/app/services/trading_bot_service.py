import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import pytz
from sqlalchemy.orm import Session

from app.models.database import SessionLocal
from app.models.models import BotConfig, ActivityLog, AllocationType
from app.services.ai_service import ai_service
from app.services.portfolio_service import portfolio_service
from app.services.stock_service import stock_service
from app.config import settings

logger = logging.getLogger(__name__)

class TradingBotService:
    def __init__(self):
        self.is_running = False
        self.is_analyzing = False
        self.is_fetching = False
        self.task: Optional[asyncio.Task] = None
        self.trading_interval = 300  # 5 minutes for less frequent rate-limited trading
        self.analysis_interval = 300   # 5 minutes for market analysis
        self.last_trade_time = None
        self.est = pytz.timezone('US/Eastern')
        
    async def start_continuous_trading(self):
        """Start the continuous trading loop using Celery"""
        if self.is_running:
            logger.warning("Trading bot is already running")
            return
            
        self.is_running = True
        logger.info("Continuous trading bot started via Celery")
        
        # Start a fast-polling local loop that just triggers Celery tasks
        self.task = asyncio.create_task(self._trigger_loop())
        
    async def stop_continuous_trading(self):
        """Stop the continuous trading loop"""
        if not self.is_running:
            return
            
        self.is_running = False
        if self.task:
            self.task.cancel()
        logger.info("Continuous trading bot stopped")
        
    async def _trigger_loop(self):
        """Lightweight loop that triggers Celery tasks"""
        from app.tasks.trading_tasks import execute_trading_cycle
        from app.services.stock_service import stock_service
        
        try:
            while self.is_running:
                db = None
                try:
                    db = SessionLocal()
                    config = db.query(BotConfig).first()
                    if not config or not config.is_active:
                        break
                        
                    market_status = stock_service.get_market_status()
                    if market_status.get("is_open", False):
                        # Dispatch task to Celery instead of running inline
                        execute_trading_cycle.delay()
                        logger.info("Dispatched trading cycle to Celery worker")
                    else:
                        logger.info(f"Market is closed, waiting...")
                        
                except Exception as e:
                    logger.error(f"Error triggering trading cycle: {e}")
                finally:
                    if db:
                        db.close()
                        
                await asyncio.sleep(self.trading_interval)
                
        except asyncio.CancelledError:
            pass
        finally:
            self.is_running = False
            
    async def _analyze_and_trade(self, db: Session, config: BotConfig):
        """Analyze market and execute trades if conditions are met"""
        self.is_analyzing = True
        try:
            # Get portfolio information
            portfolio = portfolio_service.get_portfolio(db)
            if not portfolio:
                logger.error("Portfolio not found")
                return

            # Sync cash balance and equity from Alpaca so allocation math is accurate
            self.is_fetching = True
            from app.services.alpaca_service import alpaca_service as _alpaca
            account = _alpaca.get_account()
            if account:
                portfolio.cash_balance = float(account.cash)
                portfolio.total_value = float(account.equity)
                db.commit()
                
                # Broadcast real-time update to connected clients
                from app.routers.websocket import _trigger_broadcast
                await _trigger_broadcast("portfolio_update", {
                    "cash_balance": portfolio.cash_balance,
                    "total_value": portfolio.total_value
                })

            # Get current holdings
            current_holdings = portfolio_service.get_current_holdings_dict(db)
            
            # Get trending stocks to analyze
            trending_stocks = stock_service.get_trending_stocks()
            self.is_fetching = False
            
            # Limit analysis to top stocks to avoid API rate limits
            stocks_to_analyze = trending_stocks[:10]
            
            # Add current holdings to analysis list (to consider selling)
            for symbol in current_holdings.keys():
                if symbol not in stocks_to_analyze:
                    stocks_to_analyze.append(symbol)
            
            logger.info(f"Analyzing {len(stocks_to_analyze)} stocks for trading opportunities")
            
            # Pre-fetch market data sequentially to avoid SQLite connection deadlocks
            self.is_fetching = True
            market_data = {}
            for sym in stocks_to_analyze:
                try:
                    info = await stock_service.get_stock_info(sym, db)
                    history = await stock_service.get_historical_data(sym, period="1mo")
                    news = await stock_service.fetch_news(sym, limit=3)
                    if info and history:
                        market_data[sym] = {
                            "info": info,
                            "history": history,
                            "news": news
                        }
                except Exception as e:
                    logger.error(f"Error prefetching data for {sym}: {e}")
            self.is_fetching = False
            
            # Define active providers and their allocations
            providers = []
            if getattr(config, 'openai_active', False) and getattr(config, 'openai_api_key', None):
                providers.append({
                    "name": "OPENAI",
                    "api_key": config.openai_api_key,
                    "allocation": getattr(config, 'openai_allocation', 0.0)
                })
            
            if getattr(config, 'gemini_active', False) and getattr(config, 'gemini_api_key', None):
                providers.append({
                    "name": "GEMINI",
                    "api_key": config.gemini_api_key,
                    "allocation": getattr(config, 'gemini_allocation', 0.0)
                })
                
            if getattr(config, 'anthropic_active', False) and getattr(config, 'anthropic_api_key', None):
                providers.append({
                    "name": "ANTHROPIC",
                    "api_key": config.anthropic_api_key,
                    "allocation": getattr(config, 'anthropic_allocation', 0.0)
                })
                
            if not providers:
                logger.warning("No active AI providers configured with API keys.")
                return

            # Analyze each stock and collect decisions with timeout
            trading_decisions = []
            
            for provider_info in providers:
                provider_name = provider_info["name"]
                provider_api_key = provider_info["api_key"]
                
                # Get current holdings specific to this provider
                provider_holdings = portfolio_service.get_current_holdings_dict(db, ai_provider=provider_name)
                
                # Allocation limits for this specific provider
                allocated_limit = provider_info["allocation"]
                invested = sum(h['quantity'] * h['current_price'] for h in provider_holdings.values())
                
                allocation_exceeded = invested > allocated_limit
                allocation_overage = invested - allocated_limit if allocation_exceeded else 0.0
                usable_cash = min(portfolio.cash_balance, max(0.0, allocated_limit - invested))

                try:
                    status_msg = f"OVER LIMIT by ${allocation_overage:,.2f} — bot will only SELL" if allocation_exceeded else f"usable cash: ${usable_cash:,.2f}"
                    cycle_log = ActivityLog(
                        action=f"{provider_name}_ANALYSIS_CYCLE",
                        details=f"Starting analysis of {len(stocks_to_analyze)} stocks | Allocation limit: ${allocated_limit:,.2f} | Invested: ${invested:,.2f} | {status_msg}",
                        timestamp=datetime.now(self.est)
                    )
                    db.add(cycle_log)
                    db.commit()
                except Exception as log_error:
                    logger.error(f"Failed to log analysis cycle: {log_error}")

                for symbol in stocks_to_analyze:
                    if symbol not in market_data:
                        logger.warning(f"Skipping {symbol} due to missing pre-fetched market data.")
                        continue
                        
                    stock_data = market_data[symbol]
                    try:
                        decision = await asyncio.wait_for(
                            ai_service.analyze_stock_for_trading(
                                symbol=symbol,
                                portfolio_cash=usable_cash,
                                current_holdings=provider_holdings,
                                portfolio_value=portfolio.total_value,
                                risk_tolerance=config.risk_tolerance,
                                strategy_profile=getattr(config, 'strategy_profile', 'BALANCED'),
                                recent_news=stock_data["news"],
                                max_position_size=config.max_position_size,
                                allocation_exceeded=allocation_exceeded,
                                allocation_overage=allocation_overage,
                                db_session=db,
                                ai_provider=provider_name,
                                api_key=provider_api_key,
                                pre_fetched_info=stock_data["info"],
                                pre_fetched_history=stock_data["history"]
                            ),
                            timeout=45.0
                        )
                        
                        if decision and decision.confidence >= 5:
                            trading_decisions.append(decision)
                            logger.info(f"Added {provider_name} trading decision for {symbol}: {decision.action} {decision.quantity} shares (Confidence: {decision.confidence}/10)")
                        elif decision:
                            logger.info(f"Low confidence decision for {symbol} by {provider_name}: {decision.action} {decision.quantity} shares (Confidence: {decision.confidence}/10) - skipped")
                            try:
                                activity = ActivityLog(
                                    action=f"{provider_name}_LOW_CONFIDENCE",
                                    details=f"AI suggested {decision.action.value} {decision.quantity} shares of {symbol} but confidence too low ({decision.confidence}/10)",
                                    timestamp=datetime.now(self.est)
                                )
                                db.add(activity)
                                db.commit()
                            except Exception as log_error:
                                logger.error(f"Failed to log low confidence decision: {log_error}")
                                
                    except asyncio.TimeoutError:
                        logger.warning(f"Timeout analyzing {symbol} with {provider_name} - skipping")
                        try:
                            activity = ActivityLog(
                                action=f"{provider_name}_ANALYSIS_TIMEOUT",
                                details=f"Stock analysis timeout for {symbol} after 30 seconds",
                                timestamp=datetime.now(self.est)
                            )
                            db.add(activity)
                            db.commit()
                        except Exception as log_error:
                            pass
                        continue
                    except Exception as e:
                        logger.warning(f"Error analyzing {symbol} with {provider_name}: {str(e)}")
                        continue
            
            # Sort decisions by confidence and execute the best ones
            trading_decisions.sort(key=lambda x: x.confidence, reverse=True)
            
            executed_trades = 0
            max_trades_per_cycle = 5  # Allow up to 5 trades per cycle
            
            for decision in trading_decisions[:max_trades_per_cycle]:
                try:
                    provider_name = decision.ai_provider
                    allocated_limit = next((p["allocation"] for p in providers if p["name"] == provider_name), 0.0)
                    
                    provider_holdings = portfolio_service.get_current_holdings_dict(db, ai_provider=provider_name)
                    portfolio = portfolio_service.get_portfolio(db)
                    
                    invested = sum(h['quantity'] * h['current_price'] for h in provider_holdings.values())
                    allocation_exceeded = invested > allocated_limit
                    usable_cash = min(portfolio.cash_balance, max(0.0, allocated_limit - invested))

                    if not ai_service.validate_trading_decision(decision, usable_cash, provider_holdings, allocation_exceeded):
                        logger.warning(f"Invalid or blocked {provider_name} trading decision for {decision.symbol}")
                        continue
                    
                    trade_result = portfolio_service.execute_trade(db, decision)
                    
                    if trade_result:
                        executed_trades += 1
                        self.last_trade_time = datetime.now(self.est)
                        
                        activity = ActivityLog(
                            action=f"{provider_name}_AUTO_TRADE",
                            details=f"Executed {decision.action.value} {decision.quantity} shares of {decision.symbol} at ${decision.current_price:.2f} (Confidence: {decision.confidence}/10)",
                            timestamp=self.last_trade_time
                        )
                        db.add(activity)
                        
                        logger.info(f"Executed trade: {decision.action.value} {decision.quantity} shares of {decision.symbol} by {provider_name}")
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
        finally:
            self.is_analyzing = False

    def set_trading_interval(self, minutes: int):
        """Set the trading interval in minutes"""
        self.trading_interval = max(60, minutes * 60)  # Minimum 1 minute
        logger.info(f"Trading interval set to {minutes} minutes")
    
    def get_status(self) -> Dict:
        """Get current bot status"""
        return {
            "is_running": self.is_running,
            "is_analyzing": self.is_analyzing,
            "is_fetching": self.is_fetching,
            "trading_interval_minutes": self.trading_interval // 60,
            "last_trade_time": self.last_trade_time.isoformat() if self.last_trade_time else None
        }

# Global instance
trading_bot_service = TradingBotService()