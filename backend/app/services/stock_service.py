import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging
from app.models.schemas import StockInfo, MarketDataResponse
from app.models.models import MarketData
from sqlalchemy.orm import Session
from app.services.alpaca_service import alpaca_service

logger = logging.getLogger(__name__)

class StockService:
    def __init__(self):
        self.cache = {}
        self.cache_duration = timedelta(seconds=55)  # Cache for 55s to ensure expiry before 60s frontend poll
    
    async def get_stock_info(self, symbol: str, db_session=None) -> Optional[StockInfo]:
        """Get comprehensive stock information using Alpaca"""
        try:
            # Check cache first
            cache_key = f"{symbol}_info"
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            # Use Alpaca
            stock_info = await alpaca_service.get_stock_info(symbol)
            if stock_info:
                logger.info(f"Successfully fetched {symbol} data from Alpaca")
                self._cache_data(cache_key, stock_info)
                return stock_info
            else:
                logger.error(f"Failed to fetch stock info for {symbol} from Alpaca")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching stock info for {symbol}: {str(e)}")
            return None
    
    async def get_current_price(self, symbol: str) -> Optional[float]:
        """Get current stock price using Alpaca"""
        try:
            # Check cache first
            cache_key = f"{symbol}_price"
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            # Use Alpaca
            current_price = await alpaca_service.get_current_price(symbol)
            if current_price:
                logger.info(f"Successfully fetched {symbol} price from Alpaca: ${current_price}")
                self._cache_data(cache_key, current_price)
                return current_price
            else:
                logger.error(f"Failed to fetch price for {symbol} from Alpaca")
                return None
            
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {str(e)}")
            return None
    
    async def get_historical_data(self, symbol: str, period: str = "1mo") -> Optional[Dict]:
        """Get historical stock data using Alpaca"""
        try:
            # Check cache first
            cache_key = f"{symbol}_historical_{period}"
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            # Use Alpaca
            # Note: StockService expects Dict/JSON, but AlpacaService returns Dict
            historical_data = await alpaca_service.get_historical_data(symbol, period)
            
            if historical_data:
                logger.info(f"Successfully fetched historical data for {symbol} from Alpaca")
                self._cache_data(cache_key, historical_data)
                return historical_data
            else:
                logger.error(f"Failed to fetch historical data for {symbol} from Alpaca")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            return None
    
    def get_trending_stocks(self) -> List[str]:
        """Get list of trending stock symbols"""
        # Return a curated list of popular stocks
        return [
            "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
            "META", "NVDA", "NFLX", "AMD", "INTC",
            "SPY", "QQQ", "IWM", "DIA", "VTI"
        ]
    
    async def validate_symbol(self, symbol: str) -> bool:
        """Validate if a stock symbol exists using Alpaca"""
        try:
            return await alpaca_service.validate_symbol(symbol)
        except:
            return False
    
    def get_market_status(self) -> Dict[str, bool]:
        """Check if market is currently open"""
        try:
            status = alpaca_service.get_market_status()
            
            # If alpaca service returns error or is not configured, fallback to time-based logic?
            # Or just return what Alpaca says.
            # Alpaca service returns {"is_open": bool, ...} which matches expectation
            return status
            
        except Exception as e:
            logger.error(f"Error checking market status: {str(e)}")
            return {"is_open": False, "error": str(e)}
    
    def save_market_data(self, db: Session, symbol: str, price: float, 
                        volume: Optional[int] = None, change_percent: Optional[float] = None):
        """Save market data to database"""
        try:
            market_data = MarketData(
                symbol=symbol.upper(),
                price=price,
                volume=volume,
                change_percent=change_percent
            )
            db.add(market_data)
            db.commit()
            db.refresh(market_data)
            return market_data
        except Exception as e:
            logger.error(f"Error saving market data: {str(e)}")
            db.rollback()
            return None
    
    def _is_cached(self, key: str) -> bool:
        """Check if data is cached and still valid"""
        if key not in self.cache:
            return False
        
        cached_time = self.cache[key]["timestamp"]
        return datetime.now() - cached_time < self.cache_duration
    
    def _cache_data(self, key: str, data):
        """Cache data with timestamp"""
        self.cache[key] = {
            "data": data,
            "timestamp": datetime.now()
        }

# Global instance
stock_service = StockService()