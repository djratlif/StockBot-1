from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Tuple
import logging
from datetime import datetime, date
from app.models.models import Portfolio, Holdings, Trades, BotConfig, TradeAction
from app.models.schemas import (
    PortfolioSummary, TradingStats, TradeCreate, TradingDecision, 
    TradeActionEnum, HoldingResponse, TradeResponse
)
from app.services.stock_service import stock_service
from app.config import settings

logger = logging.getLogger(__name__)

class PortfolioService:
    def __init__(self):
        pass
    
    def initialize_portfolio(self, db: Session) -> Portfolio:
        """Initialize portfolio with starting balance"""
        try:
            # Check if portfolio already exists
            portfolio = db.query(Portfolio).first()
            if portfolio:
                return portfolio
            
            # Create new portfolio with initial balance
            portfolio = Portfolio(
                cash_balance=settings.initial_balance,
                total_value=settings.initial_balance
            )
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
            
            logger.info(f"Portfolio initialized with ${settings.initial_balance}")
            return portfolio
            
        except Exception as e:
            logger.error(f"Error initializing portfolio: {str(e)}")
            db.rollback()
            raise
    
    def get_portfolio(self, db: Session) -> Optional[Portfolio]:
        """Get current portfolio"""
        return db.query(Portfolio).first()
    
    async def get_portfolio_summary(self, db: Session) -> Optional[PortfolioSummary]:
        """Get comprehensive portfolio summary"""
        try:
            portfolio = self.get_portfolio(db)
            if not portfolio:
                return None
            
            holdings = db.query(Holdings).all()
            
            # Calculate total invested and current value
            total_invested = 0
            current_holdings_value = 0
            
            for holding in holdings:
                # Update current price
                current_price = await stock_service.get_current_price(holding.symbol)
                if current_price:
                    holding.current_price = current_price
                    db.commit()
                
                total_invested += holding.quantity * holding.average_cost
                current_holdings_value += holding.quantity * holding.current_price
            
            # Update portfolio total value
            total_value = portfolio.cash_balance + current_holdings_value
            portfolio.total_value = total_value
            db.commit()
            
            # Calculate returns
            total_return = total_value - settings.initial_balance
            return_percentage = (total_return / settings.initial_balance) * 100 if settings.initial_balance > 0 else 0
            
            return PortfolioSummary(
                cash_balance=portfolio.cash_balance,
                total_value=total_value,
                total_invested=total_invested,
                total_return=total_return,
                return_percentage=return_percentage,
                holdings_count=len(holdings)
            )
            
        except Exception as e:
            logger.error(f"Error getting portfolio summary: {str(e)}")
            return None
    
    def get_holdings(self, db: Session) -> List[HoldingResponse]:
        """Get all current holdings with updated prices"""
        try:
            holdings = db.query(Holdings).all()
            result = []
            
            for holding in holdings:
                # Update current price
                current_price = stock_service.get_current_price(holding.symbol)
                if current_price:
                    holding.current_price = current_price
                    db.commit()
                
                result.append(HoldingResponse.from_orm(holding))
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting holdings: {str(e)}")
            return []
    
    def execute_trade(self, db: Session, decision: TradingDecision) -> Optional[TradeResponse]:
        """Execute a trading decision"""
        try:
            portfolio = self.get_portfolio(db)
            if not portfolio:
                logger.error("Portfolio not found")
                return None
            
            if decision.action == TradeActionEnum.BUY:
                return self._execute_buy_order(db, portfolio, decision)
            elif decision.action == TradeActionEnum.SELL:
                return self._execute_sell_order(db, portfolio, decision)
            
        except Exception as e:
            logger.error(f"Error executing trade: {str(e)}")
            db.rollback()
            return None
    
    def _execute_buy_order(self, db: Session, portfolio: Portfolio, decision: TradingDecision) -> Optional[TradeResponse]:
        """Execute a buy order"""
        try:
            total_cost = decision.quantity * decision.current_price
            
            # Check if we have enough cash
            if portfolio.cash_balance < total_cost:
                logger.warning(f"Insufficient funds for {decision.symbol}: need ${total_cost:.2f}, have ${portfolio.cash_balance:.2f}")
                return None
            
            # Update portfolio cash
            portfolio.cash_balance -= total_cost
            
            # Update or create holding
            holding = db.query(Holdings).filter(Holdings.symbol == decision.symbol).first()
            
            if holding:
                # Update existing holding
                total_shares = holding.quantity + decision.quantity
                total_cost_basis = (holding.quantity * holding.average_cost) + total_cost
                holding.average_cost = total_cost_basis / total_shares
                holding.quantity = total_shares
                holding.current_price = decision.current_price
            else:
                # Create new holding
                holding = Holdings(
                    symbol=decision.symbol,
                    quantity=decision.quantity,
                    average_cost=decision.current_price,
                    current_price=decision.current_price
                )
                db.add(holding)
            
            # Create trade record
            trade = Trades(
                symbol=decision.symbol,
                action=TradeAction.BUY,
                quantity=decision.quantity,
                price=decision.current_price,
                total_amount=total_cost,
                ai_reasoning=decision.reasoning
            )
            db.add(trade)
            
            db.commit()
            db.refresh(trade)
            
            logger.info(f"BUY executed: {decision.quantity} shares of {decision.symbol} at ${decision.current_price:.2f}")
            return TradeResponse.from_orm(trade)
            
        except Exception as e:
            logger.error(f"Error executing buy order: {str(e)}")
            db.rollback()
            return None
    
    def _execute_sell_order(self, db: Session, portfolio: Portfolio, decision: TradingDecision) -> Optional[TradeResponse]:
        """Execute a sell order"""
        try:
            # Find the holding
            holding = db.query(Holdings).filter(Holdings.symbol == decision.symbol).first()
            
            if not holding or holding.quantity < decision.quantity:
                logger.warning(f"Insufficient shares for {decision.symbol}: need {decision.quantity}, have {holding.quantity if holding else 0}")
                return None
            
            total_proceeds = decision.quantity * decision.current_price
            
            # Update portfolio cash
            portfolio.cash_balance += total_proceeds
            
            # Update holding
            holding.quantity -= decision.quantity
            holding.current_price = decision.current_price
            
            # Remove holding if quantity is 0
            if holding.quantity == 0:
                db.delete(holding)
            
            # Create trade record
            trade = Trades(
                symbol=decision.symbol,
                action=TradeAction.SELL,
                quantity=decision.quantity,
                price=decision.current_price,
                total_amount=total_proceeds,
                ai_reasoning=decision.reasoning
            )
            db.add(trade)
            
            db.commit()
            db.refresh(trade)
            
            logger.info(f"SELL executed: {decision.quantity} shares of {decision.symbol} at ${decision.current_price:.2f}")
            return TradeResponse.from_orm(trade)
            
        except Exception as e:
            logger.error(f"Error executing sell order: {str(e)}")
            db.rollback()
            return None
    
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
        try:
            trades = db.query(Trades).all()
            
            if not trades:
                return TradingStats(
                    total_trades=0,
                    winning_trades=0,
                    losing_trades=0,
                    win_rate=0.0,
                    total_profit_loss=0.0,
                    average_trade_return=0.0
                )
            
            # Calculate statistics
            total_trades = len(trades)
            profit_loss_by_symbol = {}
            
            # Group trades by symbol to calculate P&L
            for trade in trades:
                if trade.symbol not in profit_loss_by_symbol:
                    profit_loss_by_symbol[trade.symbol] = []
                
                profit_loss_by_symbol[trade.symbol].append({
                    'action': trade.action,
                    'quantity': trade.quantity,
                    'price': trade.price,
                    'total': trade.total_amount
                })
            
            # Calculate realized P&L
            total_profit_loss = 0
            winning_trades = 0
            losing_trades = 0
            trade_returns = []
            
            for symbol, symbol_trades in profit_loss_by_symbol.items():
                # Simple P&L calculation (can be enhanced)
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
                worst_trade=worst_trade
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
    
    def can_make_trade(self, db: Session, max_daily_trades: int) -> bool:
        """Check if we can make another trade today"""
        trades_today = self.get_trades_today(db)
        return trades_today < max_daily_trades

# Global instance
portfolio_service = PortfolioService()