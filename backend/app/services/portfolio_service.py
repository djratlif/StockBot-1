from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Tuple, Any
import logging
from datetime import datetime, date
import pytz
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
        self.est = pytz.timezone("US/Eastern")
    
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
                cash_balance = float(account.non_marginable_buying_power)
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
                portfolio.cash_balance = float(account.non_marginable_buying_power)
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
            
            # 2.5 Fetch open orders to protect pending holdings
            try:
                open_orders = alpaca_service.get_orders(status='open')
                pending_symbols = {o.symbol for o in open_orders}
            except Exception:
                pending_symbols = set()
            
            # Get local holdings
            local_holdings = db.query(Holdings).all()

            # Build per-symbol local totals to detect drift vs Alpaca
            local_by_symbol: Dict[str, list] = {}
            for h in local_holdings:
                local_by_symbol.setdefault(h.symbol, []).append(h)

            # Update or Delete local holdings based on Alpaca data
            for symbol, rows in local_by_symbol.items():
                if symbol in alpaca_map:
                    pos = alpaca_map[symbol]
                    alpaca_qty = float(pos.qty)
                    local_total = sum(r.quantity for r in rows)

                    # Update price on all rows
                    for r in rows:
                        r.current_price = float(pos.current_price)

                    # If local quantities exceed Alpaca, scale them down proportionally
                    if local_total > alpaca_qty + 0.001:
                        scale = alpaca_qty / local_total
                        remaining = alpaca_qty
                        for i, r in enumerate(rows):
                            if i == len(rows) - 1:
                                r.quantity = max(0, remaining)
                            else:
                                new_qty = round(r.quantity * scale)
                                r.quantity = new_qty
                                remaining -= new_qty
                            if r.quantity <= 0:
                                db.delete(r)
                elif symbol in pending_symbols:
                    # Keep holding active since the order is still open on Alpaca
                    continue
                else:
                    # Delete (no longer held in Alpaca, e.g. liquidated)
                    for r in rows:
                        db.delete(r)
            
            # Don't create new holdings generically. 
            # We want trades executed by the bot to create the AI-specific holding rows.
            # E.g. manual buys in Alpaca UI won't be assigned an AI provider, so we skip adding them here.
            
            db.commit()
            
            # Recalculate metrics based on fresh data
            holdings = db.query(Holdings).all()
            total_invested = sum(abs(h.quantity) * h.average_cost for h in holdings)
            holdings_value = sum(abs(h.quantity) * h.current_price for h in holdings)
            
            # Calculate daily change
            # Alpaca account object has equity and last_equity (from previous close)
            daily_change = 0
            daily_change_percent = 0
            
            if account:
                daily_change = float(account.equity) - float(account.last_equity)
                daily_change_percent = (daily_change / float(account.last_equity)) * 100 if float(account.last_equity) > 0 else 0
            
            # Calculate total return based strictly on account equity
            total_return = portfolio.total_value - settings.initial_balance
            return_percentage = (total_return / settings.initial_balance) * 100 if settings.initial_balance > 0 else 0
            
            return PortfolioSummary(
                cash_balance=portfolio.cash_balance,
                total_value=portfolio.total_value,
                holdings_value=holdings_value,
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
                side=side,
                take_profit_price=decision.target_price,
                stop_loss_price=decision.stop_loss_price
            )
            
            if not order:
                logger.error(f"Failed to submit order for {decision.symbol}")
                return None
            
            trade = Trades(
                user_id=portfolio.user_id,
                symbol=decision.symbol,
                action=TradeAction.BUY if decision.action == TradeActionEnum.BUY else TradeAction.SELL,
                quantity=decision.quantity,
                price=decision.current_price, # Estimated price
                total_amount=decision.quantity * decision.current_price, # Estimated amount
                target_price=decision.target_price,
                stop_loss_price=decision.stop_loss_price,
                ai_reasoning=decision.reasoning,
                ai_provider=decision.ai_provider
                # We can store Alpaca Order ID if we added a column, but for now skipping
            )
            db.add(trade)
            
            # Update specific AI's holdings
            provider = decision.ai_provider or "OPENAI"
            holding = db.query(Holdings).filter(
                Holdings.symbol == decision.symbol,
                Holdings.ai_provider == provider
            ).first()

            if decision.action == TradeActionEnum.BUY:
                if holding:
                    # Update existing holding for this specific AI
                    total_quantity = holding.quantity + decision.quantity
                    new_total_cost = (holding.quantity * holding.average_cost) + (decision.quantity * decision.current_price)
                    holding.average_cost = new_total_cost / total_quantity
                    holding.quantity = total_quantity
                    holding.current_price = decision.current_price
                else:
                    # Create new holding strictly for this AI
                    new_holding = Holdings(
                        user_id=portfolio.user_id,
                        symbol=decision.symbol,
                        quantity=decision.quantity,
                        average_cost=decision.current_price,
                        current_price=decision.current_price,
                        ai_provider=provider
                    )
                    db.add(new_holding)
            elif decision.action == TradeActionEnum.SELL:
                if holding:
                    holding.quantity -= decision.quantity
                    if holding.quantity <= 0:
                        db.delete(holding)
            
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
    
    def _compute_fifo_realized_pnl(
        self,
        trades: list,
        since: Optional[datetime] = None,
    ) -> Dict[str, float]:
        """
        Run a chronological FIFO simulation over *trades* (already sorted asc).

        Returns a dict mapping ai_provider -> cumulative realized P&L.
        If *since* is provided, only sells executed on or after that datetime
        contribute to the totals (buys are always consumed to keep the queue
        accurate regardless of date).
        """
        queues: Dict[str, Dict] = {}
        realized: Dict[str, float] = {}
        since_naive = since.replace(tzinfo=None) if since else None

        for trade in trades:
            p = trade.ai_provider or "OPENAI"
            if p not in queues:
                queues[p] = {}
                realized[p] = 0.0
            sym = trade.symbol
            if sym not in queues[p]:
                queues[p][sym] = []

            if trade.action == TradeAction.BUY:
                queues[p][sym].append({"qty": trade.quantity, "price": trade.price})
            elif trade.action == TradeAction.SELL:
                qty = trade.quantity
                profit = 0.0
                q = queues[p][sym]
                while qty > 0 and q:
                    buy = q[0]
                    if buy["qty"] <= qty:
                        profit += (trade.price - buy["price"]) * buy["qty"]
                        qty -= buy["qty"]
                        q.pop(0)
                    else:
                        profit += (trade.price - buy["price"]) * qty
                        buy["qty"] -= qty
                        qty = 0

                # Only count if after the *since* cutoff (or no cutoff)
                if since_naive is None:
                    realized[p] += profit
                else:
                    exec_naive = (
                        trade.executed_at.replace(tzinfo=None)
                        if trade.executed_at
                        else None
                    )
                    if exec_naive and exec_naive >= since_naive:
                        realized[p] += profit

        return realized

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
            
            # 2. FIFO matching — per-sell granularity needed for best/worst/avg stats
            today = date.today()

            # Make sure we process chronologically
            trades_chronological = sorted(trades, key=lambda t: t.executed_at if t.executed_at else datetime.min)

            symbol_queues: Dict[str, list] = {}
            closed_trades_today = []
            total_profit_loss = 0.0
            for trade in trades_chronological:
                sym = trade.symbol
                if sym not in symbol_queues:
                    symbol_queues[sym] = []
                if trade.action == TradeAction.BUY:
                    symbol_queues[sym].append({"qty": trade.quantity, "price": trade.price})
                elif trade.action == TradeAction.SELL:
                    qty = trade.quantity
                    profit = 0.0
                    q = symbol_queues[sym]
                    while qty > 0 and q:
                        buy = q[0]
                        if buy["qty"] <= qty:
                            profit += (trade.price - buy["price"]) * buy["qty"]
                            qty -= buy["qty"]
                            q.pop(0)
                        else:
                            profit += (trade.price - buy["price"]) * qty
                            buy["qty"] -= qty
                            qty = 0
                    total_profit_loss += profit
                    if trade.executed_at and trade.executed_at.date() == today:
                        closed_trades_today.append(profit)
            
            winning_trades = sum(1 for p in closed_trades_today if p > 0)
            losing_trades = sum(1 for p in closed_trades_today if p <= 0)
            total_trades_today = len(closed_trades_today)
            
            win_rate = (winning_trades / total_trades_today) * 100 if total_trades_today > 0 else 0.0
            average_trade_return = sum(closed_trades_today) / total_trades_today if total_trades_today > 0 else 0.0
            best_trade = max(closed_trades_today) if closed_trades_today else None
            worst_trade = min(closed_trades_today) if closed_trades_today else None
            
            return TradingStats(
                total_trades=total_trades_today,
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
    
    def get_current_holdings_dict(self, db: Session, ai_provider: Optional[str] = None) -> Dict[str, Dict]:
        """Get current holdings as a dictionary for AI analysis"""
        try:
            query = db.query(Holdings)
            if ai_provider:
                query = query.filter(Holdings.ai_provider == ai_provider)
                
            holdings = query.all()
            result = {}
            for holding in holdings:
                result[holding.symbol] = {
                    'quantity': holding.quantity,
                    'average_cost': holding.average_cost,
                    'current_price': holding.current_price,
                    'ai_provider': holding.ai_provider
                }
            return result
        except Exception as e:
            logger.error(f"Error getting holdings dict: {str(e)}")
            return {}
    
    def get_trades_today(self, db: Session) -> int:
        """Get number of trades executed today"""
        try:
            today = date.today()
            start_of_day_est = self.est.localize(datetime.combine(today, datetime.min.time()))
            start_utc = start_of_day_est.astimezone(pytz.utc)

            trades_today = db.query(Trades).filter(
                Trades.executed_at >= start_utc
            ).count()
            return trades_today
        except Exception as e:
            logger.error(f"Error getting today's trades count: {str(e)}")
            return 0
    
    def liquidate_portfolio(self, db: Session) -> Dict[str, Any]:
        """Liquidate all holdings (Panic Sell) via Alpaca"""
        try:
            # Call Alpaca to close all positions
            # returns list of orders or a single multi-order object
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
            
            # Delete all local holdings because the portfolio is completely dumped on Alpaca
            db.query(Holdings).delete()
            
            # orders might be a list of Position objects or Order objects or a wrapper
            # If it's iterable, try to extract symbol and qty
            try:
                for order in orders:
                    # Depending on Alpaca's return type for close_all_positions, we might not have symbol directly.
                    # It usually returns a list of Order objects.
                    symbol = getattr(order, 'symbol', 'Unknown')
                    qty = getattr(order, 'qty', 'All')
                    results["liquidated"].append(f"{symbol} ({qty} shares)")
            except Exception as e:
                logger.warning(f"Could not parse Alpaca close_all_positions return type: {e}")
                results["liquidated"].append("All current positions")
            
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
            start_of_day_est = self.est.localize(datetime.combine(today, datetime.min.time()))
            start_of_day = start_of_day_est.astimezone(pytz.utc)
            
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

    async def get_daily_report_data(self, db: Session) -> Dict[str, Any]:
        """Calculates the daily performance metrics for all AI providers"""
        try:
            today = date.today()
            start_of_day_est = self.est.localize(datetime.combine(today, datetime.min.time()))
            start_of_day = start_of_day_est.astimezone(pytz.utc)

            # Fetch market performance for comparison
            market_performance = None
            try:
                spy_info = await stock_service.get_stock_info("SPY", db_session=db)
                if spy_info:
                    # Handles both Pydantic models (fresh fetch) and Dicts (Redis cache hit)
                    spy_price = spy_info.current_price if hasattr(spy_info, 'current_price') else spy_info.get('current_price', 0.0)
                    spy_change = spy_info.change_percent if hasattr(spy_info, 'change_percent') else spy_info.get('change_percent', 0.0)
                    
                    market_performance = {
                        "symbol": "SPY",
                        "price": spy_price,
                        "change_percent": spy_change
                    }
            except Exception as e:
                logger.error(f"Error fetching SPY info for report: {e}")

            # Get trades since start of day to calculate daily P&L and metricsngs
            todays_trades = db.query(Trades).filter(
                Trades.executed_at >= start_of_day
            ).order_by(Trades.executed_at.desc()).all()
            
            holdings = db.query(Holdings).all()
            
            # Fetch overall portfolio totals
            from app.services.alpaca_service import alpaca_service
            account = alpaca_service.get_account()
            portfolio_value = 0.0
            daily_pnl = 0.0
            daily_pnl_percent = 0.0
            
            alpaca_positions = alpaca_service.get_positions()
            intraday_pl_per_share = {}
            for pos in alpaca_positions:
                try:
                    qty = float(pos.qty)
                    if qty != 0:
                        intraday_pl_per_share[pos.symbol] = float(pos.unrealized_intraday_pl) / qty
                except Exception:
                    pass
            
            if account:
                portfolio_value = float(account.equity)
                last_equity = float(account.last_equity)
                daily_pnl = portfolio_value - last_equity
                if last_equity > 0:
                    daily_pnl_percent = (daily_pnl / last_equity) * 100
            else:
                portfolio = self.get_portfolio(db)
                if portfolio:
                    portfolio_value = portfolio.total_value
            
            # Aggregate performance
            providers = ["OPENAI", "GEMINI", "ANTHROPIC"]
            model_stats = {}
            for p in providers:
                model_stats[p] = {
                    "provider": p, "trades_today": 0, "invested_amount": 0.0,
                    "current_value": 0.0, "open_pnl": 0.0, "profitable_positions": 0,
                    "total_positions": 0, "win_rate": 0.0, "score": 0
                }
            
            # --- FIFO REALIZED PNL & WIN RATE CALCULATION ---
            all_trades = db.query(Trades).order_by(Trades.executed_at.asc()).all()
            realized_pnls = self._compute_fifo_realized_pnl(all_trades, since=start_of_day)

            # Win rate requires per-sell granularity — track winning/total sells today
            winning_sells: Dict[str, int] = {}
            total_sells: Dict[str, int] = {}
            symbol_queues_wr: Dict[str, Dict] = {}
            start_naive = start_of_day.replace(tzinfo=None)

            for trade in all_trades:
                p = trade.ai_provider or "OPENAI"
                if p not in symbol_queues_wr:
                    symbol_queues_wr[p] = {}
                    winning_sells[p] = 0
                    total_sells[p] = 0
                sym = trade.symbol
                if sym not in symbol_queues_wr[p]:
                    symbol_queues_wr[p][sym] = []
                if trade.action == TradeAction.BUY:
                    symbol_queues_wr[p][sym].append({"qty": trade.quantity, "price": trade.price})
                elif trade.action == TradeAction.SELL:
                    qty = trade.quantity
                    profit = 0.0
                    q = symbol_queues_wr[p][sym]
                    while qty > 0 and q:
                        buy = q[0]
                        if buy["qty"] <= qty:
                            profit += (trade.price - buy["price"]) * buy["qty"]
                            qty -= buy["qty"]
                            q.pop(0)
                        else:
                            profit += (trade.price - buy["price"]) * qty
                            buy["qty"] -= qty
                            qty = 0
                    exec_naive = trade.executed_at.replace(tzinfo=None) if trade.executed_at else None
                    if exec_naive and exec_naive >= start_naive:
                        total_sells[p] += 1
                        if profit > 0:
                            winning_sells[p] += 1
            # --- END FIFO ---
                
            for trade in todays_trades:
                p = trade.ai_provider or "OPENAI"
                if p in model_stats:
                    model_stats[p]["trades_today"] += 1
                    
            for h in holdings:
                if h.quantity == 0: continue
                p = h.ai_provider or "OPENAI"
                if p not in model_stats:
                    model_stats[p] = {
                        "provider": p, "trades_today": 0, "invested_amount": 0.0,
                        "current_value": 0.0, "open_pnl": 0.0, "profitable_positions": 0,
                        "total_positions": 0, "win_rate": 0.0, "score": 0
                    }
                    
                invested = abs(h.quantity) * h.average_cost
                current = abs(h.quantity) * h.current_price
                
                model_stats[p]["total_positions"] += 1
                model_stats[p]["invested_amount"] += invested
                model_stats[p]["current_value"] += current
                
                # We need pnl here for profitable_positions and a fallback
                pnl = (h.current_price - h.average_cost) * h.quantity
                intraday_pnl = h.quantity * intraday_pl_per_share.get(h.symbol, 0.0)
                
                if "open_pnl" not in model_stats[p]:
                    model_stats[p]["open_pnl"] = 0
                model_stats[p]["open_pnl"] += intraday_pnl
                if pnl > 0:
                    model_stats[p]["profitable_positions"] += 1
                    
            for p, stats in model_stats.items():
                if p in total_sells and total_sells[p] > 0:
                    stats["win_rate"] = (winning_sells[p] / total_sells[p]) * 100
                elif stats["total_positions"] > 0:
                    # Fallback to open positions if no sells today
                    stats["win_rate"] = (stats["profitable_positions"] / stats["total_positions"]) * 100
                    
                # Use open_pnl + Win Rate for the score calculation
                pnl_percent = (stats["open_pnl"] / stats["invested_amount"]) * 100 if stats["invested_amount"] > 0 else 0
                if total_sells.get(p, 0) > 0 or stats["trades_today"] > 0:
                    score_calc = 50 + (pnl_percent * 2) + (stats["win_rate"] * 0.3)
                    stats["score"] = max(0, min(100, int(score_calc)))
            
            # Revert the mathematical bypass to ensure the Top Level Portfolio metrics 
            # are mathematically accurate to Alpaca regardless of unseen manual trades.
            actual_daily_pnl = sum(stats.get("open_pnl", 0.0) for stats in model_stats.values())
            
            # Summarize today's trades
            trade_summaries = {}
            for t in todays_trades:
                p = t.ai_provider or "OPENAI"
                key = f"{t.symbol}_{t.action.value}_{p}"
                if key not in trade_summaries:
                    trade_summaries[key] = {
                        "id": key,
                        "symbol": t.symbol,
                        "action": t.action.value,
                        "quantity": 0,
                        "total_amount": 0.0,
                        "ai_provider": p
                    }
                trade_summaries[key]["quantity"] += t.quantity
                trade_summaries[key]["total_amount"] += t.total_amount
                
            summarized_trades = list(trade_summaries.values())
            for st in summarized_trades:
                st["price"] = st["total_amount"] / st["quantity"] if st["quantity"] > 0 else 0

            # --- 7-DAY ROLLING TREND ---
            from app.models.models import PortfolioSnapshot
            from datetime import timedelta
            
            est = pytz.timezone('US/Eastern')
            eight_days_ago = datetime.now(est) - timedelta(days=8)
            
            snapshots = db.query(PortfolioSnapshot).filter(
                PortfolioSnapshot.snapshot_at >= eight_days_ago
            ).order_by(PortfolioSnapshot.snapshot_at.asc()).all()
            
            daily_trend = {}
            for snap in snapshots:
                dt_est = snap.snapshot_at.astimezone(est) if snap.snapshot_at.tzinfo else est.localize(snap.snapshot_at)
                d_str = dt_est.strftime("%a, %b %d") # "Mon, Mar 10"
                if d_str not in daily_trend:
                    daily_trend[d_str] = {"sort_key": dt_est.date()}
                daily_trend[d_str][snap.ai_provider] = snap.total_pnl
                
            trend_list = []
            previous_cumulative = None
            
            for d_str, data in sorted(daily_trend.items(), key=lambda x: x[1]["sort_key"]):
                day_cumulative_total = sum(v for k,v in data.items() if k != "sort_key")
                
                if previous_cumulative is None:
                    # Treat the very first day in the rolling 8-day window as the baseline
                    previous_cumulative = day_cumulative_total
                    continue
                    
                # Skip today since the whole email is about today
                if data["sort_key"] == today:
                    continue
                    
                daily_pnl_delta = day_cumulative_total - previous_cumulative
                trend_list.append({
                    "date": d_str,
                    "pnl": daily_pnl_delta
                })
                previous_cumulative = day_cumulative_total
                
            return {
                "date": today.strftime("%Y-%m-%d"),
                "models": list(model_stats.values()),
                "trades": summarized_trades,
                "portfolio_value": portfolio_value,
                "daily_pnl": daily_pnl,
                "daily_pnl_percent": daily_pnl_percent,
                "market_performance": market_performance,
                "seven_day_trend": trend_list[-7:] # Ensure we only grab the last 7 if there's slightly more
            }
        except Exception as e:
            logger.error(f"Error calculating daily report data: {str(e)}")
            raise e

    def can_make_trade(self, db: Session, max_daily_trades: int) -> bool:
        """Check if we can make another trade today"""
        try:
            today = date.today()
            start_of_day_est = self.est.localize(datetime.combine(today, datetime.min.time()))
            start_utc = start_of_day_est.astimezone(pytz.utc)

            trades_today = db.query(Trades).filter(
                Trades.executed_at >= start_utc
            ).count()
            return trades_today < max_daily_trades
        except Exception as e:
            logger.error(f"Error checking daily trade limit: {e}")
            return False

    def record_portfolio_snapshots(self, db: Session) -> None:
        """Record a per-provider P&L snapshot. Called every 5 minutes by the background task."""
        try:
            from app.models.models import Trades, Holdings, PortfolioSnapshot

            today = date.today()
            start_of_day_est = self.est.localize(datetime.combine(today, datetime.min.time()))
            start_of_day = start_of_day_est.astimezone(pytz.utc)

            # ── FIFO: compute realized P&L per provider ──────────────────────
            all_trades = db.query(Trades).order_by(Trades.executed_at.asc()).all()
            realized = self._compute_fifo_realized_pnl(all_trades, since=start_of_day)

            # ── Unrealized P&L from live holdings ────────────────────────────
            holdings = db.query(Holdings).all()
            unrealized: Dict[str, float] = {}
            for h in holdings:
                p = h.ai_provider or "OPENAI"
                if p not in unrealized:
                    unrealized[p] = 0.0
                unrealized[p] += (h.current_price - h.average_cost) * h.quantity

            # ── Write snapshot rows ───────────────────────────────────────────
            active_providers = set(list(realized.keys()) + list(unrealized.keys()))
            for p in active_providers:
                r = round(realized.get(p, 0.0), 4)
                u = round(unrealized.get(p, 0.0), 4)
                snap = PortfolioSnapshot(
                    ai_provider=p,
                    realized_pnl=r,
                    unrealized_pnl=u,
                    total_pnl=round(r + u, 4)
                )
                db.add(snap)
            db.commit()
            logger.info(f"Portfolio snapshots recorded for {len(active_providers)} providers")

        except Exception as e:
            logger.error(f"Error recording portfolio snapshots: {str(e)}")
            db.rollback()

    async def get_market_comparison(self, period: str = "1W") -> dict:
        """Fetch comparative line graph data for formatting into charting tools."""
        try:
            from alpaca.trading.requests import GetPortfolioHistoryRequest
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
            from alpaca.data.enums import DataFeed
            import datetime
            
            # 1. Fetch Portfolio History from Alpaca
            req = GetPortfolioHistoryRequest(period=period, timeframe="1D")
            port_history = alpaca_service.trading_client.get_portfolio_history(req)
            
            labels = []
            portfolio_pct = []
            
            for i in range(len(port_history.timestamp)):
                dt = datetime.datetime.fromtimestamp(port_history.timestamp[i])
                labels.append(dt.strftime("%b %d"))
                portfolio_pct.append(round(port_history.profit_loss_pct[i] * 100, 2))
                
            # 2. Fetch SPY History from Alpaca
            end_dt = datetime.datetime.now()
            days_back = 7 if period == "1W" else 30
            start_dt = end_dt - datetime.timedelta(days=days_back + 2) # buffer
            
            spy_req = StockBarsRequest(
                symbol_or_symbols="SPY",
                timeframe=TimeFrame.Day,
                start=start_dt,
                end=end_dt,
                feed=DataFeed.IEX
            )
            
            market_pct = []
            if alpaca_service.data_client:
                bars = alpaca_service.data_client.get_stock_bars(spy_req)
                if "SPY" in bars.df.index.get_level_values(0):
                    df = bars.df.loc["SPY"]
                    
                    # We need to compute SPY's percent change relative to the same starting point
                    first_port_ts = port_history.timestamp[0]
                    first_port_date = datetime.datetime.fromtimestamp(first_port_ts).date()
                    
                    baseline_close = None
                    for index, row in df.iterrows():
                        if index.date() <= first_port_date:
                            baseline_close = row['close']
                    
                    if baseline_close is None and not df.empty:
                        baseline_close = df.iloc[0]['close']
                        
                    # Map the SPY bars to the labels
                    for ts in port_history.timestamp:
                        target_date = datetime.datetime.fromtimestamp(ts).date()
                        current_close = baseline_close
                        for index, row in df.iterrows():
                            if index.date() <= target_date:
                                current_close = row['close']
                        
                        pct = ((current_close - baseline_close) / baseline_close) * 100 if baseline_close else 0
                        market_pct.append(round(pct, 2))
                else:
                    market_pct = [0] * len(labels)
            else:
                market_pct = [0] * len(labels)
                
            return {
                "labels": labels,
                "portfolio_pct": portfolio_pct,
                "market_pct": market_pct
            }
        except Exception as e:
            logger.error(f"Error generating comparative line graph data: {e}")
            return {"labels": [], "portfolio_pct": [], "market_pct": []}

# Global instance
portfolio_service = PortfolioService()