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
            # Add Allocation Type
            conn.execute(text("ALTER TABLE bot_config ADD COLUMN portfolio_allocation_type VARCHAR(20) DEFAULT 'PERCENTAGE' NOT NULL;"))
            conn.commit()
            print("Successfully added portfolio_allocation_type column.")
        except Exception as e:
            if "already exists" in str(e) or "Duplicate column" in str(e):
                print("portfolio_allocation_type column already exists.")
            else:
                print(f"Error adding portfolio_allocation_type: {e}")
                
        try:
            # Add Allocation Amount
            conn.execute(text("ALTER TABLE bot_config ADD COLUMN portfolio_allocation_amount FLOAT DEFAULT 2000.0 NOT NULL;"))
            conn.commit()
            print("Successfully added portfolio_allocation_amount column.")
        except Exception as e:
            if "already exists" in str(e) or "Duplicate column" in str(e):
                print("portfolio_allocation_amount column already exists.")
            else:
                print(f"Error adding portfolio_allocation_amount: {e}")

if __name__ == "__main__":
    update_db()
