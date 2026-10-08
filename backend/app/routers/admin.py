from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user, require_roles
from app.models import Role, User
from app.schemas.admin import CategoryIn, FeatureIn, ReportIn, ResolveIn, SuspendIn, VerifyIn
from app.services import admin_service as svc
from app.services import audit_service
from app.services import report_service
from app.utils.responses import ok

router = APIRouter(prefix="/admin", tags=["admin"])
reports_router = APIRouter(prefix="/reports", tags=["reports"])
admin = require_roles(Role.ADMIN)
Page = Query(1, ge=1)
Size = Query(20, ge=1, le=50)


@router.get("/stats")
def stats(_: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.stats(db))


@router.get("/users")
def users(q: str | None = None, role: str | None = Query(None, pattern="^(BRAND|CREATOR|ADMIN)$"), active: bool | None = None,
          page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.users(db, q, role, active, page, page_size))


@router.post("/users/{user_id}/suspend")
def suspend(user_id: str, body: SuspendIn, a: User = Depends(admin), db: Session = Depends(get_db)):
    u = svc.set_suspended(db, a, user_id, body.suspended)
    return ok({"id": u.id, "is_active": u.is_active}, "User suspended" if body.suspended else "User reinstated")


@router.get("/creators")
def creators(q: str | None = None, verified: bool | None = None, pending: bool = False, featured: bool | None = None,
             page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.creators(db, q, verified, pending, featured, page, page_size))


@router.post("/creators/{creator_id}/verify")
def verify(creator_id: str, body: VerifyIn, a: User = Depends(admin), db: Session = Depends(get_db)):
    c = svc.set_verified(db, a, creator_id, body.verified)
    return ok({"id": c.id, "verified": c.verified}, "Creator verified" if body.verified else "Verification removed")


@router.post("/creators/{creator_id}/feature")
def feature(creator_id: str, body: FeatureIn, a: User = Depends(admin), db: Session = Depends(get_db)):
    c = svc.set_featured(db, a, creator_id, body.featured)
    return ok({"id": c.id, "featured": c.featured}, "Creator featured" if body.featured else "Creator unfeatured")


@router.get("/brands")
def brands(q: str | None = None, page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.brands(db, q, page, page_size))


@router.get("/projects")
def projects(q: str | None = None, status: str | None = None, page: int = Page, page_size: int = Size,
             _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.projects(db, q, status, page, page_size))


@router.get("/projects/{project_id}")
def project_detail(project_id: str, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.project_detail(db, project_id))


@router.get("/payments")
def payments(status: str | None = None, page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.payments(db, status, page, page_size))


@router.get("/payments/{payment_id}")
def payment_detail(payment_id: str, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.payment_detail(db, payment_id))


@router.get("/reports")
def reports(status: str | None = None, page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.reports(db, status, page, page_size))


@router.post("/reports/{report_id}/resolve")
def resolve(report_id: str, body: ResolveIn, a: User = Depends(admin), db: Session = Depends(get_db)):
    r = report_service.resolve(db, a, report_id, body.action, body.note)
    return ok({"id": r.id, "status": r.status.value}, "Report handled")


@router.get("/audit")
def audit(page: int = Page, page_size: int = Size, _: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(audit_service.list_log(db, page, page_size))


@router.get("/categories")
def categories(_: User = Depends(admin), db: Session = Depends(get_db)):
    return ok(svc.categories(db))


@router.post("/categories/{kind}", status_code=201)
def add_category(kind: str, body: CategoryIn, a: User = Depends(admin), db: Session = Depends(get_db)):
    row = svc.add_category(db, a, kind, body.name)
    return ok({"id": row.id, "name": row.name}, "Category added")


@router.delete("/categories/{kind}/{category_id}")
def delete_category(kind: str, category_id: int, a: User = Depends(admin), db: Session = Depends(get_db)):
    svc.delete_category(db, a, kind, category_id)
    return ok(None, "Category deleted")


@reports_router.post("", status_code=201)
def report(body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = report_service.create(db, user, body)
    return ok({"id": r.id}, "Report sent. Thank you.")
