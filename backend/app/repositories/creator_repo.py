from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import CreatorProfile, Portfolio, User
from app.models.marketplace import (
    AITool, Language, Niche, Skill, creator_ai_tools, creator_languages, creator_niches, creator_skills,
)

SORTS = {
    "rating": CreatorProfile.rating.desc(),
    "price": CreatorProfile.starting_price.asc(),
    "newest": User.created_at.desc(),
    "recommended": (CreatorProfile.featured.desc(), CreatorProfile.verified.desc(), CreatorProfile.rating.desc(), CreatorProfile.completed_projects.desc()),
}


def _tag(table, col, model, name):
    return CreatorProfile.id.in_(
        select(table.c.creator_id).join(model, model.id == table.c[col]).where(model.name == name)
    )


def search(db: Session, f: dict, page: int, page_size: int):
    q = select(CreatorProfile).join(User, User.id == CreatorProfile.user_id).where(User.is_active.is_(True))
    conds = []
    if f.get("q"):
        like = f"%{f['q']}%"
        conds.append(CreatorProfile.display_name.ilike(like) | CreatorProfile.bio.ilike(like))
    if f.get("category"):
        conds.append(_tag(creator_skills, "skill_id", Skill, f["category"]))
    if f.get("niche"):
        conds.append(_tag(creator_niches, "niche_id", Niche, f["niche"]))
    if f.get("language"):
        conds.append(_tag(creator_languages, "language_id", Language, f["language"]))
    if f.get("ai_tool"):
        conds.append(_tag(creator_ai_tools, "ai_tool_id", AITool, f["ai_tool"]))
    if f.get("min_price") is not None:
        conds.append(CreatorProfile.starting_price >= f["min_price"])
    if f.get("max_price") is not None:
        conds.append(CreatorProfile.starting_price <= f["max_price"])
    if f.get("min_rating") is not None:
        conds.append(CreatorProfile.rating >= f["min_rating"])
    if f.get("delivery_days") is not None:
        conds.append(CreatorProfile.delivery_days <= f["delivery_days"])
    if conds:
        q = q.where(and_(*conds))
    total = db.scalar(select(__import__("sqlalchemy").func.count()).select_from(q.subquery()))
    order = SORTS.get(f.get("sort") or "recommended", SORTS["recommended"])
    q = q.order_by(*(order if isinstance(order, tuple) else (order,))).offset((page - 1) * page_size).limit(page_size)
    return list(db.scalars(q)), total


def by_user_id(db: Session, user_id: str):
    return db.scalar(select(CreatorProfile).where(CreatorProfile.user_id == user_id))


def lookup(db: Session, model, names: list[str]):
    rows = list(db.scalars(select(model).where(model.name.in_(names))))
    return rows, sorted(set(names) - {r.name for r in rows})
