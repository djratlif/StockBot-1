import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal
from app.models.models import BotConfig
import google.generativeai as genai

def main():
    db = SessionLocal()
    config = db.query(BotConfig).first()
    if config and config.gemini_api_key:
        genai.configure(api_key=config.gemini_api_key)
        print("Available Gemini Models:")
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    print(m.name)
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("No Gemini API key found in DB.")

if __name__ == "__main__":
    main()
