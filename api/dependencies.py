"""
FastAPI依存関数
認証、データベースセッションなど
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from models import get_db, User
from core import settings, verify_token

# OAuth2スキーム
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_str}/auth/login",
    auto_error=False  # 認証なしでもアクセス可能にする場合
)

async def get_current_user_optional(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Optional[User]:
    """
    現在のユーザーを取得（オプション）
    認証なしでもアクセス可能
    """
    if not token:
        return None

    user_id = verify_token(token)
    if not user_id:
        return None

    user = db.query(User).filter(User.username == user_id).first()
    return user

async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    現在のユーザーを取得（必須）
    認証が必要なエンドポイント用
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証情報を検証できませんでした",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    user_id = verify_token(token)
    if not user_id:
        raise credentials_exception

    user = db.query(User).filter(User.username == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="アカウントが無効化されています"
        )

    return user

async def get_current_active_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    スーパーユーザーのみアクセス可能
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="スーパーユーザー権限が必要です"
        )
    return current_user