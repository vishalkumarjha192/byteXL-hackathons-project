from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AdminAction, User


def record(db: Session, admin: User, action: str, target_type: str, target_id: str, summary: str) -> None:
    """Adds an audit row to the current transaction, so it is saved only if the action itself succeeds."""
    db.add(AdminAction(admin_id=admin.id, action=action, target_type=target_type, target_id=target_id, summary=summary[:300]))


def list_log(db: Session, page: int, size: int) -> dict:
    total = db.scalar(select(func.count()).select_from(AdminAction)) or 0
    rows = db.scalars(select(AdminAction).order_by(AdminAction.created_at.desc()).offset((page - 1) * size).limit(size))
    items = [{"id": a.id, "admin": db.get(User, a.admin_id).email, "action": a.action, "target_type": a.target_type,
              "target_id": a.target_id, "summary": a.summary, "created_at": a.created_at.isoformat()} for a in rows]
    return {"items": items, "page": page, "page_size": size, "total": total}
