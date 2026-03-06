import asyncio
from app.services.alpaca_service import alpaca_service

async def main():
    try:
        res = await alpaca_service.get_historical_data("GOOGL", "1mo")
        print("Success! Data points:", len(res) if res else 0)
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    asyncio.run(main())
