from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user
from app.models.user import User
from app.schemas.auth import ForgotIn, LoginIn, RefreshIn, RegisterIn, ResetIn, UserOut
from app.services import auth_service
from app.utils.ratelimit import RateLimiter
from app.utils.responses import ok

router = APIRouter(prefix="/auth", tags=["auth"])
login_limiter = RateLimiter(limit=10, window_seconds=60)
forgot_limiter = RateLimiter(limit=5, window_seconds=900)


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    user = auth_service.register(db, body)
    return ok(UserOut.model_validate(user).model_dump(), "Registered successfully")


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    login_limiter.check(body.email.lower())
    return ok(auth_service.login(db, body), "Logged in successfully")


@router.post("/forgot-password")
def forgot_password(body: ForgotIn, db: Session = Depends(get_db)):
    forgot_limiter.check(body.email.lower())
    auth_service.forgot_password(db, body.email)
    return ok(None, "If that email has an account, we have sent a reset link")


@router.post("/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    auth_service.reset_password(db, body.token, body.password)
    return ok(None, "Password updated. You can log in now")


@router.post("/refresh")
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    return ok(auth_service.refresh(db, body.refresh_token))


@router.get("/me")
def me(user: User = Depends(current_user)):
    return ok(UserOut.model_validate(user).model_dump())
