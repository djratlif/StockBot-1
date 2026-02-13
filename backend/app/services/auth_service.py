from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import httpx

from ..config import settings
from ..models.models import User, Portfolio, BotConfig
from ..models.schemas import UserCreate, UserResponse


class AuthService:
    def __init__(self):
        self.google_client_id = settings.google_client_id
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes

    async def verify_google_token(self, token: str) -> Optional[dict]:
        """Verify Google OAuth token and return user info"""
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, requests.Request(), self.google_client_id
            )
            
            # Check if the token is for our app
            if idinfo['aud'] != self.google_client_id:
                return None
            
            # Check if email is in allowed list
            email = idinfo['email']
            if settings.allowed_emails_list and email not in settings.allowed_emails_list:
                return None  # Email not in allowed list
                
            return {
                'google_id': idinfo['sub'],
                'email': email,
                'name': idinfo['name'],
                'picture': idinfo.get('picture', '')
            }
        except ValueError:
            # Invalid token
            return None

    def is_email_allowed(self, email: str) -> bool:
        """Check if email is in the allowed list"""
        if not settings.allowed_emails_list:
            return True  # If no restrictions, allow all emails
        return email in settings.allowed_emails_list

    def create_access_token(self, data: dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[dict]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

    def get_or_create_user(self, db: Session, user_data: dict) -> User:
        """Get existing user or create new one"""
        # Check if user exists
        user = db.query(User).filter(User.google_id == user_data['google_id']).first()
        
        if user:
            # Update user info in case it changed
            user.email = user_data['email']
            user.name = user_data['name']
            user.picture = user_data['picture']
            user.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(user)
            return user
        
        # Create new user
        user = User(
            google_id=user_data['google_id'],
            email=user_data['email'],
            name=user_data['name'],
            picture=user_data['picture']
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create initial portfolio for new user
        portfolio = Portfolio(
            user_id=user.id,
            cash_balance=settings.initial_balance,
            total_value=settings.initial_balance
        )
        db.add(portfolio)
        
        # Create initial bot config for new user
        bot_config = BotConfig(
            user_id=user.id,
            max_daily_trades=settings.default_max_daily_trades,
            risk_tolerance=settings.default_risk_tolerance
        )
        db.add(bot_config)
        
        db.commit()
        return user

    def get_user_by_id(self, db: Session, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()

    def get_user_by_google_id(self, db: Session, google_id: str) -> Optional[User]:
        """Get user by Google ID"""
        return db.query(User).filter(User.google_id == google_id).first()


# Global auth service instance
auth_service = AuthService()