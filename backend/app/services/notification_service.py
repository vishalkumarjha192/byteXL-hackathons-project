from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CreatorProfile, Notification, Project, User
from app.services.email_service import queue_after_commit
from app.models.marketplace import Skill, creator_skills
from app.utils.responses import AppError


# Only the moments people act on get an email. Chatty ones (new project alerts, report receipts) stay in the app.
EMAIL_TYPES = {"NEW_APPLICATION", "APPLICATION_ACCEPTED", "APPLICATION_REJECTED", "DELIVERABLE_UPLOADED", "REVISION_REQUESTED",
               "PROJECT_APPROVED", "PROJECT_FUNDED", "PAYMENT_RELEASED", "NEW_MESSAGE", "REVIEW_RECEIVED", "CREATOR_VERIFIED"}


def notify(db: Session, user_id: str, type_: str, title: str, message: str, link: str | None = None) -> None:
    """Adds a notification to the current transaction; the caller commits. Emails go out after the commit."""
    db.add(Notification(user_id=user_id, type=type_, title=title, message=message, link=link))
    if type_ in EMAIL_TYPES:
        user = db.get(User, user_id)
        if user and user.is_active and user.email_notifications:
            where = f"\n\nOpen it here: {settings.FRONTEND_URL}{link}" if link else ""
            queue_after_commit(db, user.email, title, f"{message}{where}\n\nYou can turn these emails off in your notification settings.")


def notify_matching_creators(db: Session, project: Project, limit: int = 50) -> None:
    ids = select(creator_skills.c.creator_id).join(Skill, Skill.id == creator_skills.c.skill_id).where(Skill.name == project.category)
    for c in db.scalars(select(CreatorProfile).where(CreatorProfile.id.in_(ids)).limit(limit)):
        notify(db, c.user_id, "NEW_PROJECT", "New project in your category", project.title, f"/jobs/{project.id}")


def list_for(db: Session, user: User, page: int, page_size: int, unread_only: bool) -> dict:
    q = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        q = q.where(Notification.is_read.is_(False))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = [{"id": n.id, "type": n.type, "title": n.title, "message": n.message, "link": n.link,
              "is_read": n.is_read, "created_at": n.created_at.isoformat()} for n in rows]
    return {"items": items, "page": page, "page_size": page_size, "total": total, "unread_count": unread_count(db, user)}


def unread_count(db: Session, user: User) -> int:
    return db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id, Notification.is_read.is_(False))) or 0


def mark_read(db: Session, user: User, notification_id: str) -> None:
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404)
    n.is_read = True
    db.commit()


def mark_all_read(db: Session, user: User) -> None:
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
