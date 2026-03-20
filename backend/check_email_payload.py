import asyncio
from app.models.database import SessionLocal
from app.services.portfolio_service import portfolio_service

async def main():
    db = SessionLocal()
    data = await portfolio_service.get_daily_report_data(db)
    print(f"Daily PnL: {data['daily_pnl']}")
    print(f"Daily PnL %: {data['daily_pnl_percent']}")
    print("7 Day Trend:")
    for trend in data['seven_day_trend']:
        print(f"  {trend['date']}: ${trend['pnl']:.2f}")
    
    print("\nAI Models:")
    for model in data['models']:
        print(f"  {model['provider']}: Daily PnL: ${model['open_pnl']:.2f}, Score: {model['score']}")
    db.close()

asyncio.run(main())
