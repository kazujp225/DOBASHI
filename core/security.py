"""
セキュリティ関連の機能
JWT認証、パスワードハッシュ化など
"""
from datetime import datetime, timedelta
from typing import Optional, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings

# パスワードのハッシュ化設定
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(
    subject: str | Any,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    アクセストークンの生成

    Args:
        subject: トークンのsubject（通常はユーザーID）
        expires_delta: トークンの有効期限

    Returns:
        JWTトークン文字列
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": datetime.utcnow()
    }

    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm
    )
    return encoded_jwt

def verify_token(token: str) -> Optional[str]:
    """
    トークンの検証

    Args:
        token: JWTトークン文字列

    Returns:
        トークンが有効な場合はsubject、無効な場合はNone
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    パスワードの検証

    Args:
        plain_password: 平文パスワード
        hashed_password: ハッシュ化されたパスワード

    Returns:
        パスワードが一致する場合はTrue
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    パスワードのハッシュ化

    Args:
        password: 平文パスワード

    Returns:
        ハッシュ化されたパスワード
    """
    # bcryptは最大72バイトまでしか処理できないため、切り詰める
    if len(password.encode('utf-8')) > 72:
        password = password[:72]
    return pwd_context.hash(password)