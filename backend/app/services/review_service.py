from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BrandProfile, Contract, CreatorProfile, Project, ProjectStatus, Review, User
from app.schemas.comms import ReviewIn
from app.services.notification_service import notify
from app.services.workflow_service import _role_in as participant_role
from app.utils.responses import AppError


def _name(db: Session, user_id: str) -> str:
    u = db.get(User, user_id)
    if u.brand_profile:
        return u.brand_profile.company_name
    return u.creator_profile.display_name if u.creator_profile else "User"


def recompute_creator_rating(db: Session, creator: CreatorProfile) -> None:
    avg, count = db.execute(select(func.avg(Review.rating), func.count()).where(Review.reviewee_id == creator.user_id)).one()
    creator.rating = round(float(avg or 0), 1)
    creator.review_count = count


def _dict(db: Session, r: Review, viewer_id: str | None = None) -> dict:
    return {"id": r.id, "rating": r.rating, "comment": r.comment, "created_at": r.created_at.isoformat(),
            "reviewer_name": _name(db, r.reviewer_id), "mine": r.reviewer_id == viewer_id}


def create(db: Session, user: User, data: ReviewIn) -> Review:
    p = db.get(Project, data.project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    c = db.scalar(select(Contract).where(Contract.project_id == p.id))
    role = participant_role(db, user, p, c)
    if p.status != ProjectStatus.COMPLETED:
        raise AppError("PROJECT_NOT_COMPLETED", "You can leave a review once the project is completed", 409)
    if db.scalar(select(Review).where(Review.project_id == p.id, Review.reviewer_id == user.id)):
        raise AppError("ALREADY_REVIEWED", "You have already reviewed this project", 409)
    brand, creator = db.get(BrandProfile, p.brand_id), db.get(CreatorProfile, c.creator_id)
    reviewee = creator.user_id if role == "BRAND" else brand.user_id
    r = Review(project_id=p.id, reviewer_id=user.id, reviewee_id=reviewee, rating=data.rating, comment=data.comment)
    db.add(r)
    db.flush()
    if role == "BRAND":
        recompute_creator_rating(db, creator)
    notify(db, reviewee, "REVIEW_RECEIVED", "You received a review", f"{_name(db, user.id)} left you {data.rating} stars on {p.title}",
           f"/projects/{p.id}/workspace")
    db.commit()
    return r


def creator_reviews(db: Session, creator_id: str) -> dict:
    c = db.get(CreatorProfile, creator_id)
    if not c:
        raise AppError("CREATOR_NOT_FOUND", "Creator not found", 404)
    rows = list(db.scalars(select(Review).where(Review.reviewee_id == c.user_id).order_by(Review.created_at.desc()).limit(50)))
    return {"average": c.rating, "total": c.review_count, "items": [_dict(db, r) for r in rows]}


def workspace_reviews(db: Session, user: User, ws: dict) -> dict:
    pid = ws["project"]["id"]
    rows = list(db.scalars(select(Review).where(Review.project_id == pid).order_by(Review.created_at.asc())))
    brand = db.get(BrandProfile, ws["project"]["brand_id"])
    avg, count = db.execute(select(func.avg(Review.rating), func.count()).where(Review.reviewee_id == brand.user_id)).one()
    return {
        "reviews": [_dict(db, r, user.id) for r in rows],
        "can_review": ws["project"]["status"] == "COMPLETED" and not any(r.reviewer_id == user.id for r in rows),
        "brand_rating": {"average": round(float(avg or 0), 1), "total": count},
    }
