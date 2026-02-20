from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Tuple, Any
import logging
from datetime import datetime, date
from app.models.models import Portfolio, Holdings, Trades, BotConfig, TradeAction, ActivityLog
from app.models.schemas import (
    PortfolioSummary, TradingStats, TradeCreate, TradingDecision, 
    TradeActionEnum, HoldingResponse, TradeResponse
)
from app.services.stock_service import stock_service
from app.services.alpaca_service import alpaca_service
from app.config import settings

logger = logging.getLogger(__name__)

class PortfolioService:
    def __init__(self):
        pass
    
    def initialize_portfolio(self, db: Session) -> Portfolio:
        """Initialize portfolio and sync with Alpaca"""
        try:
            # Check if portfolio already exists
            portfolio = db.query(Portfolio).first()
            
            # Fetch actual balance from Alpaca
            account = alpaca_service.get_account()
            
            current_equity = settings.initial_balance
            cash_balance = settings.initial_balance
            
            if account:
                current_equity = float(account.equity)
                cash_balance = float(account.cash)
            else:
                logger.warning("Could not fetch Alpaca account, using default/local values")
            
            if not portfolio:
                # Create new portfolio
                portfolio = Portfolio(
                    cash_balance=cash_balance,
                    total_value=current_equity
                )
                db.add(portfolio)
                db.commit()
                db.refresh(portfolio)
                logger.info(f"Portfolio initialized with ${current_equity} (Synced from Alpaca)")
            else:
                # Update existing portfolio
                portfolio.cash_balance = cash_balance
                portfolio.total_value = current_equity
                db.commit()
                logger.info(f"Portfolio synced with Alpaca: ${current_equity}")
                
            return portfolio
            
        except Exception as e:
            logger.error(f"Error initializing portfolio: {str(e)}")
            db.rollback()
            raise
    
    def get_portfolio(self, db: Session) -> Optional[Portfolio]:
        """Get current portfolio"""
        return db.query(Portfolio).first()
    
    async def get_portfolio_summary(self, db: Session) -> Optional[PortfolioSummary]:
        """Get comprehensive portfolio summary synced with Alpaca"""
        try:
            portfolio = self.get_portfolio(db)
            if not portfolio:
                return None
            
            # 1. Sync User Account Data from Alpaca
            account = alpaca_service.get_account()
            if account:
                # Updates local portfolio record to match Alpaca
                previous_value = portfolio.total_value
                portfolio.cash_balance = float(account.cash)
                portfolio.total_value = float(account.equity)
                
                # Log significant changes
                value_change = portfolio.total_value - previous_value
                if abs(value_change) > 0.50: # Log changes > $0.50
                    direction = "UP" if value_change > 0 else "DOWN"
                    sign = "+" if value_change > 0 else "-"
                    details = f"Portfolio Value: ${previous_value:.2f} -> ${portfolio.total_value:.2f} ({sign}${abs(value_change):.2f})"
                    
                    log = ActivityLog(action=f"PORTFOLIO_{direction}", details=details)
                    db.add(log)
                
                db.commit()
            
            # 2. Sync Positions from Alpaca
            alpaca_positions = alpaca_service.get_positions()
            # Map alpaca positions by symbol
            alpaca_map = {p.symbol: p for p in alpaca_positions}
            
            # Get local holdings
            local_holdings = db.query(Holdings).all()
            local_map = {h.symbol: h for h in local_holdings}
            
            # Update or Delete local holdings
            for holding in local_holdings:
                if holding.symbol in alpaca_map:
                    # Update
                    pos = alpaca_map[holding.symbol]
                    holding.quantity = int(pos.qty)
                    holding.average_cost = float(pos.avg_entry_price)
                    holding.current_price = float(pos.current_price)
                else:
                    # Delete (no longer in Alpaca)
                    db.delete(holding)
            
            # Create new local holdings
            for symbol, pos in alpaca_map.items():
                if symbol not in local_map:
                    new_holding = Holdings(
                        user_id=portfolio.user_id,
                        symbol=symbol,
                        quantity=int(pos.qty),
                        average_cost=float(pos.avg_entry_price),
                        current_price=float(pos.current_price)
                    )
                    db.add(new_holding)
            
            db.commit()
            
            # Recalculate metrics based on fresh data
            holdings = db.query(Holdings).all()
            total_invested = sum(h.quantity * h.average_cost for h in holdings)
            
            # Calculate daily change
            # Alpaca account object has equity and last_equity (from previous close)
            daily_change = 0
            daily_change_percent = 0
            if account:
                daily_change = float(account.equity) - float(account.last_equity)
                daily_change_percent = (daily_change / float(account.last_equity)) * 100 if float(account.last_equity) > 0 else 0
            
            # Calculate returns based on bot's actual performance
            stats = self.get_trading_stats(db)
            realized_pnl = stats.total_profit_loss if stats else 0
            open_pnl = sum((h.current_price - h.average_cost) * h.quantity for h in holdings)
            
            total_return = realized_pnl + open_pnl
            return_percentage = (total_return / settings.initial_balance) * 100 if settings.initial_balance > 0 else 0
            
            return PortfolioSummary(
                cash_balance=portfolio.cash_balance,
                total_value=portfolio.total_value,
                total_invested=total_invested,
                total_return=total_return,
                return_percentage=return_percentage,
                holdings_count=len(holdings),
                daily_change=daily_change,
                daily_change_percent=daily_change_percent
            )
            
        except Exception as e:
            logger.error(f"Error getting portfolio summary: {str(e)}")
            return None
    
    async def get_holdings(self, db: Session) -> List[HoldingResponse]:
        """Get all current holdings (synced via get_portfolio_summary or separate sync)"""
        # Trigger a sync lightly or just return DB? 
        # For speed, let's just return DB. get_portfolio_summary is called often enough.
        try:
            holdings = db.query(Holdings).all()
            return [HoldingResponse.from_orm(h) for h in holdings]
        except Exception as e:
            logger.error(f"Error getting holdings: {str(e)}")
            return []
    
    def execute_trade(self, db: Session, decision: TradingDecision) -> Optional[TradeResponse]:
        """Execute a trading decision via Alpaca"""
        try:
            portfolio = self.get_portfolio(db)
            if not portfolio:
                logger.error("Portfolio not found")
                return None
            
            # Submit order to Alpaca
            # action string needs to be formatted for Alpaca (expected 'buy' or 'sell')
            side = "buy" if decision.action == TradeActionEnum.BUY else "sell"
            
            order = alpaca_service.submit_order(
                symbol=decision.symbol,
                qty=decision.quantity,
                side=side
            )
            
            if not order:
                logger.error(f"Failed to submit order for {decision.symbol}")
                return None
            
            # Order submitted successfully.
            # We log it in the Trades table for history.
            # We DO NOT manually update Holdings/Portfolio here, as that will be synced 
            # from Alpaca in the next poll cycle.
            
            trade = Trades(
                user_id=portfolio.user_id,
                symbol=decision.symbol,
                action=TradeAction.BUY if decision.action == TradeActionEnum.BUY else TradeAction.SELL,
                quantity=decision.quantity,
                price=decision.current_price, # Estimated price
                total_amount=decision.quantity * decision.current_price, # Estimated amount
                ai_reasoning=decision.reasoning,
                # We can store Alpaca Order ID if we added a column, but for now skipping
            )
            db.add(trade)
            db.commit()
            db.refresh(trade)
            
            logger.info(f"Order submitted to Alpaca: {side.upper()} {decision.quantity} {decision.symbol}")
            return TradeResponse.from_orm(trade)
            
        except Exception as e:
            logger.error(f"Error executing trade: {str(e)}")
            db.rollback()
            return None

    # Helper methods _execute_buy_order and _execute_sell_order are no longer needed
    # but keeping them or removing? Removing is cleaner.
    
    def get_trading_history(self, db: Session, limit: int = 50, offset: int = 0) -> List[TradeResponse]:
        """Get trading history with pagination"""
        try:
            trades = db.query(Trades).order_by(Trades.executed_at.desc()).offset(offset).limit(limit).all()
            return [TradeResponse.from_orm(trade) for trade in trades]
        except Exception as e:
            logger.error(f"Error getting trading history: {str(e)}")
            return []
    
    def get_trading_stats(self, db: Session) -> Optional[TradingStats]:
        """Get trading statistics"""
        # Same implementation as before, calculating from local Trade history and Holdings
        try:
            trades = db.query(Trades).all()
            portie_holdings = db.query(Holdings).all() # Rename to avoid overwrite
            
            best_open_position = None
            worst_open_position = None
            best_open_symbol = None
            worst_open_symbol = None
            
            for holding in portie_holdings:
                # Calculate return: (Current - Avg) * Qty
                open_return = (holding.current_price - holding.average_cost) * holding.quantity
                
                if best_open_position is None or open_return > best_open_position:
                    best_open_position = open_return
                    best_open_symbol = holding.symbol
                
                if worst_open_position is None or open_return < worst_open_position:
                    worst_open_position = open_return
                    worst_open_symbol = holding.symbol
            
            if not trades:
                return TradingStats(
                    total_trades=0,
                    winning_trades=0,
                    losing_trades=0,
                    win_rate=0.0,
                    total_profit_loss=0.0,
                    average_trade_return=0.0,
                    best_open_position=best_open_position,
                    worst_open_position=worst_open_position,
                    best_open_symbol=best_open_symbol,
                    worst_open_symbol=worst_open_symbol
                )
            
            # Calculate statistics
            total_trades = len(trades)
            profit_loss_by_symbol = {}
            
            for trade in trades:
                if trade.symbol not in profit_loss_by_symbol:
                    profit_loss_by_symbol[trade.symbol] = []
                
                profit_loss_by_symbol[trade.symbol].append({
                    'action': trade.action,
                    'quantity': trade.quantity,
                    'price': trade.price,
                    'total': trade.total_amount
                })
            
            total_profit_loss = 0
            winning_trades = 0
            losing_trades = 0
            trade_returns = []
            
            for symbol, symbol_trades in profit_loss_by_symbol.items():
                buys = [t for t in symbol_trades if t['action'] == TradeAction.BUY]
                sells = [t for t in symbol_trades if t['action'] == TradeAction.SELL]
                
                if buys and sells:
                    avg_buy_price = sum(t['total'] for t in buys) / sum(t['quantity'] for t in buys)
                    avg_sell_price = sum(t['total'] for t in sells) / sum(t['quantity'] for t in sells)
                    
                    trade_return = avg_sell_price - avg_buy_price
                    trade_returns.append(trade_return)
                    
                    if trade_return > 0:
                        winning_trades += 1
                    else:
                        losing_trades += 1
                    
                    total_profit_loss += trade_return * min(sum(t['quantity'] for t in buys), sum(t['quantity'] for t in sells))
            
            win_rate = (winning_trades / (winning_trades + losing_trades)) * 100 if (winning_trades + losing_trades) > 0 else 0
            average_trade_return = sum(trade_returns) / len(trade_returns) if trade_returns else 0
            best_trade = max(trade_returns) if trade_returns else None
            worst_trade = min(trade_returns) if trade_returns else None
            
            return TradingStats(
                total_trades=total_trades,
                winning_trades=winning_trades,
                losing_trades=losing_trades,
                win_rate=win_rate,
                total_profit_loss=total_profit_loss,
                average_trade_return=average_trade_return,
                best_trade=best_trade,
                worst_trade=worst_trade,
                best_open_position=best_open_position,
                worst_open_position=worst_open_position,
                best_open_symbol=best_open_symbol,
                worst_open_symbol=worst_open_symbol
            )
            
        except Exception as e:
            logger.error(f"Error calculating trading stats: {str(e)}")
            return None
    
    def get_current_holdings_dict(self, db: Session) -> Dict[str, Dict]:
        """Get current holdings as a dictionary for AI analysis"""
        try:
            holdings = db.query(Holdings).all()
            result = {}
            for holding in holdings:
                result[holding.symbol] = {
                    'quantity': holding.quantity,
                    'average_cost': holding.average_cost,
                    'current_price': holding.current_price
                }
            return result
        except Exception as e:
            logger.error(f"Error getting holdings dict: {str(e)}")
            return {}
    
    def get_trades_today(self, db: Session) -> int:
        """Get number of trades executed today"""
        try:
            today = date.today()
            trades_today = db.query(Trades).filter(
                Trades.executed_at >= datetime.combine(today, datetime.min.time())
            ).count()
            return trades_today
        except Exception as e:
            logger.error(f"Error getting today's trades count: {str(e)}")
            return 0
    
    async def liquidate_portfolio(self, db: Session) -> Dict[str, Any]:
        """Liquidate all holdings (Panic Sell) via Alpaca"""
        try:
            # Call Alpaca to close all positions
            # returns list of orders
            orders = alpaca_service.close_all_positions(cancel_orders=True)
            
            results = {
                "liquidated": [],
                "errors": []
            }
            
            if not orders:
                 # Check if we had positions
                 positions = alpaca_service.get_positions()
                 if not positions:
                     return {"message": "No positions to liquidate", "count": 0}
                 else:
                     return {"error": "Failed to close positions"}
            
            for order in orders:
                results["liquidated"].append(f"{order.symbol} ({order.qty} shares)")
                
                # We should log these sells in DB too?
                # The sync will handle removing holdings.
                # But creating Trade entries for history is good.
                
                # Since we don't have exact trade details until fill, maybe just skip logging
                # individual trades here and let user rely on Alpaca dashboard?
                # Or create a log.
                
                # Let's create an activity log for the panic sell
                pass
            
            log = ActivityLog(
                action="PANIC_SELL",
                details=f"Liquidated all positions: {', '.join(results['liquidated'])}"
            )
            db.add(log)
            db.commit()
            
            return results
            
        except Exception as e:
            logger.error(f"Error in liquidate_portfolio: {str(e)}")
            return {"error": str(e)}
    
    def get_todays_trade_counts(self, db: Session) -> Dict[str, int]:
        """Get number of buy and sell trades executed today"""
        try:
            today = date.today()
            start_of_day = datetime.combine(today, datetime.min.time())
            
            buys = db.query(Trades).filter(
                Trades.executed_at >= start_of_day,
                Trades.action == TradeAction.BUY
            ).count()
            
            sells = db.query(Trades).filter(
                Trades.executed_at >= start_of_day,
                Trades.action == TradeAction.SELL
            ).count()
            
            return {
                "bought": buys,
                "sold": sells,
                "total": buys + sells
            }
        except Exception as e:
            logger.error(f"Error getting today's trade counts: {str(e)}")
            return {"bought": 0, "sold": 0, "total": 0}

    def can_make_trade(self, db: Session, max_daily_trades: int) -> bool:
        """Check if we can make another trade today"""
        return True

# Global instance
portfolio_service = PortfolioService()