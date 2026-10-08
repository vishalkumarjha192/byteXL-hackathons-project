import os
import tempfile
import uuid
from datetime import timedelta

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contract, Project, Role, UploadedFile, User
from app.services.storage import get_storage
from app.utils.responses import AppError
from app.utils.security import create_token

PK = lambda h: h.startswith(b"PK\x03\x04")
FTYP = lambda h: h[4:8] == b"ftyp"
JPEG = lambda h: h.startswith(b"\xff\xd8\xff")
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
# extension -> (content type, kind, check against the first bytes). SVG is deliberately absent: it can carry scripts.
EXT = {
    ".png": ("image/png", "image", lambda h: h.startswith(b"\x89PNG\r\n\x1a\n")), ".jpg": ("image/jpeg", "image", JPEG), ".jpeg": ("image/jpeg", "image", JPEG),
    ".gif": ("image/gif", "image", lambda h: h[:4] == b"GIF8"), ".webp": ("image/webp", "image", lambda h: h[:4] == b"RIFF" and h[8:12] == b"WEBP"),
    ".pdf": ("application/pdf", "pdf", lambda h: h.startswith(b"%PDF")), ".mp4": ("video/mp4", "video", FTYP), ".mov": ("video/quicktime", "video", FTYP),
    ".webm": ("video/webm", "video", lambda h: h.startswith(b"\x1a\x45\xdf\xa3")), ".zip": ("application/zip", "zip", PK), ".docx": (DOCX, "doc", PK),
}
PURPOSES = {
    "AVATAR": {"public": True, "kinds": {"image"}, "max_mb": 5}, "LOGO": {"public": True, "kinds": {"image"}, "max_mb": 5},
    "PORTFOLIO": {"public": True, "kinds": {"image", "video"}, "max_mb": 100},
    "DELIVERABLE": {"public": False, "kinds": {"image", "video", "pdf", "zip"}, "max_mb": 100},
    "ATTACHMENT": {"public": False, "kinds": {"image", "video", "pdf", "doc", "zip"}, "max_mb": 20},
    "ASSET": {"public": False, "kinds": {"image", "video", "pdf"}, "max_mb": 50},
}
LINK_MINUTES = 5


def is_public(f: UploadedFile) -> bool:
    return PURPOSES[f.purpose]["public"]


def file_dict(f: UploadedFile, base_url: str = "") -> dict:
    return {"id": f.id, "filename": f.filename, "content_type": f.content_type, "size": f.size, "purpose": f.purpose,
            "url": f"{base_url}/api/v1/files/{f.id}/content" if is_public(f) else None, "created_at": f.created_at.isoformat()}


def file_info(db: Session, file_id: str | None) -> dict | None:
    f = db.get(UploadedFile, file_id) if file_id else None
    return file_dict(f) if f else None


def _participant(db: Session, user: User, project: Project) -> bool:
    if user.brand_profile and user.brand_profile.id == project.brand_id:
        return True
    c = db.scalar(select(Contract).where(Contract.project_id == project.id))
    return bool(c and user.creator_profile and user.creator_profile.id == c.creator_id)


def _authorize_upload(db: Session, user: User, purpose: str, project_id: str | None) -> Project | None:
    def deny(msg="You cannot upload this kind of file"):
        raise AppError("FORBIDDEN", msg, 403)

    project = db.get(Project, project_id) if project_id else None
    if project_id and not project:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    if purpose in ("AVATAR", "PORTFOLIO", "LOGO"):
        if project_id:
            raise AppError("INVALID_FILE", "This upload is not tied to a project", 422)
        if not (user.creator_profile if purpose != "LOGO" else user.brand_profile):
            deny()
    elif purpose in ("DELIVERABLE", "ATTACHMENT"):
        if not project:
            raise AppError("INVALID_FILE", "A project is required for this upload", 422)
        if purpose == "DELIVERABLE":
            c = db.scalar(select(Contract).where(Contract.project_id == project.id))
            if not (c and user.creator_profile and user.creator_profile.id == c.creator_id):
                deny("Only the hired creator can upload deliverables")
        elif not _participant(db, user, project):
            deny("You are not part of this project")
    elif purpose == "ASSET":
        if not user.brand_profile or (project and project.brand_id != user.brand_profile.id):
            deny("Only the brand that owns the project can upload brief files")
    return project


def upload(db: Session, user: User, purpose: str, project_id: str | None, up: UploadFile, base_url: str) -> dict:
    rule = PURPOSES.get(purpose)
    if not rule:
        raise AppError("UNKNOWN_PURPOSE", f"Purpose must be one of: {', '.join(PURPOSES)}", 422)
    project = _authorize_upload(db, user, purpose, project_id)
    name = os.path.basename(up.filename or "")
    ext = os.path.splitext(name)[1].lower()
    if ext not in EXT:
        raise AppError("INVALID_FILE_TYPE", "This file type is not allowed", 422)
    content_type, kind, check = EXT[ext]
    if kind not in rule["kinds"]:
        raise AppError("INVALID_FILE_TYPE", f"{kind.capitalize()} files are not accepted here", 422)
    limit, size, head = int(rule["max_mb"] * 1024 * 1024), 0, b""
    tmp = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    try:
        while chunk := up.file.read(1024 * 1024):
            head = head or chunk[:16]
            size += len(chunk)
            if size > limit:
                raise AppError("FILE_TOO_LARGE", f"Files here can be up to {rule['max_mb']:g} MB", 413)
            tmp.write(chunk)
        if size == 0:
            raise AppError("EMPTY_FILE", "The file is empty", 422)
        if not check(head):
            raise AppError("INVALID_FILE_TYPE", "The file's contents do not match its type", 422)
        tmp.seek(0)
        key = f"{purpose.lower()}/{uuid.uuid4().hex}{ext}"
        get_storage().put(key, tmp, content_type)
    finally:
        tmp.close()
    f = UploadedFile(owner_id=user.id, project_id=project.id if project else None, purpose=purpose, key=key,
                     filename=name[:255], content_type=content_type, size=size)
    db.add(f)
    db.commit()
    return file_dict(f, base_url)


def require_file(db: Session, user: User, file_id: str, purpose: str, project_id: str) -> UploadedFile:
    f = db.get(UploadedFile, file_id)
    if not f or f.owner_id != user.id or f.purpose != purpose or f.project_id != project_id:
        raise AppError("INVALID_FILE", "That file cannot be used here. Upload it again for this project.", 422)
    return f


def can_read(db: Session, user: User, f: UploadedFile) -> bool:
    if is_public(f) or f.owner_id == user.id or user.role == Role.ADMIN:
        return True
    project = db.get(Project, f.project_id) if f.project_id else None
    if not project:
        return False
    if f.purpose == "ASSET":  # brief files are for creators deciding whether to apply, and for the brand
        return bool(user.creator_profile) or _participant(db, user, project)
    return _participant(db, user, project)


def signed_link(f: UploadedFile, base_url: str) -> dict:
    token = create_token(f.id, "file", timedelta(minutes=LINK_MINUTES))
    return {"url": f"{base_url}/api/v1/files/{f.id}/content?token={token}", "expires_in": LINK_MINUTES * 60}
