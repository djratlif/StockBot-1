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
    
    async def _get_yahoo_data(self, symbol: str) -> Optional[Dict]:
        """Fetch real-time quote directly from Yahoo Finance without rate limits"""
        import aiohttp
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        meta = data['chart']['result'][0]['meta']
                        return {
                            "price": meta.get('regularMarketPrice', 0),
                            "prev_close": meta.get('chartPreviousClose', 0)
                        }
        except Exception as e:
            logger.error(f"Yahoo Finance fallback error for {symbol}: {str(e)}")
        return None

    async def get_stock_info(self, symbol: str, db_session=None) -> Optional[StockInfo]:
        """Get comprehensive stock information using Alpaca (with Yahoo fallback for SPY)"""
        try:
            # Check cache first
            cache_key = f"{symbol}_info"
            cached_data = self._get_cached(cache_key)
            if cached_data:
                return StockInfo(**cached_data)
                
            # Yahoo Fallback for SPY (due to IEX staleness)
            if symbol.upper() == "SPY":
                yahoo_data = await self._get_yahoo_data(symbol)
                if yahoo_data and yahoo_data['price'] > 0:
                    current_price = yahoo_data['price']
                    prev_close = yahoo_data['prev_close']
                    change_percent = ((current_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0
                    
                    stock_info = StockInfo(
                        symbol=symbol.upper(),
                        current_price=current_price,
                        change_percent=change_percent,
                        volume=0,
                        market_cap=None, pe_ratio=None, week_52_high=None, week_52_low=None
                    )
                    self._cache_data(cache_key, stock_info)
                    return stock_info

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
        """Get current stock price using Alpaca (with Yahoo fallback for SPY)"""
        try:
            # Check cache first
            cache_key = f"{symbol}_price"
            cached_data = self._get_cached(cache_key)
            if cached_data is not None:
                return float(cached_data)
                
            # Yahoo Fallback for SPY
            if symbol.upper() == "SPY":
                yahoo_data = await self._get_yahoo_data(symbol)
                if yahoo_data and yahoo_data['price'] > 0:
                    self._cache_data(cache_key, yahoo_data['price'])
                    return yahoo_data['price']
            
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
        """Get list of trending highly-volatile stock symbols"""
        # Return a curated list of volatile/popular tech stocks and crypto proxies
        return [
            "TSLA", "NVDA", "MSTR", "COIN", "AMD",
            "SMCI", "MARA", "PLTR", "ROKU", "SQ",
            "UPST", "AFRM", "HOOD", "CVNA", "RIVN"
        ]
        
    async def get_dynamic_trending_stocks(self) -> List[str]:
        """Get dynamically generated list of top moving stocks combined with core stocks"""
        core_stocks = self.get_trending_stocks()
        
        cache_key = "dynamic_trending_stocks_v2"
        cached_data = self._get_cached(cache_key)
        if cached_data:
            return cached_data
            
        dynamic_stocks = []
        try:
            url = "https://data.alpaca.markets/v1beta1/screener/stocks/movers"
            headers = {
                "APCA-API-KEY-ID": settings.alpaca_api_key,
                "APCA-API-SECRET-KEY": settings.alpaca_secret_key
            }
            
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        gainers = data.get("gainers", [])
                        losers = data.get("losers", [])
                        
                        # Filter criteria: price >= $2.00, avoid thinly traded or weird symbols (with dots/W)
                        for item in (gainers + losers):
                            symbol = item.get("symbol", "")
                            price = item.get("price", 0)
                            if price >= 2.0 and "." not in symbol and not symbol.endswith("W"):
                                dynamic_stocks.append(symbol)
                                
                        logger.info(f"Fetched {len(dynamic_stocks)} dynamic trending stocks from Alpaca")
                    else:
                        logger.warning(f"Failed to fetch dynamic stocks, status: {response.status}")
        except Exception as e:
            logger.error(f"Error fetching dynamic trending stocks: {str(e)}")
            
        # Use only dynamic movers (stocks with high gains/losses), avoiding the core top 10 list
        combined_stocks = list(set(dynamic_stocks))
        
        # Fallback to highly volatile stocks if the API didn't return any movers
        if not combined_stocks:
            combined_stocks = ["TSLA", "NVDA", "MSTR", "COIN", "AMD", "SMCI", "MARA", "PLTR", "ROKU", "SQ"]
        
        # Cache for 1 hour
        if combined_stocks:
            try:
                self.redis_client.setex(cache_key, 3600, json.dumps(combined_stocks))
            except redis.exceptions.ConnectionError:
                pass
                
        return combined_stocks
    
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