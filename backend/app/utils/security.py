from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(p: str) -> str:
    return _pwd.hash(p)


def verify_password(p: str, h: str) -> bool:
    return _pwd.verify(p, h)


def create_token(sub: str, kind: str, expires: timedelta, **claims) -> str:
    payload = {"sub": sub, "type": kind, "exp": datetime.now(timezone.utc) + expires, **claims}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_claims(token: str, kind: str) -> dict | None:
    try:
        data = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    return data if data.get("type") == kind else None


def decode_token(token: str, kind: str) -> str | None:
    data = decode_claims(token, kind)
    return data["sub"] if data else None
