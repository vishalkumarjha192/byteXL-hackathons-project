from sqlalchemy.orm import Session

from app.models import BrandProfile, User
from app.schemas.brand import BrandUpdate
from app.utils.responses import AppError


def my_profile(user: User) -> BrandProfile:
    if not user.brand_profile:
        raise AppError("BRAND_NOT_FOUND", "Brand profile not found", 404)
    return user.brand_profile


def update(db: Session, user: User, data: BrandUpdate) -> BrandProfile:
    b = my_profile(user)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b
