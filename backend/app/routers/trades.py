from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.auth import require_write_access
from app.models.models import User
from typing import List
import logging

from app.models.database import get_db
from app.models.schemas import TradeResponse, APIResponse
from app.services.portfolio_service import portfolio_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[TradeResponse])
async def get_trading_history(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=1000, description="Number of trades to return"),
    offset: int = Query(default=0, ge=0, description="Number of trades to skip")
):
    """Get trading history with pagination"""
    try:
        trades = portfolio_service.get_trading_history(db, limit=limit, offset=offset)
        return trades
    except Exception as e:
        logger.error(f"Error getting trading history: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/today", response_model=List[TradeResponse])
async def get_todays_trades(db: Session = Depends(get_db)):
    """Get all trades executed today"""
    try:
        from datetime import date, datetime
        from app.models.models import Trades
        
        today = date.today()
        trades = db.query(Trades).filter(
            Trades.executed_at >= datetime.combine(today, datetime.min.time())
        ).order_by(Trades.executed_at.desc()).all()
        
        return [TradeResponse.from_orm(trade) for trade in trades]
    except Exception as e:
        logger.error(f"Error getting today's trades: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/count/today")
async def get_todays_trade_count(db: Session = Depends(get_db)):
    """Get count of trades executed today"""
    try:
        count = portfolio_service.get_trades_today(db)
        return {
            "trades_today": count,
            "date": "2024-01-01"
        }
    except Exception as e:
        logger.error(f"Error getting today's trade count: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/by-symbol/{symbol}", response_model=List[TradeResponse])
async def get_trades_by_symbol(
    symbol: str,
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=1000)
):
    """Get trading history for a specific symbol"""
    try:
        from app.models.models import Trades
        
        symbol = symbol.upper()
        trades = db.query(Trades).filter(
            Trades.symbol == symbol
        ).order_by(Trades.executed_at.desc()).limit(limit).all()
        
        return [TradeResponse.from_orm(trade) for trade in trades]
    except Exception as e:
        logger.error(f"Error getting trades for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/stats/summary")
async def get_trade_summary(db: Session = Depends(get_db)):
    """Get trading summary statistics"""
    try:
        stats = portfolio_service.get_trading_stats(db)
        if not stats:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0.0,
                "total_profit_loss": 0.0,
                "average_trade_return": 0.0,
                "best_trade": None,
                "worst_trade": None,
                "best_open_position": None,
                "worst_open_position": None,
                "best_open_symbol": None,
                "worst_open_symbol": None
            }
        
        return {
            "total_trades": stats.total_trades,
            "winning_trades": stats.winning_trades,
            "losing_trades": stats.losing_trades,
            "win_rate": stats.win_rate,
            "total_profit_loss": stats.total_profit_loss,
            "average_trade_return": stats.average_trade_return,
            "best_trade": stats.best_trade,
            "worst_trade": stats.worst_trade,
            "best_open_position": stats.best_open_position,
            "worst_open_position": stats.worst_open_position,
            "best_open_symbol": stats.best_open_symbol,
            "worst_open_symbol": stats.worst_open_symbol
        }
    except Exception as e:
        logger.error(f"Error getting trade summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/report/daily")
async def get_daily_report(db: Session = Depends(get_db)):
    """Get detailed daily report of trades and AI model performance"""
    try:
        report_data = portfolio_service.get_daily_report_data(db)
        
        return {
            "date": report_data["date"],
            "models": report_data["models"],
            "trades": report_data["trades"]
        }
    except Exception as e:
        logger.error(f"Error generating daily report API response: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/performance/intraday")
async def get_intraday_performance(db: Session = Depends(get_db)):
    """Get intraday P&L per AI model.
    - realized_series: FIFO-matched cumulative realized P&L from today's sell trades
    - total_series: PortfolioSnapshot time-series (realized + unrealized) — fluctuates with prices
    - unrealized_pnl: current snapshot for summary chips
    """
    try:
        from app.models.models import Trades, TradeAction, Holdings, PortfolioSnapshot
        from datetime import date, datetime
        import pytz

        today = date.today()
        start_of_day = datetime.combine(today, datetime.min.time())
        start_naive = start_of_day.replace(tzinfo=None)
        now_time = datetime.now().strftime("%H:%M:%S")

        providers = ["OPENAI", "GEMINI", "ANTHROPIC"]

        # ── Realized series: FIFO from today's sell trades ─────────────────
        all_trades = db.query(Trades).order_by(Trades.executed_at.asc()).all()
        queues = {p: {} for p in providers}
        series = {p: [] for p in providers}
        cumulative = {p: 0.0 for p in providers}

        for trade in all_trades:
            p = trade.ai_provider or "OPENAI"
            if p not in queues:
                queues[p] = {}
                series[p] = []
                cumulative[p] = 0.0

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
                exec_naive = trade.executed_at.replace(tzinfo=None) if trade.executed_at else None
                if exec_naive and exec_naive >= start_naive:
                    cumulative[p] += profit
                    series[p].append({
                        "time": exec_naive.strftime("%H:%M:%S"),
                        "cumulative_pnl": round(cumulative[p], 2)
                    })

        # ── Total P&L series: from PortfolioSnapshot (fluctuates with prices) ──
        est = pytz.timezone("US/Eastern")
        start_utc = pytz.utc.localize(start_of_day)
        snapshots = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.snapshot_at >= start_utc)
            .order_by(PortfolioSnapshot.snapshot_at.asc())
            .all()
        )
        total_series = {p: [] for p in providers}
        for snap in snapshots:
            p = snap.ai_provider or "OPENAI"
            if p not in total_series:
                total_series[p] = []
            snap_local = snap.snapshot_at.astimezone(est)
            total_series[p].append({
                "time": snap_local.strftime("%H:%M:%S"),
                "total_pnl": round(snap.total_pnl, 2)
            })

        # ── Current unrealized for summary chips ────────────────────────────
        holdings = db.query(Holdings).all()
        unrealized = {p: 0.0 for p in providers}
        for h in holdings:
            p = h.ai_provider or "OPENAI"
            if p not in unrealized:
                unrealized[p] = 0.0
            unrealized[p] += (h.current_price - h.average_cost) * h.quantity

        # Anchor realized series at $0 at market open
        anchor = {"time": "09:30:00", "cumulative_pnl": 0.0}
        result = {}
        for p in set(list(providers) + list(series.keys())):
            pts = series.get(p, [])
            if pts and pts[0]["time"] > "09:30:00":
                pts = [anchor] + pts
            elif not pts:
                pts = [anchor]
            result[p] = pts

        return {
            "date": today.strftime("%Y-%m-%d"),
            "providers": result,
            "total_series": total_series,
            "unrealized_pnl": {p: round(v, 2) for p, v in unrealized.items()},
            "now_time": now_time,
        }

    except Exception as e:
        logger.error(f"Error getting intraday performance: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/performance/daily")
async def get_daily_performance(db: Session = Depends(get_db)):
    """Get daily trading performance"""
    try:
        from app.models.models import Trades
        from sqlalchemy import func, desc
        from datetime import datetime, timedelta
        
        # Get trades from last 30 days grouped by date
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        daily_stats = db.query(
            func.date(Trades.executed_at).label('date'),
            func.count(Trades.id).label('trade_count'),
            func.sum(Trades.total_amount).label('total_volume')
        ).filter(
            Trades.executed_at >= thirty_days_ago
        ).group_by(
            func.date(Trades.executed_at)
        ).order_by(desc('date')).all()
        
        performance_data = []
        for stat in daily_stats:
            performance_data.append({
                "date": stat.date.strftime("%Y-%m-%d"),
                "trade_count": stat.trade_count,
                "total_volume": float(stat.total_volume)
            })
        
        return {
            "period": "30_days",
            "daily_performance": performance_data
        }
    except Exception as e:
        logger.error(f"Error getting daily performance: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade_by_id(trade_id: int, db: Session = Depends(get_db)):
    """Get a specific trade by ID"""
    try:
        from app.models.models import Trades
        
        trade = db.query(Trades).filter(Trades.id == trade_id).first()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        
        return TradeResponse.from_orm(trade)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trade {trade_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{trade_id}", response_model=APIResponse)
async def delete_trade(
    trade_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access)
):
    """Delete a trade (for testing purposes only)"""
    try:
        from app.models.models import Trades
        
        trade = db.query(Trades).filter(Trades.id == trade_id).first()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        
        # Note: In a real trading system, you wouldn't delete trades
        # This is only for testing/development purposes
        db.delete(trade)
        db.commit()
        
        logger.warning(f"Trade {trade_id} deleted (testing only)")
        return APIResponse(
            success=True,
            message=f"Trade {trade_id} deleted successfully",
            data={"trade_id": trade_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting trade {trade_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
