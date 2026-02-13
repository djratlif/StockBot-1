from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TradeActionEnum(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class RiskToleranceEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

# User Authentication Schemas
class UserBase(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None

class UserCreate(UserBase):
    google_id: str

class UserResponse(UserBase):
    id: int
    google_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class GoogleTokenData(BaseModel):
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Portfolio Schemas
class PortfolioBase(BaseModel):
    cash_balance: float
    total_value: float

class PortfolioResponse(PortfolioBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Holdings Schemas
class HoldingBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    quantity: int
    average_cost: float
    current_price: float

class HoldingResponse(HoldingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Trade Schemas
class TradeBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    action: TradeActionEnum
    quantity: int
    price: float
    total_amount: float
    ai_reasoning: Optional[str] = None

class TradeCreate(BaseModel):
    symbol: str = Field(..., max_length=10)
    action: TradeActionEnum
    quantity: int

class TradeResponse(TradeBase):
    id: int
    executed_at: datetime
    
    class Config:
        from_attributes = True

# Bot Configuration Schemas
class BotConfigBase(BaseModel):
    max_daily_trades: int = Field(default=5, ge=1, le=50)
    max_position_size: float = Field(default=0.20, ge=0.01, le=1.0)
    risk_tolerance: RiskToleranceEnum = RiskToleranceEnum.MEDIUM
    trading_hours_start: str = Field(default="09:30", pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    trading_hours_end: str = Field(default="16:00", pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    is_active: bool = False
    stop_loss_percentage: float = Field(default=-0.10, ge=-1.0, le=0.0)
    take_profit_percentage: float = Field(default=0.15, ge=0.0, le=5.0)
    min_cash_reserve: float = Field(default=5.00, ge=0.0)

class BotConfigUpdate(BotConfigBase):
    pass

class BotConfigResponse(BotConfigBase):
    id: int
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Market Data Schemas
class MarketDataBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    price: float
    volume: Optional[int] = None
    change_percent: Optional[float] = None

class MarketDataResponse(MarketDataBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

# Stock Info Schema
class StockInfo(BaseModel):
    symbol: str
    current_price: float
    change_percent: float
    volume: int
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None

# Trading Decision Schema
class TradingDecision(BaseModel):
    action: TradeActionEnum
    symbol: str
    quantity: int
    confidence: int = Field(..., ge=1, le=10)
    reasoning: str
    current_price: float

# Portfolio Summary Schema
class PortfolioSummary(BaseModel):
    cash_balance: float
    total_value: float
    total_invested: float
    total_return: float
    return_percentage: float
    holdings_count: int

# Trading Statistics Schema
class TradingStats(BaseModel):
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_profit_loss: float
    average_trade_return: float
    best_trade: Optional[float] = None
    worst_trade: Optional[float] = None

# API Response Schemas
class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[str] = None

# Bot Status Schema
class BotStatus(BaseModel):
    is_active: bool
    is_trading_hours: bool
    trades_today: int
    max_daily_trades: int
    cash_available: float
    portfolio_value: float
    last_trade_time: Optional[datetime] = None
    continuous_trading: Optional[bool] = False
    trading_interval_minutes: Optional[int] = 5

# Trading Interval Configuration Schema
class TradingIntervalConfig(BaseModel):
    interval_minutes: int = Field(..., ge=1, le=60, description="Trading interval in minutes (1-60)")