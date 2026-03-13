from app.models.database import SessionLocal
from app.models.models import BotConfig, Portfolio

db = SessionLocal()
config = db.query(BotConfig).first()
if config:
    print(f"Old Allocations: OpenAI=${config.openai_allocation}, Gemini=${config.gemini_allocation}, Anthropic=${config.anthropic_allocation}")
    config.openai_allocation = 40000.0
    config.gemini_allocation = 40000.0
    config.anthropic_allocation = 40000.0
    db.commit()
    print("New Allocations: $40,000.00 each")

port = db.query(Portfolio).first()
if port:
    print(f"Local Portfolio Cash: ${port.cash_balance}")
