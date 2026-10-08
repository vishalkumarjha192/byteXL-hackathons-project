from datetime import timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import Role, User
from app.repositories import user_repo
from app.schemas.auth import LoginIn, RegisterIn
from app.services.email_service import send_email
from app.utils.responses import AppError
import hashlib

from app.utils.security import create_token, decode_claims, decode_token, hash_password, verify_password


def _tokens(user: User) -> dict:
    return {
        "access_token": create_token(user.id, "access", timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)),
        "refresh_token": create_token(user.id, "refresh", timedelta(days=settings.REFRESH_TOKEN_DAYS)),
        "token_type": "bearer",
    }


def register(db: Session, data: RegisterIn) -> User:
    if data.role == Role.ADMIN:
        raise AppError("FORBIDDEN_ROLE", "Cannot self-register as admin", 403)
    if user_repo.get_by_email(db, data.email):
        raise AppError("EMAIL_TAKEN", "Email is already registered", 409)
    return user_repo.create_user(db, data.email, hash_password(data.password), data.role, data.name)


def login(db: Session, data: LoginIn) -> dict:
    user = user_repo.get_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    if not user.is_active:
        raise AppError("USER_SUSPENDED", "Account is suspended", 403)
    return _tokens(user)


def refresh(db: Session, refresh_token: str) -> dict:
    uid = decode_token(refresh_token, "refresh")
    user = uid and user_repo.get_by_id(db, uid)
    if not user or not user.is_active:
        raise AppError("INVALID_TOKEN", "Invalid refresh token", 401)
    return _tokens(user)


RESET_MINUTES = 30


def _fingerprint(password_hash: str) -> str:
    """Ties a reset link to the current password, so using it once (or changing the password) kills it."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def forgot_password(db: Session, email: str) -> None:
    """Always behaves the same, so the endpoint cannot be used to find out who has an account."""
    user = user_repo.get_by_email(db, email)
    if not user or not user.is_active:
        return
    token = create_token(user.id, "reset", timedelta(minutes=RESET_MINUTES), fp=_fingerprint(user.password_hash))
    send_email(user.email, "Reset your Creatorly password",
               f"We received a request to reset your password.\n\nChoose a new one here (valid for {RESET_MINUTES} minutes):\n"
               f"{settings.FRONTEND_URL}/reset-password?token={token}\n\nIf you did not ask for this, you can ignore this email.")


def reset_password(db: Session, token: str, new_password: str) -> None:
    claims = decode_claims(token, "reset")
    user = claims and user_repo.get_by_id(db, claims["sub"])
    if not user or not user.is_active or claims.get("fp") != _fingerprint(user.password_hash):
        raise AppError("INVALID_TOKEN", "This reset link is invalid, expired or already used", 400)
    user.password_hash = hash_password(new_password)
    db.commit()
    send_email(user.email, "Your Creatorly password was changed", "Your password was just changed. If this was not you, contact support right away.")
