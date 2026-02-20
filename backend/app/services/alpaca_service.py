import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import pandas as pd
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce, OrderStatus
from alpaca.common.exceptions import APIError

from app.config import settings
from app.models.schemas import StockInfo
from app.models.models import TradeAction

logger = logging.getLogger(__name__)

class AlpacaService:
    def __init__(self):
        self.api_key = settings.alpaca_api_key
        self.secret_key = settings.alpaca_secret_key
        self.endpoint = settings.alpaca_endpoint
        
        if not self.api_key or not self.secret_key:
            logger.warning("Alpaca API keys not configured. Service will be disabled.")
            self.trading_client = None
            self.data_client = None
            return

        self.trading_client = TradingClient(self.api_key, self.secret_key, paper=True) # Force paper for now as requested
        self.data_client = StockHistoricalDataClient(self.api_key, self.secret_key)
        
        # Cache for market status
        self.market_status_cache = None
        self.market_status_last_updated = None

    async def get_stock_info(self, symbol: str) -> Optional[StockInfo]:
        """Get comprehensive stock information"""
        try:
            if not self.data_client:
                return None
                
            # Get latest quote and trades
            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quote = self.data_client.get_stock_latest_quote(request)
            
            if symbol not in quote:
                return None
                
            latest_quote = quote[symbol]
            
            # Get previous close for change calculation
            # We need to get the last daily bar
            today = datetime.now()
            yesterday = today - timedelta(days=5) # Go back a few days to be sure
            
            bars_request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Day,
                start=yesterday,
                limit=2 # Get last 2 to calculate change if needed, but last 1 is enough for close
            )
            bars = self.data_client.get_stock_bars(bars_request)
            
            prev_close = 0
            if symbol in bars.df.index.get_level_values(0):
                symbol_bars = bars.df.loc[symbol]
                if not symbol_bars.empty:
                    prev_close = symbol_bars.iloc[-1]['close']
            
            current_price = latest_quote.ask_price if latest_quote.ask_price > 0 else latest_quote.bid_price
            # Fallback to last trade if quote is weird? Or just use ask/bid midpoint?
            # Creating a simple approximation
            
            change_percent = 0
            if prev_close > 0:
                change_percent = ((current_price - prev_close) / prev_close) * 100
            
            return StockInfo(
                symbol=symbol,
                current_price=current_price,
                change_percent=change_percent,
                volume=0, # Volume hard to get from just quote, would need daily bar
                market_cap=None, 
                pe_ratio=None,
                week_52_high=None,
                week_52_low=None
            )
            
        except Exception as e:
            logger.error(f"Error fetching stock info for {symbol} from Alpaca: {str(e)}")
            return None

    async def get_current_price(self, symbol: str) -> Optional[float]:
        """Get current stock price"""
        try:
            if not self.data_client:
                return None
                
            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quote = self.data_client.get_stock_latest_quote(request)
            
            if symbol not in quote:
                return None
                
            # Use ask price as current price proxy, or average of bid/ask
            q = quote[symbol]
            price = q.ask_price if q.ask_price > 0 else q.bid_price
            
            return price
            
        except Exception as e:
            logger.error(f"Error fetching price for {symbol} from Alpaca: {str(e)}")
            return None

    async def get_historical_data(self, symbol: str, period: str = "1mo") -> Optional[Dict]:
        """Get historical stock data"""
        try:
            if not self.data_client:
                return None
                
            now = datetime.now()
            start_time = now
            timeframe = TimeFrame.Day
            
            if period == '1d':
                start_time = now - timedelta(days=1)
                timeframe = TimeFrame.Minute
            elif period == '5d':
                start_time = now - timedelta(days=5)
                timeframe = TimeFrame.Minute # Or 5Min/15Min to reduce data
            elif period == '1mo':
                start_time = now - timedelta(days=30)
                timeframe = TimeFrame.Hour
            elif period == '3mo':
                start_time = now - timedelta(days=90)
                timeframe = TimeFrame.Day
            elif period == '1y':
                start_time = now - timedelta(days=365)
                timeframe = TimeFrame.Day
            else:
                start_time = now - timedelta(days=30)
            
            request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=timeframe,
                start=start_time,
                end=now
            )
            
            bars = self.data_client.get_stock_bars(request)
            
            # Convert to dictionary format expected by frontend
            # Format: {"YYYY-MM-DD HH:MM:SS": {"1. open": "...", "2. high": "...", ...}}
            result = {}
            
            if symbol in bars.df.index.get_level_values(0):
                df = bars.df.loc[symbol]
                for index, row in df.iterrows():
                    # index is timestamp
                    dt_str = index.strftime("%Y-%m-%d %H:%M:%S")
                    result[dt_str] = {
                        "1. open": str(row['open']),
                        "2. high": str(row['high']),
                        "3. low": str(row['low']),
                        "4. close": str(row['close']),
                        "5. volume": str(row['volume'])
                    }
                    
            return result
            
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            return None

    def get_account(self):
        """Get Alpaca account details"""
        if not self.trading_client:
            return None
        try:
            return self.trading_client.get_account()
        except Exception as e:
            logger.error(f"Error getting Alpaca account: {str(e)}")
            return None

    def get_positions(self):
        """Get all open positions"""
        if not self.trading_client:
            return []
        try:
            return self.trading_client.get_all_positions()
        except Exception as e:
            logger.error(f"Error getting Alpaca positions: {str(e)}")
            return []

    def submit_order(self, symbol: str, qty: int, side: str, type: str = 'market', time_in_force: str = 'day'):
        """Submit an order to Alpaca"""
        if not self.trading_client:
            return None
        try:
            market_order_data = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=OrderSide.BUY if side.upper() == 'BUY' else OrderSide.SELL,
                time_in_force=TimeInForce.DAY
            )
            
            order = self.trading_client.submit_order(order_data=market_order_data)
            return order
        except Exception as e:
            logger.error(f"Error submitting order for {symbol}: {str(e)}")
            return None

    def close_all_positions(self, cancel_orders: bool = True):
        """Close all positions"""
        if not self.trading_client:
            return None
        try:
            return self.trading_client.close_all_positions(cancel_orders=cancel_orders)
        except Exception as e:
            logger.error(f"Error closing all positions: {str(e)}")
            return None
            
    def get_market_status(self) -> Dict[str, bool]:
        """Check if market is open"""
        if not self.trading_client:
             return {"is_open": False, "error": "Alpaca not configured"}
             
        try:
            clock = self.trading_client.get_clock()
            return {
                "is_open": clock.is_open,
                "next_open": clock.next_open.strftime("%Y-%m-%d %H:%M:%S EST"),
                "next_close": clock.next_close.strftime("%Y-%m-%d %H:%M:%S EST"),
                "current_time": clock.timestamp.strftime("%H:%M:%S EST")
            }
        except Exception as e:
            logger.error(f"Error getting market status: {str(e)}")
            return {"is_open": False, "error": str(e)}

    async def validate_symbol(self, symbol: str) -> bool:
        """Validate if a stock symbol exists"""
        if not self.trading_client:
            return False
        try:
            asset = self.trading_client.get_asset(symbol)
            return asset.status == 'active'
        except Exception:
            return False

alpaca_service = AlpacaService()
