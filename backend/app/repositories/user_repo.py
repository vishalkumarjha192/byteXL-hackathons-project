from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import BrandProfile, CreatorProfile, Role, User


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, email: str, password_hash: str, role: Role, name: str) -> User:
    user = User(email=email.lower(), password_hash=password_hash, role=role)
    db.add(user)
    db.flush()
    if role == Role.BRAND:
        db.add(BrandProfile(user_id=user.id, company_name=name))
    elif role == Role.CREATOR:
        db.add(CreatorProfile(user_id=user.id, display_name=name))
    db.commit()
    db.refresh(user)
    return user
