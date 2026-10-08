from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import current_user
from app.models import UploadedFile, User
from app.services import upload_service as svc
from app.services.storage import get_storage
from app.utils.responses import AppError, ok
from app.utils.security import decode_token

router = APIRouter(prefix="/files", tags=["files"])


def _base(request: Request) -> str:
    return settings.PUBLIC_BASE_URL.rstrip("/") or str(request.base_url).rstrip("/")


def _file(db: Session, file_id: str) -> UploadedFile:
    f = db.get(UploadedFile, file_id)
    if not f:
        raise AppError("FILE_NOT_FOUND", "File not found", 404)
    return f


@router.post("", status_code=201)
async def upload(request: Request, purpose: str = Form(...), project_id: str | None = Form(None), file: UploadFile = File(...),
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = await run_in_threadpool(svc.upload, db, user, purpose, project_id, file, _base(request))
    return ok(data, "File uploaded")


@router.get("/{file_id}/link")
def link(file_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Returns a URL that opens the file. Private files get a short-lived signed URL; the permanent path is never shared."""
    f = _file(db, file_id)
    if not svc.can_read(db, user, f):
        raise AppError("FORBIDDEN", "You do not have access to this file", 403)
    if svc.is_public(f):
        return ok({"url": svc.file_dict(f, _base(request))["url"], "expires_in": None})
    return ok(svc.signed_link(f, _base(request)))


@router.get("/{file_id}/content")
def content(file_id: str, token: str | None = None, db: Session = Depends(get_db)):
    f = _file(db, file_id)
    public = svc.is_public(f)
    if not public and (not token or decode_token(token, "file") != f.id):
        raise AppError("INVALID_LINK", "This download link is invalid or has expired", 401)
    inline = f.content_type.split("/")[0] in ("image", "video") or f.content_type == "application/pdf"
    headers = {
        "Content-Length": str(f.size), "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f"{'inline' if inline else 'attachment'}; filename*=UTF-8''{quote(f.filename)}",
        "Cache-Control": "public, max-age=3600" if public else "private, no-store",
    }
    return StreamingResponse(get_storage().open(f.key), media_type=f.content_type, headers=headers)
