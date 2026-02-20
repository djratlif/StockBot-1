
import os
import sys
import psycopg2
from dotenv import load_dotenv
from alpaca.trading.client import TradingClient


# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def get_alpaca_balance():
    """Fetch the current account balance from Alpaca."""
    api_key = os.getenv('ALPACA_API_KEY')
    secret_key = os.getenv('ALPACA_SECRET_KEY')
    endpoint = os.getenv('ALPACA_ENDPOINT', 'https://paper-api.alpaca.markets')
    
    if not api_key or not secret_key:
        print("❌ Alpaca API credentials not found in .env")
        return None
        
    try:
        trading_client = TradingClient(api_key, secret_key, paper=True)
        account = trading_client.get_account()
        
        cash = float(account.cash)
        equity = float(account.equity)
        
        print(f"✅ Retrieved Alpaca Balance - Cash: ${cash:.2f}, Equity: ${equity:.2f}")
        return {
            'cash': cash,
            'equity': equity
        }
    except Exception as e:
        print(f"❌ Error fetching Alpaca balance: {e}")
        return None

def reset_database():
    """Clear trading data and reset portfolio."""
    
    # Get Alpaca balance first
    alpaca_balance = get_alpaca_balance()
    if not alpaca_balance:
        print("⚠️  Could not fetch Alpaca balance. Aborting reset to prevent data inconsistency.")
        return False

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        # Fallback for local dev if not set
        db_url = "postgresql://localhost/stockbot"
        
    print(f"Connecting to database...")
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # 1. Truncate tables
        tables_to_clear = [
            'trades',
            'holdings',
            'market_data',
            'trading_log',
            'activity_log'
        ]
        
        print("Clearing data from tables...")
        for table in tables_to_clear:
            cursor.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")
            print(f"  - Cleared {table}")
            
        # 2. Reset Bot Config
        print("Resetting bot configuration...")
        cursor.execute("UPDATE bot_config SET is_active = FALSE;")
        
        # 3. Update Portfolio with Alpaca balance
        print(f"Updating portfolio balance to match Alpaca (Cash: ${alpaca_balance['cash']:.2f})...")
        cursor.execute("""
            UPDATE portfolio 
            SET cash_balance = %s, 
                total_value = %s,
                updated_at = NOW()
        """, (alpaca_balance['cash'], alpaca_balance['equity']))
        
        print("✅ Database reset complete!")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

if __name__ == "__main__":
    if reset_database():
        print("\nSUCCESS: Database has been reset and synced with Alpaca.")
    else:
        print("\nFAILURE: Database reset failed.")
        sys.exit(1)
