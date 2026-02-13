from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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
    limit: int = Query(default=50, ge=1, le=200, description="Number of trades to return"),
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
    limit: int = Query(default=50, ge=1, le=200)
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
async def delete_trade(trade_id: int, db: Session = Depends(get_db)):
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
                "average_trade_return": 0.0
            }
        
        return {
            "total_trades": stats.total_trades,
            "winning_trades": stats.winning_trades,
            "losing_trades": stats.losing_trades,
            "win_rate": stats.win_rate,
            "total_profit_loss": stats.total_profit_loss,
            "average_trade_return": stats.average_trade_return,
            "best_trade": stats.best_trade,
            "worst_trade": stats.worst_trade
        }
    except Exception as e:
        logger.error(f"Error getting trade summary: {str(e)}")
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