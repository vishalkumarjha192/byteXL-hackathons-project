from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import BrandProfile, Conversation, Contract, CreatorProfile, Message, Notification, Project, User
from app.schemas.comms import MessageIn
from app.services.notification_service import notify
from app.services.upload_service import file_info, require_file
from app.services.workflow_service import _role_in as participant_role
from app.utils.responses import AppError


def _context(db: Session, user: User, project_id: str):
    p = db.get(Project, project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    c = db.scalar(select(Contract).where(Contract.project_id == p.id))
    role = participant_role(db, user, p, c)  # 403 for anyone outside the project
    if not c:
        raise AppError("NOT_HIRED", "Messaging opens once a creator is hired", 409)
    return p, c, role


def _conversation(db: Session, project_id: str) -> Conversation:
    conv = db.scalar(select(Conversation).where(Conversation.project_id == project_id))
    if not conv:
        conv = Conversation(project_id=project_id)
        db.add(conv)
        db.flush()
    return conv


def _names(db: Session, p: Project, c: Contract) -> dict[str, str]:
    brand, creator = db.get(BrandProfile, p.brand_id), db.get(CreatorProfile, c.creator_id)
    return {brand.user_id: brand.company_name, creator.user_id: creator.display_name}


def _dict(db: Session, m: Message, user: User, names: dict[str, str]) -> dict:
    return {"id": m.id, "sender_id": m.sender_id, "sender_name": names.get(m.sender_id, "Unknown"), "mine": m.sender_id == user.id,
            "message": m.message, "attachment_url": m.attachment_url, "attachment_file": file_info(db, m.attachment_file_id), "created_at": m.created_at.isoformat(),
            "read_at": m.read_at.isoformat() if m.read_at else None}


def list_messages(db: Session, user: User, project_id: str) -> tuple[list[dict], int]:
    p, c, _ = _context(db, user, project_id)
    conv = _conversation(db, p.id)
    rows = list(db.scalars(select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).limit(500)))
    now = datetime.now(timezone.utc)
    marked = 0
    for m in rows:
        if m.sender_id != user.id and m.read_at is None:
            m.read_at = now
            marked += 1
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.type == "NEW_MESSAGE",
                                          Notification.link == f"/projects/{p.id}/workspace").values(is_read=True))
    db.commit()
    names = _names(db, p, c)
    return [_dict(db, m, user, names) for m in rows], marked


def send(db: Session, user: User, data: MessageIn) -> dict:
    p, c, role = _context(db, user, data.project_id)
    conv = _conversation(db, p.id)
    if data.attachment_file_id:
        require_file(db, user, data.attachment_file_id, "ATTACHMENT", p.id)
    m = Message(conversation_id=conv.id, sender_id=user.id, message=data.message, attachment_file_id=data.attachment_file_id,
                attachment_url=str(data.attachment_url) if data.attachment_url else None)
    db.add(m)
    names = _names(db, p, c)
    recipient = next(uid for uid in names if uid != user.id)
    link = f"/projects/{p.id}/workspace"
    already = db.scalar(select(Notification).where(Notification.user_id == recipient, Notification.type == "NEW_MESSAGE",
                                                   Notification.link == link, Notification.is_read.is_(False)))
    if not already:  # one unread alert per conversation, not one per message
        notify(db, recipient, "NEW_MESSAGE", "New message", f"{names[user.id]} sent a message about {p.title}", link)
    db.commit()
    db.refresh(m)
    return _dict(db, m, user, names)
