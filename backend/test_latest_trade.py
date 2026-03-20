import asyncio
from app.config import settings
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestTradeRequest
from alpaca.data.enums import DataFeed

async def main():
    client = StockHistoricalDataClient(settings.alpaca_api_key, settings.alpaca_secret_key)
    try:
        req = StockLatestTradeRequest(symbol_or_symbols="SPY", feed=DataFeed.IEX)
        trade = client.get_stock_latest_trade(req)
        if "SPY" in trade:
            print(f"Latest IEX Trade SPY: Price={trade['SPY'].price}")
    except Exception as e:
        print(f"Failed: {e}")

asyncio.run(main())
