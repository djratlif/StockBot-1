from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict
from pydantic import BaseModel

from ..models.database import get_db
from ..models.schemas import GoogleTokenData, TokenResponse, UserResponse
from ..services.auth_service import auth_service
from ..auth import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])


class GoogleOAuth2Data(BaseModel):
    google_id: str
    email: str
    name: str
    picture: str


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    token_data: GoogleTokenData,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with Google OAuth token
    """
    # Verify Google token
    user_info = await auth_service.verify_google_token(token_data.token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access denied. This application is restricted to authorized users only."
        )
    
    # Get or create user
    user = auth_service.get_or_create_user(db, user_info)
    
    # Create JWT token
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


@router.post("/google-oauth2", response_model=TokenResponse)
async def google_oauth2_auth(
    user_data: GoogleOAuth2Data,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with Google OAuth2 user info (for incognito mode compatibility)
    """
    # Check if email is in allowed list
    if not auth_service.is_email_allowed(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access denied. This application is restricted to authorized users only."
        )
    
    # Convert to the format expected by get_or_create_user
    user_info = {
        'google_id': user_data.google_id,
        'email': user_data.email,
        'name': user_data.name,
        'picture': user_data.picture
    }
    
    # Get or create user
    user = auth_service.get_or_create_user(db, user_info)
    
    # Create JWT token
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user = Depends(get_current_user)
):
    """
    Get current authenticated user information
    """
    return UserResponse.from_orm(current_user)


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client should remove token)
    """
    return {"message": "Successfully logged out"}


@router.get("/verify")
async def verify_token(
    current_user = Depends(get_current_user)
):
    """
    Verify if the current token is valid
    """
    return {
        "valid": True,
        "user_id": current_user.id,
        "email": current_user.email
    }