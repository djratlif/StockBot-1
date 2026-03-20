import asyncio
import os
import sys

# Add backend to path
sys.path.append("/Users/drewratliff/Desktop/StockBot-1/backend")

from app.services.ai_service import ai_service
from app.models.schemas import RiskToleranceEnum
from app.models.database import SessionLocal

async def test_ai():
    print("Testing AI Workflow Updates...")
    
    db = SessionLocal()
    
    decision = await ai_service.analyze_stock_for_trading(
        symbol="AAPL",
        portfolio_cash=1000.0,
        current_holdings={},
        portfolio_value=12000.0,
        risk_tolerance=RiskToleranceEnum.MEDIUM,
        strategy_profile="BALANCED",
        recent_news=[],
        max_position_size=0.10,
        allocation_exceeded=False,
        allocation_overage=0.0,
        db_session=db,
        ai_provider="OPENAI"
    )
    
    if decision:
        print("\nSUCCESS! Parsed Decision:")
        print(decision)
    else:
        print("\nFAILURE! Could not parse decision.")
        

if __name__ == "__main__":
    asyncio.run(test_ai())
