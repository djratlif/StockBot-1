from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # API Keys
    openai_api_key: str
    alpha_vantage_api_key: Optional[str] = None
    polygon_api_key: Optional[str] = None
    
    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    
    # Database
    database_url: str = "sqlite:///./stockbot.db"
    
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Authentication restrictions
    allowed_emails: Optional[str] = None  # Comma-separated list of allowed emails
    
    # Bot Configuration
    initial_balance: float = 20.00
    default_max_daily_trades: int = 5
    default_risk_tolerance: str = "MEDIUM"
    
    # Trading Hours (EST)
    trading_start_hour: int = 9
    trading_start_minute: int = 30
    trading_end_hour: int = 16
    trading_end_minute: int = 0
    
    # Environment
    environment: str = "development"
    debug: bool = True
    
    # CORS
    allowed_origins: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    @property
    def allowed_emails_list(self) -> list:
        """Convert comma-separated allowed emails to list"""
        if not self.allowed_emails:
            return []
        return [email.strip() for email in self.allowed_emails.split(',')]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()