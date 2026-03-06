from datetime import datetime
from app.models.models import Trades
from app.models.database import SessionLocal

db = SessionLocal()
try:
    sells = db.query(Trades).filter(Trades.action == 'SELL').all()
    count_sells = len(sells)
    print(f"Total SLs / TPs : {count_sells}")
    
    if count_sells > 0:
        sum_amount = sum(s.total_amount for s in sells)
        print(f"Total value of sells: {sum_amount}")
        
    trades = db.query(Trades).all()
    print(f"Total trades: {len(trades)}")
finally:
    db.close()
