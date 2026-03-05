from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import asyncio
from contextlib import asynccontextmanager

from app.config import settings
from app.models.database import engine, Base, get_db
from app.models.models import Portfolio, BotConfig
from app.services.portfolio_service import portfolio_service
from app.routers import portfolio, stocks, bot, trades, logs, auth, websocket
from app.services.trading_bot_service import trading_bot_service
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

SNAPSHOT_INTERVAL_SECONDS = 5 * 60  # every 5 minutes

async def _snapshot_loop():
    """Background task: record per-provider P&L snapshots every 5 minutes."""
    from app.models.database import SessionLocal
    # Wait one interval before first snapshot so the app is fully up
    await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
    while True:
        try:
            db = SessionLocal()
            try:
                portfolio_service.record_portfolio_snapshots(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Snapshot loop error: {e}")
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting StockBot API...")

    # Create database tables (including new portfolio_snapshots)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Start portfolio snapshot background task
    snapshot_task = asyncio.create_task(_snapshot_loop())
    logger.info("Portfolio snapshot recorder started (every 5 minutes)")

    # Resume trading loop if bot was active before the server restarted
    try:
        from app.models.database import SessionLocal
        db = SessionLocal()
        try:
            config = db.query(BotConfig).first()
            if config and config.is_active:
                logger.info("Bot was active before restart — resuming trading loop")
                await trading_bot_service.start_continuous_trading()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to resume trading bot on startup: {e}")

    yield

    # Shutdown
    logger.info("Shutting down StockBot API...")
    snapshot_task.cancel()
    await trading_bot_service.stop_continuous_trading()


# Create FastAPI app
app = FastAPI(
    title="StockBot API",
    description="AI-powered stock trading bot with virtual money",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")  # Auth routes at /api/auth
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])
app.include_router(bot.router, prefix="/api/bot", tags=["bot"])
app.include_router(trades.router, prefix="/api/trades", tags=["trades"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(websocket.router, prefix="/api/stream", tags=["websocket"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "StockBot API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "details": str(exc) if settings.debug else "An error occurred"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )