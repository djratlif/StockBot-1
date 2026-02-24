import asyncio
from app.models.database import SessionLocal
from app.services.portfolio_service import portfolio_service
from app.models.models import Holdings
from app.services.alpaca_service import alpaca_service

def main():
    db = SessionLocal()
    holdings = db.query(Holdings).all()
    calculated_holdings_value = sum(h.quantity * h.current_price for h in holdings)
    
    account = alpaca_service.get_account()
    print(f"Alpaca long_market_value: {account.long_market_value if account else 'N/A'}")
    print(f"Alpaca short_market_value: {account.short_market_value if account else 'N/A'}")
    print(f"Alpaca equity: {account.equity if account else 'N/A'}")
    print(f"Alpaca cash: {account.cash if account else 'N/A'}")
    print(f"Calculated holdings value (qty * current_price): {calculated_holdings_value}")
    
    db.close()

main()
