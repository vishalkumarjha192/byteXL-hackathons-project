from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import BrandProfile, Project, ProjectAsset, ProjectStatus, Role, UploadedFile, User
from app.schemas.marketplace import ProjectIn, ProjectOut
from app.services import notification_service
from app.services.upload_service import file_dict
from app.utils.responses import AppError, ok

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", status_code=201)
def create(body: ProjectIn, user: User = Depends(require_roles(Role.BRAND)), db: Session = Depends(get_db)):
    brand = user.brand_profile
    if not brand:
        raise AppError("BRAND_NOT_FOUND", "Brand profile not found", 404)
    project = Project(brand_id=brand.id, **body.model_dump(exclude={"assets"}))
    db.add(project)
    db.flush()
    for a in body.assets:
        f = db.get(UploadedFile, a.file_id)
        if not f or f.owner_id != user.id or f.purpose != "ASSET" or f.project_id:
            raise AppError("INVALID_FILE", "One of the files cannot be attached. Upload it again.", 422)
        f.project_id = project.id
        db.add(ProjectAsset(project_id=project.id, file_id=f.id, file_type=a.file_type))
    notification_service.notify_matching_creators(db, project)
    db.commit()
    db.refresh(project)
    return ok(ProjectOut.model_validate(project).model_dump(mode="json"), "Project published")


@router.get("")
def list_jobs(
    q: str | None = None,
    category: str | None = None,
    language: str | None = None,
    min_budget: float | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    stmt = select(Project).where(Project.status == ProjectStatus.OPEN)
    if q:
        stmt = stmt.where(Project.title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(Project.category == category)
    if language:
        stmt = stmt.where(Project.language == language)
    if min_budget is not None:
        stmt = stmt.where(Project.budget >= min_budget)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = [ProjectOut.model_validate(r).model_dump(mode="json") for r in rows]
    return ok({"items": items, "page": page, "page_size": page_size, "total": total})


@router.get("/{project_id}")
def detail(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    assets = db.execute(select(ProjectAsset, UploadedFile).join(UploadedFile, UploadedFile.id == ProjectAsset.file_id).where(ProjectAsset.project_id == p.id))
    out = ProjectOut.model_validate(p).model_dump(mode="json")
    out["assets"] = [{"id": a.id, "file_type": a.file_type, "file": file_dict(f)} for a, f in assets]
    return ok(out)
