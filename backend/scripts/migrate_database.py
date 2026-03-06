#!/usr/bin/env python3
"""
Database migration script to add missing user_id columns
and create a default user for existing data.
"""

import sqlite3
import sys
from datetime import datetime

def migrate_database():
    """Migrate the database to add user_id columns and create default user"""
    
    db_path = "stockbot.db"
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Starting database migration...")
        
        # Step 1: Create a default user if users table is empty
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        if user_count == 0:
            print("Creating default user...")
            cursor.execute("""
                INSERT INTO users (email, name, google_id, picture, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "default@stockbot.local",
                "Default User", 
                "default_user_001",
                None,
                True,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            default_user_id = cursor.lastrowid
            print(f"Created default user with ID: {default_user_id}")
        else:
            # Get the first user ID
            cursor.execute("SELECT id FROM users LIMIT 1")
            default_user_id = cursor.fetchone()[0]
            print(f"Using existing user ID: {default_user_id}")
        
        # Step 2: Add user_id column to portfolio table
        print("Adding user_id column to portfolio table...")
        try:
            cursor.execute("ALTER TABLE portfolio ADD COLUMN user_id INTEGER")
            print("✓ Added user_id column to portfolio")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ user_id column already exists in portfolio")
            else:
                raise
        
        # Update existing portfolio records with default user_id
        cursor.execute("UPDATE portfolio SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        updated_portfolio = cursor.rowcount
        print(f"✓ Updated {updated_portfolio} portfolio records with user_id")
        
        # Step 3: Add user_id column to bot_config table
        print("Adding user_id column to bot_config table...")
        try:
            cursor.execute("ALTER TABLE bot_config ADD COLUMN user_id INTEGER")
            print("✓ Added user_id column to bot_config")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ user_id column already exists in bot_config")
            else:
                raise
        
        # Update existing bot_config records with default user_id
        cursor.execute("UPDATE bot_config SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        updated_bot_config = cursor.rowcount
        print(f"✓ Updated {updated_bot_config} bot_config records with user_id")
        
        # Step 4: Add user_id column to trades table
        print("Adding user_id column to trades table...")
        try:
            cursor.execute("ALTER TABLE trades ADD COLUMN user_id INTEGER")
            print("✓ Added user_id column to trades")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ user_id column already exists in trades")
            else:
                raise
        
        # Update existing trades records with default user_id (if any)
        cursor.execute("UPDATE trades SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        updated_trades = cursor.rowcount
        print(f"✓ Updated {updated_trades} trades records with user_id")
        
        # Step 5: Add user_id column to holdings table
        print("Adding user_id column to holdings table...")
        try:
            cursor.execute("ALTER TABLE holdings ADD COLUMN user_id INTEGER")
            print("✓ Added user_id column to holdings")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ user_id column already exists in holdings")
            else:
                raise
        
        # Update existing holdings records with default user_id (if any)
        cursor.execute("UPDATE holdings SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        updated_holdings = cursor.rowcount
        print(f"✓ Updated {updated_holdings} holdings records with user_id")
        
        # Step 6: Create foreign key indexes for better performance
        print("Creating indexes for foreign keys...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_portfolio_user_id ON portfolio (user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_bot_config_user_id ON bot_config (user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_trades_user_id ON trades (user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_holdings_user_id ON holdings (user_id)")
            print("✓ Created foreign key indexes")
        except sqlite3.OperationalError as e:
            print(f"Note: Index creation warning: {e}")
        
        # Commit all changes
        conn.commit()
        print("\n✅ Database migration completed successfully!")
        
        # Verify the migration
        print("\nVerifying migration...")
        cursor.execute("PRAGMA table_info(portfolio)")
        portfolio_columns = [col[1] for col in cursor.fetchall()]
        print(f"Portfolio columns: {portfolio_columns}")
        
        cursor.execute("PRAGMA table_info(bot_config)")
        bot_config_columns = [col[1] for col in cursor.fetchall()]
        print(f"Bot config columns: {bot_config_columns}")
        
        cursor.execute("SELECT COUNT(*) FROM portfolio WHERE user_id IS NOT NULL")
        portfolio_with_user = cursor.fetchone()[0]
        print(f"Portfolio records with user_id: {portfolio_with_user}")
        
        cursor.execute("SELECT COUNT(*) FROM bot_config WHERE user_id IS NOT NULL")
        bot_config_with_user = cursor.fetchone()[0]
        print(f"Bot config records with user_id: {bot_config_with_user}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)