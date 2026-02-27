import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
import json
import logging
from app.models.schemas import StockInfo, MarketDataResponse
from app.models.models import MarketData
from sqlalchemy.orm import Session
from app.services.alpaca_service import alpaca_service
import redis
from app.config import settings

logger = logging.getLogger(__name__)

class StockService:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        self.cache_duration = 55  # Cache for 55s to ensure expiry before 60s frontend poll
    
    async def get_stock_info(self, symbol: str, db_session=None) -> Optional[StockInfo]:
        """Get comprehensive stock information using Alpaca"""
        try:
            # Check cache first
            cache_key = f"{symbol}_info"
            cached_data = self._get_cached(cache_key)
            if cached_data:
                return cached_data
            
            # Use Alpaca
            stock_info = await alpaca_service.get_stock_info(symbol)
            if stock_info:
                print(f"[DATA] Fetched new data for {symbol} from Alpaca")
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
            cached_data = self._get_cached(cache_key)
            if cached_data is not None:
                return float(cached_data)
            
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
            cached_data = self._get_cached(cache_key)
            if cached_data:
                return cached_data
            
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
    
    def _get_cached(self, key: str):
        """Get data from Redis cache"""
        try:
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except redis.exceptions.ConnectionError:
            # We are using eager Celery mode, meaning Redis is not strictly required.
            # Do not log a loud error if the cache connection simply isn't there.
            return None
        except Exception as e:
            logger.error(f"Redis get error for {key}: {str(e)}")
            return None
    
    def _cache_data(self, key: str, data):
        """Cache data in Redis with expiration"""
        try:
            # Custom JSON encoder to handle datetime objects
            class DateTimeEncoder(json.JSONEncoder):
                def default(self, obj):
                    if isinstance(obj, datetime):
                        return obj.isoformat()
                    return super().default(obj)
                    
            # For Pydantic models (like StockInfo) which are not natively JSON serializable
            if hasattr(data, 'model_dump'):
                data_dict = data.model_dump()
            elif hasattr(data, 'dict'):
                data_dict = data.dict()
            else:
                data_dict = data
                
            self.redis_client.setex(
                key,
                self.cache_duration,
                json.dumps(data_dict, cls=DateTimeEncoder)
            )
        except redis.exceptions.ConnectionError:
            pass # Ignore connection errors in eager mode
        except Exception as e:
            logger.error(f"Redis set error for {key}: {str(e)}")

    async def fetch_news(self, symbol: str, limit: int = 5) -> List[Dict]:
        """Fetch latest news for a symbol using Alpaca's News API"""
        cache_key = f"news_{symbol}_{limit}"
        cached_data = self._get_cached(cache_key)
        if cached_data:
            return cached_data
            
        try:
            url = f"https://data.alpaca.markets/v1beta1/news?symbols={symbol}&limit={limit}"
            headers = {
                "APCA-API-KEY-ID": settings.alpaca_api_key,
                "APCA-API-SECRET-KEY": settings.alpaca_secret_key
            }
            
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        news = data.get("news", [])
                        
                        # Cache for 15 minutes
                        if news:
                            try:
                                self.redis_client.setex(cache_key, 900, json.dumps(news))
                            except redis.exceptions.ConnectionError:
                                pass # Ignore connection errors in eager mode
                        return news
            return []
        except Exception as e:
            logger.error(f"Error fetching news for {symbol}: {str(e)}")
            return []

stock_service = StockService()