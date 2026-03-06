import os
import sys

# Add the project directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings

def update_db():
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE bot_config ADD COLUMN portfolio_allocation FLOAT DEFAULT 1.0 NOT NULL;"))
            conn.commit()
            print("Successfully added portfolio_allocation column.")
        except Exception as e:
            if "already exists" in str(e) or "Duplicate column" in str(e):
                print("Column already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    update_db()
