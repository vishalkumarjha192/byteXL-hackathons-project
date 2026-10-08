from sqlalchemy.orm import Session

from app.models import CreatorProfile, Portfolio, User
from app.models.marketplace import AITool, Language, Niche, Skill
from app.repositories import creator_repo
from app.schemas.marketplace import CreatorUpdate, PortfolioIn
from app.utils.responses import AppError

TAGS = {"skills": Skill, "niches": Niche, "languages": Language, "ai_tools": AITool}


def my_profile(db: Session, user: User) -> CreatorProfile:
    p = creator_repo.by_user_id(db, user.id)
    if not p:
        raise AppError("CREATOR_NOT_FOUND", "Creator profile not found", 404)
    return p


def update_profile(db: Session, user: User, data: CreatorUpdate) -> CreatorProfile:
    p = my_profile(db, user)
    values = data.model_dump(exclude_unset=True)
    for field, model in TAGS.items():
        if field in values:
            rows, missing = creator_repo.lookup(db, model, values.pop(field) or [])
            if missing:
                raise AppError("UNKNOWN_TAG", f"Unknown {field}: {', '.join(missing)}", 422)
            setattr(p, field, rows)
    for k, v in values.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


def request_verification(db: Session, user: User) -> CreatorProfile:
    p = my_profile(db, user)
    if p.verified:
        raise AppError("ALREADY_VERIFIED", "Your profile is already verified", 409)
    if p.verification_requested:
        raise AppError("ALREADY_REQUESTED", "Your verification request is already with our team", 409)
    p.verification_requested = True
    db.commit()
    return p


def get_public(db: Session, creator_id: str) -> CreatorProfile:
    p = db.get(CreatorProfile, creator_id)
    if not p or not p.user.is_active:
        raise AppError("CREATOR_NOT_FOUND", "Creator not found", 404)
    return p


def add_portfolio(db: Session, user: User, data: PortfolioIn) -> Portfolio:
    p = my_profile(db, user)
    item = Portfolio(
        creator_id=p.id,
        **{k: (str(v) if k.endswith("url") and v else v) for k, v in data.model_dump().items()},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_portfolio(db: Session, user: User, item_id: str) -> None:
    p = my_profile(db, user)
    item = db.get(Portfolio, item_id)
    if not item or item.creator_id != p.id:  # ownership check
        raise AppError("PORTFOLIO_NOT_FOUND", "Portfolio item not found", 404)
    db.delete(item)
    db.commit()
