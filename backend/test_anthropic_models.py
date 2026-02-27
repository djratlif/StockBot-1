import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal
from app.models.models import BotConfig
import anthropic

def main():
    db = SessionLocal()
    config = db.query(BotConfig).first()
    if config and config.anthropic_api_key:
        client = anthropic.Anthropic(api_key=config.anthropic_api_key)
        try:
            # Try to list models if supported by the SDK version
            models = client.models.list()
            print("Available Anthropic Models:")
            for m in models.data:
                print(m.id)
        except Exception as e:
            print(f"Error listing models: {e}")
            print("Attempting a simple test with claude-3-haiku-20240307...")
            try:
                response = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=10,
                    messages=[{"role": "user", "content": "Hello"}]
                )
                print("Haiku test successful!")
            except Exception as e2:
                print(f"Haiku test failed: {e2}")
    else:
        print("No Anthropic API key found.")

if __name__ == "__main__":
    main()
