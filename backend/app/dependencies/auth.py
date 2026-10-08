from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Role, User
from app.repositories import user_repo
from app.utils.responses import AppError
from app.utils.security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    uid = creds and decode_token(creds.credentials, "access")
    user = uid and user_repo.get_by_id(db, uid)
    if not user:
        raise AppError("UNAUTHORIZED", "Authentication required", 401)
    if not user.is_active:
        raise AppError("USER_SUSPENDED", "Account is suspended", 403)
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise AppError("FORBIDDEN", "You do not have permission", 403)
        return user

    return checker
