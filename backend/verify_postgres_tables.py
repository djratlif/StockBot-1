import psycopg2
import sys

def verify_tables():
    try:
        # Connect to the stockbot database
        conn = psycopg2.connect(dbname='stockbot')
        cursor = conn.cursor()
        
        # List of expected tables
        expected_tables = ['users', 'portfolio', 'bot_config', 'trades', 'holdings']
        
        print("Checking for tables in 'stockbot' database:")
        
        # Query for existing tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        missing_tables = []
        for table in expected_tables:
            if table in existing_tables:
                print(f"✅ {table} found")
            else:
                print(f"❌ {table} missing")
                missing_tables.append(table)
                
        cursor.close()
        conn.close()
        
        if not missing_tables:
            print("\nAll expected tables present!")
            return True
        else:
            print(f"\nMissing tables: {', '.join(missing_tables)}")
            return False
            
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False

if __name__ == "__main__":
    if verify_tables():
        sys.exit(0)
    else:
        sys.exit(1)
