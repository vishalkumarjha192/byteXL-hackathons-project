from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.services import message_service
from app.services.realtime import manager
from app.utils.responses import AppError
from app.utils.security import decode_token

router = APIRouter(tags=["messages"])


def _allowed(db: Session, token: str, project_id: str) -> bool:
    uid = decode_token(token, "access")
    user = uid and db.get(User, uid)
    if not user or not user.is_active:
        return False
    try:
        message_service._context(db, user, project_id)  # raises unless the user is part of a hired project
        return True
    except AppError:
        return False


@router.websocket("/messages/ws/{project_id}")
async def chat_socket(ws: WebSocket, project_id: str, token: str = "", db: Session = Depends(get_db)):
    allowed = await run_in_threadpool(_allowed, db, token, project_id)
    db.close()  # do not hold a database connection for the life of the socket
    if not allowed:
        await ws.close(code=4403)
        return
    await manager.connect(project_id, ws)
    try:
        while True:
            await ws.receive_text()  # clients only listen. Anything they send (like a ping) is ignored
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(project_id, ws)
