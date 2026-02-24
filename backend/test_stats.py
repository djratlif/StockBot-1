import asyncio
from app.models.database import SessionLocal
from app.services.portfolio_service import portfolio_service
from app.models.models import Holdings

def main():
    db = SessionLocal()
    holdings = db.query(Holdings).all()
    print(f"Holdings in DB: {len(holdings)}")
    stats = portfolio_service.get_trading_stats(db)
    if stats:
        print(f"Best open: {stats.best_open_position}, Worst open: {stats.worst_open_position}")
    else:
        print("Stats is None")
    db.close()

main()
