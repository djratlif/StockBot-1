import os
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetOrdersRequest
from alpaca.trading.enums import OrderStatus
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("ALPACA_API_KEY")
secret = os.getenv("ALPACA_SECRET_KEY")

try:
    client = TradingClient(api_key, secret, paper=True)
    req = GetOrdersRequest(status=OrderStatus.OPEN)
    orders = client.get_orders(filter=req)
    print("ORDERS FETCHED:")
    print(type(orders))
    for o in orders:
        print(f"Order object: {type(o)}")
        if hasattr(o, 'symbol'):
            print(f"Symbol: {o.symbol}")
        else:
            print("No symbol attr")
except Exception as e:
    print(f"FAILED to get orders: {e}")
