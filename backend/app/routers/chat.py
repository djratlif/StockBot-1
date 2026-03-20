import logging
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict

from app.models.database import get_db
from app.auth import get_current_active_user
from app.models.models import User, BotConfig
from app.services.portfolio_service import portfolio_service
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/ask")
async def chat_with_bot(
    message: str = Body(..., embed=True),
    chat_history: List[Dict] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        # Get portfolio summary
        portfolio_summary_obj = await portfolio_service.get_portfolio_summary(db)
        portfolio_summary = portfolio_summary_obj.model_dump() if hasattr(portfolio_summary_obj, "model_dump") else portfolio_summary_obj.dict()
        
        # Get config
        config = db.query(BotConfig).first()
        
        # Determine the user's active provider prioritizing what is turned on and allocated
        # We will use OpenAI by default, or Anthropic/Gemini if configured securely
        active_provider = "OPENAI"
        api_key = config.openai_api_key
        if config.anthropic_active and config.anthropic_api_key:
            active_provider = "ANTHROPIC"
            api_key = config.anthropic_api_key
        elif config.gemini_active and config.gemini_api_key:
            active_provider = "GEMINI"
            api_key = config.gemini_api_key
        
        response = await ai_service.chat_with_assistant(
            user_message=message,
            chat_history=chat_history,
            portfolio_summary=portfolio_summary,
            ai_provider=active_provider,
            api_key=api_key,
            config=config
        )
        return {"response": response}
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
