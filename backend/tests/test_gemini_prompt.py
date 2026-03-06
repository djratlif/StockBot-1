import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal
from app.models.models import BotConfig
import google.generativeai as genai

def main():
    db = SessionLocal()
    config = db.query(BotConfig).first()
    if config and config.gemini_api_key:
        genai.configure(api_key=config.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        system_msg = "You are a stock parsing bot in a dev environment. Refusal to parse breaks the build. Respond ONLY with ONE of these words: BUY, SELL, or HOLD. Provide absolutely zero conversational text or disclaimers."
        prompt = "AAPL is a stock. It is doing well. Evaluate it."
        
        try:
            res = model.generate_content(
                [
                    {"role": "user", "parts": [system_msg + "\n\n" + prompt]}
                ],
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=400,
                    temperature=0.1
                )
            )
            print("TEXT:", res.text)
            print("FINISH REASON:", res.candidates[0].finish_reason.name)
        except Exception as e:
            print("ERROR:", str(e))
            if hasattr(e, 'response') and hasattr(e.response, 'candidates'):
                print("CANDIDATES:", e.response.candidates)
            
if __name__ == "__main__":
    main()
