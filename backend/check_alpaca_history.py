import asyncio
import datetime
from alpaca.trading.requests import GetPortfolioHistoryRequest
from app.services.alpaca_service import alpaca_service

async def main():
    req = GetPortfolioHistoryRequest(period="1W", timeframe="1D")
    history = alpaca_service.trading_client.get_portfolio_history(req)
    
    print("Base Value:", history.base_value)
    for i in range(len(history.timestamp)):
        dt = datetime.datetime.fromtimestamp(history.timestamp[i])
        print(f"Date: {dt.date()} -> Equity: {history.equity[i]}, PnL: {history.profit_loss[i]}, PnL%: {history.profit_loss_pct[i]}")

asyncio.run(main())
