from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict
import logging

from app.models.database import get_db
from app.models.schemas import StockInfo, MarketDataResponse, APIResponse
from app.services.stock_service import stock_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{symbol}", response_model=StockInfo)
async def get_stock_info(symbol: str):
    """Get comprehensive stock information"""
    try:
        symbol = symbol.upper()
        stock_info = stock_service.get_stock_info(symbol)
        
        if not stock_info:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        
        return stock_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stock info for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{symbol}/price")
async def get_stock_price(symbol: str):
    """Get current stock price"""
    try:
        symbol = symbol.upper()
        price = stock_service.get_current_price(symbol)
        
        if price is None:
            raise HTTPException(status_code=404, detail=f"Price for {symbol} not found")
        
        return {
            "symbol": symbol,
            "price": price,
            "timestamp": "2024-01-01T00:00:00Z"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting price for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{symbol}/history")
async def get_stock_history(
    symbol: str, 
    period: str = Query(default="1mo", description="Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max")
):
    """Get historical stock data"""
    try:
        symbol = symbol.upper()
        
        # Validate period
        valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
        if period not in valid_periods:
            raise HTTPException(status_code=400, detail=f"Invalid period. Must be one of: {', '.join(valid_periods)}")
        
        historical_data = stock_service.get_historical_data(symbol, period)
        
        if historical_data is None or historical_data.empty:
            raise HTTPException(status_code=404, detail=f"Historical data for {symbol} not found")
        
        # Convert DataFrame to JSON-serializable format
        data = []
        for index, row in historical_data.iterrows():
            data.append({
                "date": index.strftime("%Y-%m-%d"),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "volume": int(row['Volume'])
            })
        
        return {
            "symbol": symbol,
            "period": period,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting historical data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/market/trending")
async def get_trending_stocks():
    """Get list of trending stocks"""
    try:
        trending = stock_service.get_trending_stocks()
        
        # Get basic info for each trending stock
        stocks_info = []
        for symbol in trending[:10]:  # Limit to top 10 to avoid rate limits
            try:
                info = stock_service.get_stock_info(symbol)
                if info:
                    stocks_info.append(info)
            except Exception as e:
                logger.warning(f"Could not get info for trending stock {symbol}: {str(e)}")
                continue
        
        return {
            "trending_symbols": trending,
            "stocks_info": stocks_info
        }
    except Exception as e:
        logger.error(f"Error getting trending stocks: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/market/status")
async def get_market_status():
    """Get current market status"""
    try:
        status = stock_service.get_market_status()
        return status
    except Exception as e:
        logger.error(f"Error getting market status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/validate/{symbol}", response_model=APIResponse)
async def validate_stock_symbol(symbol: str):
    """Validate if a stock symbol exists"""
    try:
        symbol = symbol.upper()
        is_valid = stock_service.validate_symbol(symbol)
        
        return APIResponse(
            success=is_valid,
            message=f"Symbol {symbol} is {'valid' if is_valid else 'invalid'}",
            data={"symbol": symbol, "valid": is_valid}
        )
    except Exception as e:
        logger.error(f"Error validating symbol {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{symbol}/save-data")
async def save_market_data(symbol: str, db: Session = Depends(get_db)):
    """Save current market data to database"""
    try:
        symbol = symbol.upper()
        stock_info = stock_service.get_stock_info(symbol)
        
        if not stock_info:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        
        market_data = stock_service.save_market_data(
            db=db,
            symbol=symbol,
            price=stock_info.current_price,
            volume=stock_info.volume,
            change_percent=stock_info.change_percent
        )
        
        if not market_data:
            raise HTTPException(status_code=500, detail="Failed to save market data")
        
        return APIResponse(
            success=True,
            message=f"Market data saved for {symbol}",
            data={"id": market_data.id, "symbol": symbol, "price": stock_info.current_price}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving market data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")