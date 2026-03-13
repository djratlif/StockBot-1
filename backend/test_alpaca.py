import os
from alpaca.trading.client import TradingClient
from alpaca.data.historical import StockHistoricalDataClient
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("ALPACA_API_KEY")
secret = os.getenv("ALPACA_SECRET_KEY")

try:
    client = TradingClient(api_key, secret, paper=True)
    account = client.get_account()
    print("SUCCESS: Connected to Alpaca Trading Client.")
    print(f"Equity: ${account.equity}")
    print(f"Buying Power: ${account.buying_power}")
except Exception as e:
    print(f"FAILED to connect to Alpaca Trading: {e}")

try:
    data_client = StockHistoricalDataClient(api_key, secret)
    # Just a simple fetch
    from alpaca.data.requests import StockLatestQuoteRequest
    req = StockLatestQuoteRequest(symbol_or_symbols="AAPL")
    res = data_client.get_stock_latest_quote(req)
    print(f"SUCCESS: Connected to Alpaca Data Client. AAPL Quote: {res}")
except Exception as e:
    print(f"FAILED to connect to Alpaca Data: {e}")
