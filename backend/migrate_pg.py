from app.models.database import engine
from sqlalchemy import text

def add_columns():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE bot_config ADD COLUMN smtp_email VARCHAR(255);"))
            conn.execute(text("ALTER TABLE bot_config ADD COLUMN smtp_password VARCHAR(255);"))
            conn.commit()
            print("Successfully added columns to PostgreSQL!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_columns()
