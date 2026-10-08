from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user
from app.models import User
from app.utils.responses import ok

router = APIRouter(prefix="/users", tags=["users"])


class SettingsIn(BaseModel):
    email_notifications: bool


def _out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "role": u.role.value, "email_notifications": u.email_notifications}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return ok(_out(user))


@router.patch("/me")
def update(body: SettingsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.email_notifications = body.email_notifications
    db.commit()
    return ok(_out(user), "Settings saved")
