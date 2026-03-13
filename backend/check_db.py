from app.models.database import SessionLocal
from app.models.models import BotConfig
db = SessionLocal()
config = db.query(BotConfig).first()
if config:
    print(f'Active: {config.is_active}')
    print(f'OpenAI: ${config.openai_allocation}')
    print(f'Gemini: ${config.gemini_allocation}')
    print(f'Anthropic: ${config.anthropic_allocation}')
