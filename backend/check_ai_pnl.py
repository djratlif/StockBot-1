import asyncio
from datetime import date, datetime
import pytz
from app.models.database import SessionLocal
from app.services.portfolio_service import portfolio_service
from app.services.alpaca_service import alpaca_service
from app.models.models import Trades, Holdings

async def main():
    db = SessionLocal()
    account = alpaca_service.get_account()
    pos = alpaca_service.get_positions()
    
    print(f"Total Portfolio Equity: {account.equity}")
    print(f"Alpaca Last Equity: {account.last_equity}")
    
    intraday_pl_per_share = {}
    for p in pos:
        try:
            qty = float(p.qty)
            if qty != 0:
                intraday_pl_per_share[p.symbol] = float(p.unrealized_intraday_pl) / qty
        except Exception:
            pass

    est = pytz.timezone("US/Eastern")
    start_of_day = est.localize(datetime.combine(date.today(), datetime.min.time())).astimezone(pytz.utc)
    
    all_trades = db.query(Trades).order_by(Trades.executed_at.asc()).all()
    real_pnls = portfolio_service._compute_fifo_realized_pnl(all_trades, since=start_of_day)
    print(f"Realized PNLs Today: {real_pnls}")
    
    holdings = db.query(Holdings).all()
    model_stats = {"OPENAI": 0, "GEMINI": 0, "ANTHROPIC": 0}
    
    for h in holdings:
        if h.quantity == 0: continue
        p = h.ai_provider or "OPENAI"
        intraday_pnl = h.quantity * intraday_pl_per_share.get(h.symbol, 0.0)
        model_stats[p] += intraday_pnl
        print(f"Holding {h.symbol} ({h.quantity} shares, {p}): Intraday PnL = {intraday_pnl}")
        
    print(f"Model Intraday PnL: {model_stats}")
    
    for p in real_pnls:
        if p in model_stats:
            model_stats[p] += real_pnls[p]
            
    print(f"Total AI PnL (Open + Realized): {model_stats}")
    print(f"Sum overall AI PnL: {sum(model_stats.values())}")

    db.close()

asyncio.run(main())
