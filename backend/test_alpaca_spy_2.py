import asyncio
from app.config import settings
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockSnapshotRequest
from alpaca.data.enums import DataFeed

async def main():
    client = StockHistoricalDataClient(settings.alpaca_api_key, settings.alpaca_secret_key)
    try:
        req = StockSnapshotRequest(symbol_or_symbols="SPY", feed=DataFeed.IEX)
        snap = client.get_stock_snapshot(req)
        if "SPY" in snap:
            print(f"Snapshot SPY: TradeP={snap['SPY'].latest_trade.price}, PrevClose={snap['SPY'].previous_daily_bar.close}")
    except Exception as e:
        print(f"Snapshot failed: {e}")

asyncio.run(main())
