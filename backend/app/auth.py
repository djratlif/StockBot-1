from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from .models.database import get_db
from .models.models import User
from .services.auth_service import auth_service

# Security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Verify the JWT token
        payload = auth_service.verify_token(credentials.credentials)
        if payload is None:
            raise credentials_exception
            
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
    except Exception:
        raise credentials_exception
    
    # Get user from database
    user = auth_service.get_user_by_id(db, user_id=int(user_id))
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    # If the user is read-only and linked to a primary user, return the primary user
    # but add a flag `is_read_only_session = True` to the user object
    if getattr(user, 'is_read_only', False) and getattr(user, 'linked_user_id', None):
        primary_user = auth_service.get_user_by_id(db, user_id=user.linked_user_id)
        if primary_user:
            primary_user.is_read_only_session = True
            primary_user.is_read_only = True
            return primary_user
            
    user.is_read_only_session = False
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to get the current active user
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def require_write_access(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency to ensure the current session is not a read-only session
    """
    if getattr(current_user, 'is_read_only_session', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write access denied for read-only accounts"
        )
    return current_user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional dependency to get current user (doesn't raise exception if no token)
    """
    if not credentials:
        return None
        
    try:
        payload = auth_service.verify_token(credentials.credentials)
        if payload is None:
            return None
            
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
            
        user = auth_service.get_user_by_id(db, user_id=int(user_id))
        if not user or not user.is_active:
            return None
            
        if getattr(user, 'is_read_only', False) and getattr(user, 'linked_user_id', None):
            primary_user = auth_service.get_user_by_id(db, user_id=user.linked_user_id)
            if primary_user:
                primary_user.is_read_only_session = True
                primary_user.is_read_only = True
                return primary_user
                
        user.is_read_only_session = False
        return user
        
    except Exception:
        return None