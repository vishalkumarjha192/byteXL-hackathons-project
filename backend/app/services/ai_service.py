from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, BrandProfile, CreatorProfile, Project, ProjectStatus, User
from app.services import ai_providers
from app.services.matching import get_strategy
from app.services.workflow_service import owned_project
from app.utils.responses import AppError


def generate_brief(prompt: str) -> dict:
    return ai_providers.generate_brief(prompt).model_dump()


def match_creators(db: Session, user: User, project_id: str, limit: int = 10) -> list[dict]:
    project = owned_project(db, user, project_id)
    industry = db.get(BrandProfile, project.brand_id).industry
    strategy = get_strategy()
    creators = db.scalars(select(CreatorProfile).join(User, User.id == CreatorProfile.user_id)
                          .where(User.is_active.is_(True)).order_by(CreatorProfile.rating.desc()).limit(300))
    ranked = []
    for c in creators:
        m = strategy.score(c, project, industry)
        ranked.append({"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "verified": c.verified, "rating": c.rating,
                       "review_count": c.review_count, "starting_price": c.starting_price, "delivery_days": c.delivery_days,
                       "niches": [n.name for n in c.niches], "languages": [l.name for l in c.languages],
                       "match_score": m.score, "reasons": m.reasons, "warnings": m.warnings})
    ranked.sort(key=lambda r: (-r["match_score"], -r["rating"]))
    return ranked[:limit]


def recommended_projects(db: Session, user: User, limit: int = 10) -> list[dict]:
    creator = user.creator_profile
    if not creator:
        raise AppError("CREATOR_NOT_FOUND", "Creator profile not found", 404)
    applied = set(db.scalars(select(Application.project_id).where(Application.creator_id == creator.id)))
    projects = [p for p in db.scalars(select(Project).where(Project.status == ProjectStatus.OPEN).order_by(Project.created_at.desc()).limit(200))
                if p.id not in applied]
    industries = {b.id: b.industry for b in db.scalars(select(BrandProfile).where(BrandProfile.id.in_({p.brand_id for p in projects})))} if projects else {}
    strategy, out = get_strategy(), []
    for p in projects:
        m = strategy.score(creator, p, industries.get(p.brand_id))
        out.append({"id": p.id, "title": p.title, "category": p.category, "content_type": p.content_type, "budget": p.budget,
                    "currency": p.currency, "deadline": p.deadline.isoformat() if p.deadline else None, "language": p.language,
                    "match_score": m.score, "reasons": m.reasons, "warnings": m.warnings})
    out.sort(key=lambda r: -r["match_score"])
    return out[:limit]
