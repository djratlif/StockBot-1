from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import logging

from app.models.database import get_db
from app.models.schemas import APIResponse
from app.services.alpha_vantage_service import alpha_vantage_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/usage-stats")
async def get_alpha_vantage_usage():
    """Get Alpha Vantage API usage statistics"""
    try:
        stats = alpha_vantage_service.get_api_usage_stats()
        
        return {
            "success": True,
            "data": {
                "service": "Alpha Vantage",
                "api_key_configured": alpha_vantage_service.api_key != "demo",
                "daily_calls_used": stats["daily_calls_used"],
                "daily_calls_limit": stats["daily_calls_limit"],
                "calls_remaining": stats["calls_remaining"],
                "reset_time": stats["reset_time"],
                "cache_entries": stats["cache_entries"],
                "rate_limit_info": {
                    "calls_per_minute": 5,
                    "seconds_between_calls": 12
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting Alpha Vantage usage stats: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/clear-cache")
async def clear_alpha_vantage_cache():
    """Clear Alpha Vantage cache"""
    try:
        cache_count = len(alpha_vantage_service.cache)
        alpha_vantage_service.cache.clear()
        
        return APIResponse(
            success=True,
            message=f"Cleared {cache_count} cache entries",
            data={"cleared_entries": cache_count}
        )
        
    except Exception as e:
        logger.error(f"Error clearing Alpha Vantage cache: {str(e)}")
        return APIResponse(
            success=False,
            message="Failed to clear cache",
            data={"error": str(e)}
        )