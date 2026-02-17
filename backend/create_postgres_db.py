import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys

def create_database():
    # Try connecting to default 'postgres' database
    try:
        # Try with current user first (common on Mac/Homebrew)
        conn = psycopg2.connect(dbname='postgres')
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'stockbot'")
        exists = cursor.fetchone()
        
        if not exists:
            print("Creating database 'stockbot'...")
            cursor.execute('CREATE DATABASE stockbot')
            print("Database created successfully.")
        else:
            print("Database 'stockbot' already exists.")
            
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"Failed to connect with default settings: {e}")
        return False

if __name__ == "__main__":
    if create_database():
        print("Success")
    else:
        print("Failed")
