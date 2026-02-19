import os
import logging
import json
import time
import asyncio
import requests
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.fundamentaldata import FundamentalData
from sqlalchemy.orm import Session

from app.models.schemas import StockInfo
from app.models.models import MarketData
from app.config import settings

logger = logging.getLogger(__name__)

class AlphaVantageService:
    def __init__(self):
        self.api_key = settings.alpha_vantage_api_key
        if not self.api_key or self.api_key == "your_alpha_vantage_api_key_here":
            logger.warning("Alpha Vantage API key not configured. Using demo key with limited functionality.")
            self.api_key = "demo"
        
        self.ts = TimeSeries(key=self.api_key, output_format='json')
        self.fd = FundamentalData(key=self.api_key, output_format='json')
        
        # Smart caching to minimize API calls
        self.cache = {}
        self.cache_duration = 55  # Cache for 55s to ensure expiry before 60s frontend poll
        self.daily_cache_duration = 3600  # 1 hour for daily data
        
        # Rate limiting - Premium plan: 150 requests per minute
        self.last_api_call = 0
        self.min_call_interval = 0.4  # 0.4 seconds between calls (150 calls per minute)
        self.daily_call_count = 0
        self.daily_call_limit = 216000  # Premium tier: 150 per minute * 60 minutes * 24 hours = 216,000 per day
        self.call_reset_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

    async def _wait_for_rate_limit(self, db_session=None):
        """Ensure we don't exceed rate limits"""
        current_time = time.time()
        time_since_last_call = current_time - self.last_api_call
        
        if time_since_last_call < self.min_call_interval:
            sleep_time = self.min_call_interval - time_since_last_call
            logger.info(f"Rate limiting: waiting {sleep_time:.1f} seconds")
            
            # Log rate limiting to database for debug page and activity feed
            if db_session:
                try:
                    from app.models.models import TradingLog, ActivityLog
                    import pytz
                    
                    # Log to TradingLog for debug page
                    rate_limit_log = TradingLog(
                        level="WARNING",
                        message=f"Alpha Vantage rate limiting: waiting {sleep_time:.1f} seconds (API call {self.daily_call_count}/{self.daily_call_limit})",
                        symbol=None,
                        trade_id=None
                    )
                    db_session.add(rate_limit_log)
                    
                    # Also log to ActivityLog for dashboard visibility
                    est = pytz.timezone('US/Eastern')
                    activity_log = ActivityLog(
                        action="API_RATE_LIMIT",
                        details=f"Alpha Vantage API rate limit hit - waiting {sleep_time:.1f}s before next request (call {self.daily_call_count}/{self.daily_call_limit})",
                        timestamp=datetime.now(est)
                    )
                    db_session.add(activity_log)
                    db_session.commit()
                except Exception as e:
                    logger.error(f"Failed to log rate limit to database: {e}")
            
            await asyncio.sleep(sleep_time)
        
        # Reset daily counter if needed
        if datetime.now() >= self.call_reset_time:
            self.daily_call_count = 0
            self.call_reset_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        # Check daily limit
        if self.daily_call_count >= self.daily_call_limit:
            error_msg = f"Daily API call limit reached ({self.daily_call_limit})"
            logger.error(error_msg)
            
            # Log API limit reached to database
            if db_session:
                try:
                    from app.models.models import TradingLog
                    limit_log = TradingLog(
                        level="ERROR",
                        message=f"Alpha Vantage daily API limit reached: {self.daily_call_limit} calls used",
                        symbol=None,
                        trade_id=None
                    )
                    db_session.add(limit_log)
                    db_session.commit()
                except Exception as e:
                    logger.error(f"Failed to log API limit to database: {e}")
            
            raise Exception("Alpha Vantage daily API limit reached")
        
        self.last_api_call = current_time
        self.daily_call_count += 1
        logger.info(f"API call {self.daily_call_count}/{self.daily_call_limit} for today")

    def _get_cache_key(self, symbol: str, data_type: str) -> str:
        """Generate cache key"""
        return f"{symbol}_{data_type}"

    def _is_cache_valid(self, cache_entry: Dict, cache_duration: int) -> bool:
        """Check if cache entry is still valid"""
        if not cache_entry:
            return False
        
        cache_time = cache_entry.get('timestamp', 0)
        return (time.time() - cache_time) < cache_duration

    def _cache_data(self, key: str, data: any):
        """Cache data with timestamp"""
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }

    async def get_stock_info(self, symbol: str, db_session=None) -> Optional[StockInfo]:
        """Get comprehensive stock information with caching"""
        try:
            cache_key = self._get_cache_key(symbol, 'stock_info')
            
            # Check cache first
            if cache_key in self.cache and self._is_cache_valid(self.cache[cache_key], self.cache_duration):
                logger.info(f"Using cached data for {symbol}")
                return self.cache[cache_key]['data']
            
            # Make API call
            await self._wait_for_rate_limit(db_session)
            logger.info(f"Fetching stock info for {symbol} from Alpha Vantage")
            
            # Get intraday data using raw requests to support entitlement parameter
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=1min&entitlement=realtime&apikey={self.api_key}"
            
            try:
                response = requests.get(url, timeout=10)
                if response.status_code != 200:
                    logger.error(f"Alpha Vantage API error: {response.status_code}")
                    return None
                    
                data_json = response.json()
                 # Check for API error
                if "Error Message" in data_json:
                    logger.error(f"API Error: {data_json['Error Message']}")
                    return None
                
                data = data_json.get("Time Series (1min)")
                meta_data = data_json.get("Meta Data")
            except Exception as req_err:
                logger.error(f"Request failed: {req_err}")
                return None
            
            if not data:
                logger.error(f"No data returned for {symbol}")
                return None
            
            # Get the most recent price
            latest_time = max(data.keys())
            latest_data = data[latest_time]
            
            current_price = float(latest_data['4. close'])
            open_price = float(latest_data['1. open'])
            high_price = float(latest_data['2. high'])
            low_price = float(latest_data['3. low'])
            volume = int(latest_data['5. volume'])
            
            # Calculate change percentage
            change_percent = ((current_price - open_price) / open_price) * 100 if open_price > 0 else 0
            
            stock_info = StockInfo(
                symbol=symbol,
                current_price=current_price,
                change_percent=change_percent,
                volume=volume,
                market_cap=None,  # Would need additional API call
                pe_ratio=None,    # Would need additional API call
                week_52_high=high_price,  # Approximation
                week_52_low=low_price     # Approximation
            )
            
            # Cache the result
            self._cache_data(cache_key, stock_info)
            
            return stock_info
            
        except Exception as e:
            error_msg = f"Error fetching stock info for {symbol}: {str(e)}"
            logger.error(error_msg)
            
            # Log API error to database for debug page and activity feed
            if db_session:
                try:
                    from app.models.models import TradingLog, ActivityLog
                    import pytz
                    
                    # Log to TradingLog for debug page
                    error_log = TradingLog(
                        level="ERROR",
                        message=f"Alpha Vantage API error for {symbol}: {str(e)}",
                        symbol=symbol,
                        trade_id=None
                    )
                    db_session.add(error_log)
                    
                    # Also log to ActivityLog for dashboard visibility
                    est = pytz.timezone('US/Eastern')
                    activity_log = ActivityLog(
                        action="API_ERROR",
                        details=f"Alpha Vantage API failed for {symbol}: {str(e)[:100]}{'...' if len(str(e)) > 100 else ''}",
                        timestamp=datetime.now(est)
                    )
                    db_session.add(activity_log)
                    db_session.commit()
                except Exception as db_error:
                    logger.error(f"Failed to log API error to database: {db_error}")
            
            return None

    async def get_current_price(self, symbol: str) -> Optional[float]:
        """Get current stock price with caching"""
        try:
            cache_key = self._get_cache_key(symbol, 'current_price')
            
            # Check cache first
            if cache_key in self.cache and self._is_cache_valid(self.cache[cache_key], self.cache_duration):
                logger.info(f"Using cached price for {symbol}")
                return self.cache[cache_key]['data']
            
            # Make API call
            await self._wait_for_rate_limit()
            logger.info(f"Fetching current price for {symbol} from Alpha Vantage")
            
            # Get intraday data using raw requests to support entitlement parameter
            # The library doesn't support 'entitlement' keyword yet
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=1min&entitlement=realtime&apikey={self.api_key}"
            
            try:
                response = requests.get(url, timeout=10)
                if response.status_code != 200:
                    logger.error(f"Alpha Vantage API error: {response.status_code}")
                    return None
                    
                data_json = response.json()
                
                # Check for API error
                if "Error Message" in data_json:
                    logger.error(f"API Error: {data_json['Error Message']}")
                    return None
                
                data = data_json.get("Time Series (1min)")
                meta_data = data_json.get("Meta Data")
                
            except Exception as req_err:
                logger.error(f"Request failed: {req_err}")
                return None
            
            if not data:
                logger.error(f"No intraday data returned for {symbol}")
                return None
            
            # Get the most recent price
            latest_time = max(data.keys())
            current_price = float(data[latest_time]['4. close'])
            
            # Cache the result
            self._cache_data(cache_key, current_price)
            
            return current_price
            
        except Exception as e:
            logger.error(f"Error fetching current price for {symbol}: {str(e)}")
            return None

    async def get_historical_data(self, symbol: str, period: str = "1mo"):
        """Get historical stock data with caching"""
        try:
            cache_key = self._get_cache_key(symbol, f'historical_{period}')
            
            # Check cache first
            # Use shorter cache duration for intraday views (1d, 5d) so they update frequently
            cache_ttl = self.cache_duration if period in ['1d', '5d'] else self.daily_cache_duration
            
            if cache_key in self.cache and self._is_cache_valid(self.cache[cache_key], cache_ttl):
                logger.info(f"Using cached historical data for {symbol} ({period})")
                return self.cache[cache_key]['data']
            
            # Make API call
            await self._wait_for_rate_limit()
            logger.info(f"Fetching historical data for {symbol} ({period}) from Alpha Vantage")
            
            if period in ['1d', '5d']:
                # Fetch Intraday Data
                interval = '1min' if period == '1d' else '5min'
                # outputsize=full is needed to get enough data for filtering, 
                # but compact might be enough for 1d. Let's use full to be safe for 5d.
                # However, full returns 2MB+ of data, which is slow.
                # For 1d, 'compact' returns latest 100 data points. 100 mins = 1h 40m. Not enough for full day.
                # So we must use 'full' unfortunately, or accept 'compact' limitation.
                # Let's use 'full' but cache it.
                
                url = f"https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval={interval}&outputsize=full&entitlement=realtime&apikey={self.api_key}"
                
                try:
                    response = requests.get(url, timeout=10)
                    if response.status_code != 200:
                        logger.error(f"Alpha Vantage API error: {response.status_code}")
                        return None
                        
                    data_json = response.json()
                     # Check for API error
                    if "Error Message" in data_json:
                        logger.error(f"API Error: {data_json['Error Message']}")
                        return None
                    
                    time_series_key = f"Time Series ({interval})"
                    raw_data = data_json.get(time_series_key)
                    if not raw_data:
                        logger.error(f"No {time_series_key} returned for {symbol}")
                        return None
                    
                    # Filter data based on period
                    filtered_data = {}
                    import pytz
                    est = pytz.timezone('US/Eastern')
                    now = datetime.now(est)
                    
                    cutoff_time = now
                    if period == '1d':
                        # Today's market open (9:30 AM EST)
                        cutoff_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
                        # If currently before 9:30 AM, show previous day? No, show empty or pre-market if available.
                        # API returns data with date-time keys.
                        # Actually, keeping last 24h might be better if market is closed, or just current trading day.
                        # Standard is: if market open, show today. If closed, show last session.
                        
                        # Simplification: Get data from the latest available date in the dataset
                        latest_date_str = max(raw_data.keys()).split(' ')[0]
                        cutoff_str = f"{latest_date_str} 09:30:00"
                        
                    elif period == '5d':
                        # Last 5 days
                        cutoff_time = now - timedelta(days=5)
                        cutoff_str = cutoff_time.strftime("%Y-%m-%d %H:%M:%S")

                    for timestamp, values in raw_data.items():
                        if period == '1d':
                            # Strict string comparison for 1D to keep only the latest day
                            if timestamp >= cutoff_str:
                                filtered_data[timestamp] = values
                        else:
                            # String comparison works for ISO format
                            if timestamp >= cutoff_str:
                                filtered_data[timestamp] = values
                    
                    # If 1d filtered result is empty (e.g. before 9:30), 
                    # fallback to previous day? Or just return empty to show "Market not open yet"?
                    # Let's return what we have. If empty, maybe show last 100 points?
                    if not filtered_data and period == '1d':
                        # Fallback: take last 78 points (approx 1 trading day is 390 mins, but compact is 100)
                        # Let's just return the last 390 points (full trading day)
                        sorted_keys = sorted(raw_data.keys(), reverse=True)
                        for key in sorted_keys[:390]:
                             filtered_data[key] = raw_data[key]

                    data = filtered_data
                    
                except Exception as req_err:
                    logger.error(f"Request failed: {req_err}")
                    return None

            else:
                # Get daily data (Existing Logic)
                data, meta_data = self.ts.get_daily(symbol=symbol, outputsize='compact')
            
            if not data:
                logger.error(f"No historical data returned for {symbol}")
                return None
            
            # Cache the result
            self._cache_data(cache_key, data)
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            return None

    def get_trending_stocks(self) -> List[str]:
        """Get trending stocks (using predefined list to save API calls)"""
        # Use a predefined list of popular stocks to avoid API calls
        trending = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX"]
        logger.info("Using predefined trending stocks list to conserve API calls")
        return trending

    async def validate_symbol(self, symbol: str) -> bool:
        """Validate if a stock symbol exists"""
        try:
            price = await self.get_current_price(symbol)
            return price is not None
        except Exception:
            return False

    def get_market_status(self) -> Dict[str, bool]:
        """Check if market is currently open (using time-based logic to save API calls)"""
        try:
            from datetime import datetime
            import pytz
            
            # Get current time in EST
            est = pytz.timezone('US/Eastern')
            current_time = datetime.now(est)
            
            # Market hours: 9:30 AM - 4:00 PM EST, Monday-Friday
            is_weekday = current_time.weekday() < 5  # 0-4 are Mon-Fri
            current_hour = current_time.hour
            current_minute = current_time.minute
            
            market_open_time = 9.5  # 9:30 AM
            market_close_time = 16.0  # 4:00 PM
            current_decimal_time = current_hour + (current_minute / 60.0)
            
            is_market_hours = (market_open_time <= current_decimal_time < market_close_time)
            is_open = is_weekday and is_market_hours
            
            return {
                "is_open": is_open,
                "is_weekday": is_weekday,
                "current_time": current_time.strftime("%H:%M:%S EST"),
                "next_open": self._get_next_market_open(current_time)
            }
            
        except Exception as e:
            logger.error(f"Error checking market status: {str(e)}")
            return {"is_open": False, "error": str(e)}

    def _get_next_market_open(self, current_time) -> str:
        """Calculate next market open time"""
        try:
            # If it's Friday after close or weekend, next open is Monday
            if current_time.weekday() == 4 and current_time.hour >= 16:  # Friday after 4 PM
                days_until_monday = 3
            elif current_time.weekday() == 5:  # Saturday
                days_until_monday = 2
            elif current_time.weekday() == 6:  # Sunday
                days_until_monday = 1
            elif current_time.hour >= 16:  # After market close on weekday
                days_until_monday = 1
            else:  # Before market open on weekday
                days_until_monday = 0
            
            next_open = current_time + timedelta(days=days_until_monday)
            next_open = next_open.replace(hour=9, minute=30, second=0, microsecond=0)
            
            return next_open.strftime("%Y-%m-%d %H:%M:%S EST")
            
        except Exception as e:
            logger.error(f"Error calculating next market open: {str(e)}")
            return "Unknown"

    def save_market_data(self, db: Session, symbol: str, price: float, volume: int = 0):
        """Save market data to database"""
        try:
            market_data = MarketData(
                symbol=symbol,
                price=price,
                volume=volume,
                timestamp=datetime.now()
            )
            db.add(market_data)
            db.commit()
            logger.info(f"Saved market data for {symbol}: ${price}")
        except Exception as e:
            logger.error(f"Error saving market data: {str(e)}")
            db.rollback()

    def get_api_usage_stats(self) -> Dict:
        """Get current API usage statistics"""
        return {
            "daily_calls_used": self.daily_call_count,
            "daily_calls_limit": self.daily_call_limit,
            "calls_remaining": self.daily_call_limit - self.daily_call_count,
            "reset_time": self.call_reset_time.isoformat(),
            "cache_entries": len(self.cache)
        }

# Global instance
alpha_vantage_service = AlphaVantageService()