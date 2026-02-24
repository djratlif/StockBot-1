import asyncio
from app.models.database import SessionLocal
from app.models.models import Holdings

def main():
    db = SessionLocal()
    holdings = db.query(Holdings).all()
    
    print(f"Total Holdings: {len(holdings)}")
    for h in holdings:
        value = h.quantity * h.current_price
        print(f"Symbol: {h.symbol}, Qty: {h.quantity}, Price: {h.current_price}, Value: {value}")
        
    db.close()

main()
