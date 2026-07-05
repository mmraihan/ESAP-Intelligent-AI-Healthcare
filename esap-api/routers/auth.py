from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from core.dependencies import get_current_user
from core.security import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    verify_password,
)
from database import get_db
from models.security import RefreshToken
from models.user import User
from schemas.auth import LoginRequest, LogoutRequest, MeResponse, RefreshRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_token_pair(user: User, db: Session) -> TokenResponse:
    raw_refresh_token = generate_refresh_token()
    db.add(RefreshToken(
        user_id=user.user_id,
        token_hash=hash_token(raw_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.user_id, user.role, user.email),
        refresh_token=raw_refresh_token,
        role=user.role,
        full_name=user.full_name,
        user_id=user.user_id,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return _issue_token_pair(user, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    now = datetime.now(timezone.utc)
    if not stored or stored.is_revoked or stored.expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.user_id == stored.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # rotate: revoke the used token, issue a fresh pair
    stored.is_revoked = True
    stored.revoked_at = now
    db.commit()

    return _issue_token_pair(user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if stored and not stored.is_revoked:
        stored.is_revoked = True
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        specialty=current_user.specialty,
    )
