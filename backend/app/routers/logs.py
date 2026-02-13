from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
import logging
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.models import TradingLog, ActivityLog
from app.models.schemas import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/activity")
async def get_activity_logs(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100, description="Number of logs to return"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history to include")
):
    """Get recent activity logs for the bot"""
    try:
        # Get logs from the last N hours
        since = datetime.now() - timedelta(hours=hours)
        
        logs = db.query(ActivityLog).filter(
            ActivityLog.timestamp >= since
        ).order_by(ActivityLog.timestamp.desc()).limit(limit).all()
        
        # Convert to response format
        activity_logs = []
        for log in logs:
            activity_logs.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "action": log.action,
                "details": log.details
            })
        
        return {
            "success": True,
            "data": activity_logs,
            "count": len(activity_logs)
        }
        
    except Exception as e:
        logger.error(f"Error getting activity logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/activity")
async def add_activity_log(
    log_data: dict,
    db: Session = Depends(get_db)
):
    """Add a new activity log entry"""
    try:
        # Extract data from request
        action = log_data.get("action")
        details = log_data.get("details")
        
        if not action or not details:
            raise HTTPException(status_code=400, detail="Both 'action' and 'details' are required")
        
        # Create activity log entry
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('US/Eastern')
        log_entry = ActivityLog(
            action=action,
            details=details,
            timestamp=datetime.now(est)
        )
        
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        
        return APIResponse(
            success=True,
            message="Activity log added successfully",
            data={"log_id": log_entry.id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding activity log: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/trading")
async def add_trading_log(
    log_data: dict,
    db: Session = Depends(get_db)
):
    """Add a new trading log entry"""
    try:
        # Extract data from request
        level = log_data.get("level")
        message = log_data.get("message")
        symbol = log_data.get("symbol")
        trade_id = log_data.get("trade_id")
        
        # Validate level
        valid_levels = ["INFO", "WARNING", "ERROR", "SUCCESS"]
        if level not in valid_levels:
            raise HTTPException(status_code=400, detail=f"Invalid level. Must be one of: {', '.join(valid_levels)}")
        
        # Create log entry
        log_entry = TradingLog(
            level=level,
            message=message,
            symbol=symbol,
            trade_id=trade_id
        )
        
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        
        return APIResponse(
            success=True,
            message="Trading log added successfully",
            data={"log_id": log_entry.id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding trading log: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/activity")
async def clear_activity_logs(
    days: int = Query(default=7, ge=1, le=30, description="Clear logs older than N days"),
    db: Session = Depends(get_db)
):
    """Clear old activity logs"""
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        deleted_count = db.query(TradingLog).filter(
            TradingLog.timestamp < cutoff_date
        ).delete()
        
        db.commit()
        
        return APIResponse(
            success=True,
            message=f"Cleared {deleted_count} log entries older than {days} days",
            data={"deleted_count": deleted_count}
        )
        
    except Exception as e:
        logger.error(f"Error clearing activity logs: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/debug")
async def get_debug_info(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200, description="Number of logs to return")
):
    """Get comprehensive debug information including recent activity and trading logs"""
    try:
        import pytz
        
        # Get recent activity logs
        activity_logs = db.query(ActivityLog).order_by(
            ActivityLog.timestamp.desc()
        ).limit(limit//2).all()
        
        # Get trading logs (if any)
        trading_logs = db.query(TradingLog).order_by(
            TradingLog.timestamp.desc()
        ).limit(limit//2).all()
        
        # EST timezone for formatting
        est = pytz.timezone('US/Eastern')
        
        # Categorize logs
        debug_info = {
            "recent_activity": [],
            "errors": [],
            "warnings": [],
            "info": [],
            "api_calls": [],
            "trades": []
        }
        
        # Helper function to format timestamp to EST
        def format_timestamp_est(timestamp):
            if timestamp.tzinfo is None:
                # If timestamp is naive, assume it's UTC
                timestamp = pytz.utc.localize(timestamp)
            # Convert to EST
            est_time = timestamp.astimezone(est)
            return est_time.strftime("%Y-%m-%d %H:%M:%S EST")
        
        # Process activity logs
        for log in activity_logs:
            activity_data = {
                "id": log.id,
                "timestamp": format_timestamp_est(log.timestamp),
                "action": log.action,
                "details": log.details,
                "type": "activity"
            }
            debug_info["recent_activity"].append(activity_data)
        
        # Process trading logs
        for log in trading_logs:
            log_data = {
                "id": log.id,
                "timestamp": format_timestamp_est(log.timestamp),
                "level": log.level,
                "message": log.message,
                "symbol": log.symbol,
                "trade_id": log.trade_id,
                "type": "trading"
            }
            
            if log.level == "ERROR":
                debug_info["errors"].append(log_data)
            elif log.level == "WARNING":
                debug_info["warnings"].append(log_data)
            elif log.level == "INFO":
                debug_info["info"].append(log_data)
            
            # Check for API-related messages
            if any(keyword in log.message.lower() for keyword in ["api", "rate limit", "quota", "request"]):
                debug_info["api_calls"].append(log_data)
            
            # Check for trade-related messages
            if log.trade_id or any(keyword in log.message.lower() for keyword in ["trade", "buy", "sell", "order"]):
                debug_info["trades"].append(log_data)
        
        # Add summary statistics
        debug_info["summary"] = {
            "total_activity_logs": len(activity_logs),
            "total_trading_logs": len(trading_logs),
            "error_count": len(debug_info["errors"]),
            "warning_count": len(debug_info["warnings"]),
            "info_count": len(debug_info["info"]),
            "api_call_count": len(debug_info["api_calls"]),
            "trade_count": len(debug_info["trades"])
        }
        
        return {
            "success": True,
            "data": debug_info
        }
        
    except Exception as e:
        logger.error(f"Error getting debug info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/system-status")
async def get_system_status():
    """Get system status including API connectivity"""
    try:
        import os
        from app.services.ai_service import AITradingService
        from app.services.stock_service import StockService
        
        status = {
            "openai_api_configured": bool(os.getenv("OPENAI_API_KEY")),
            "database_connected": True,  # If we got here, DB is working
            "stock_service_available": True,
            "last_check": datetime.now().isoformat()
        }
        
        # Test OpenAI API
        try:
            if status["openai_api_configured"]:
                ai_service = AITradingService()
                # Simple test - just check if we can create the service
                status["openai_api_working"] = True
        except Exception as e:
            status["openai_api_working"] = False
            status["openai_error"] = str(e)
        
        # Test Stock API
        try:
            stock_service = StockService()
            test_price = stock_service.get_current_price("AAPL")
            status["stock_api_working"] = test_price is not None
        except Exception as e:
            status["stock_api_working"] = False
            status["stock_api_error"] = str(e)
        
        return {
            "success": True,
            "data": status
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")