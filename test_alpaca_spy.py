import asyncio
from app.config import settings
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest
from alpaca.data.enums import DataFeed

async def main():
    client = StockHistoricalDataClient(settings.alpaca_api_key, settings.alpaca_secret_key)
    
    req_iex = StockLatestQuoteRequest(symbol_or_symbols="SPY", feed=DataFeed.IEX)
    quote_iex = client.get_stock_latest_quote(req_iex)
    if "SPY" in quote_iex:
        q = quote_iex["SPY"]
        print(f"IEX SPY: Ask={q.ask_price}, Bid={q.bid_price}")
        
    try:
        req_sip = StockLatestQuoteRequest(symbol_or_symbols="SPY", feed=DataFeed.SIP)
        quote_sip = client.get_stock_latest_quote(req_sip)
        if "SPY" in quote_sip:
            q = quote_sip["SPY"]
            print(f"SIP SPY: Ask={q.ask_price}, Bid={q.bid_price}")
    except Exception as e:
        print(f"SIP failed: {e}")

asyncio.run(main())
