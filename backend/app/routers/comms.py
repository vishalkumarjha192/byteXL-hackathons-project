from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user
from app.models import User
from app.schemas.comms import MessageIn, ReviewIn
from app.services import message_service, notification_service, review_service
from app.services.realtime import manager
from app.utils.responses import ok

notifications = APIRouter(prefix="/notifications", tags=["notifications"])
messages = APIRouter(prefix="/messages", tags=["messages"])
reviews = APIRouter(prefix="/reviews", tags=["reviews"])


@notifications.get("")
def list_notifications(unread_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
                       user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ok(notification_service.list_for(db, user, page, page_size, unread_only))


@notifications.get("/unread-count")
def unread(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ok({"unread_count": notification_service.unread_count(db, user)})


@notifications.post("/read-all")
def read_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    notification_service.mark_all_read(db, user)
    return ok(None, "All notifications marked as read")


@notifications.post("/{notification_id}/read")
def read_one(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    notification_service.mark_read(db, user, notification_id)
    return ok(None)


@messages.get("/project/{project_id}")
async def project_messages(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data, newly_read = await run_in_threadpool(message_service.list_messages, db, user, project_id)
    if newly_read:  # tell the other side their messages were seen
        await manager.broadcast(project_id, {"type": "read"})
    return ok(data)


@messages.post("", status_code=201)
async def send_message(body: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sent = await run_in_threadpool(message_service.send, db, user, body)
    await manager.broadcast(body.project_id, {"type": "message", "id": sent["id"], "sender_id": user.id})
    return ok(sent, "Message sent")


@reviews.post("", status_code=201)
def create_review(body: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = review_service.create(db, user, body)
    return ok({"id": r.id}, "Review submitted")


@reviews.get("/creator/{creator_id}")
def creator_reviews(creator_id: str, db: Session = Depends(get_db)):
    return ok(review_service.creator_reviews(db, creator_id))
