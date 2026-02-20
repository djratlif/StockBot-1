
import psycopg2
import sys

def verify_reset():
    try:
        conn = psycopg2.connect(dbname='stockbot')
        cursor = conn.cursor()
        
        # 1. Check tables are empty
        tables = ['trades', 'holdings', 'market_data', 'trading_log', 'activity_log']
        all_empty = True
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            if count > 0:
                print(f"❌ {table} is NOT empty ({count} rows)")
                all_empty = False
            else:
                print(f"✅ {table} is empty")
                
        # 2. Check Bot Config
        cursor.execute("SELECT is_active FROM bot_config")
        config = cursor.fetchone()
        if config and config[0] is False:
             print("✅ Bot is inactive")
        else:
             print(f"❌ Bot active status is {config[0] if config else 'None'}")
             all_empty = False

        # 3. Check Portfolio
        cursor.execute("SELECT cash_balance, total_value FROM portfolio")
        portfolio = cursor.fetchone()
        if portfolio:
            print(f"✅ Portfolio Balance - Cash: ${portfolio[0]:.2f}, Total: ${portfolio[1]:.2f}")
            if portfolio[0] == 2000.00:
                print("⚠️  Warning: Balance is exactly 2000.00 (default), check if Alpaca sync worked if it shouldn't be default.")
        else:
            print("❌ Portfolio not found")
            all_empty = False
            
        cursor.close()
        conn.close()
        
        return all_empty
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if verify_reset():
        print("\nVerification PASSED")
    else:
        print("\nVerification FAILED")
