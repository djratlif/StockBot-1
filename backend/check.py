import asyncio
from app.models.database import SessionLocal
from app.services.portfolio_service import portfolio_service
from app.services.alpaca_service import alpaca_service

async def main():
    db = SessionLocal()
    account = alpaca_service.get_account()
    if account:
        print(f"Alpaca Equity: {account.equity}")
        print(f"Alpaca Last Equity: {account.last_equity}")
        print(f"Alpaca Daily PnL: {float(account.equity) - float(account.last_equity)}")
        
    data = await portfolio_service.get_daily_report_data(db)
    print(f"Calculated daily_pnl: {data['daily_pnl']}")
    print(f"Calculated percent: {data['daily_pnl_percent']}")
    db.close()

asyncio.run(main())
