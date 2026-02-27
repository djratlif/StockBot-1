import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal
from app.models.models import BotConfig, RiskTolerance
from app.services.ai_service import AITradingService
from app.services.alpaca_service import AlpacaService

async def main():
    db = SessionLocal()
    config = db.query(BotConfig).first()
    
    if not config:
        print("No bot config found")
        return
        
    ai_service = AITradingService()
    alpaca = AlpacaService()
    
    print("Testing parser integration...")
    try:
        stock_info = await alpaca.get_stock_info("AAPL")
        if not stock_info:
            print("Failed to get stock info for AAPL")
            return
            
        print("Got stock info, running AI analysis with GEMINI...")
        decision = await ai_service.analyze_stock_for_trading(
            db_session=db,
            symbol="AAPL",
            ai_provider="GEMINI",
            portfolio_cash=10000.0,
            current_holdings={},
            portfolio_value=10000.0,
            risk_tolerance=config.risk_tolerance,
            strategy_profile=config.strategy_profile,
            max_position_size=2000.0,
            recent_news=[],
            api_key=config.gemini_api_key
        )
        print(f"\nFINAL DECISION OBJECT: {decision}")
    except Exception as e:
        print(f"Error during parsing: {e}")

if __name__ == "__main__":
    asyncio.run(main())
