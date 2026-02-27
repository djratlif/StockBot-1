import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal
from app.models.models import BotConfig
import google.generativeai as genai

async def main():
    db = SessionLocal()
    config = db.query(BotConfig).first()
    if config and config.gemini_api_key:
        genai.configure(api_key=config.gemini_api_key)
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            res = model.generate_content("Hello! Are you working? Can you trade stocks for me?", generation_config=genai.types.GenerationConfig(
                max_output_tokens=400,
                temperature=0.5
            ))
            print(res)
            print("TEXT:", res.text)
        except Exception as e:
            print(f"Error: {e}")
            if hasattr(e, 'response') and hasattr(e.response, 'candidates'):
                 print("CANDIDATES:", e.response.candidates)
    else:
        print("No Gemini API key found.")

if __name__ == "__main__":
    asyncio.run(main())
