from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Application, ApplicationStatus, BrandProfile, Contract, CreatorProfile, Deliverable, DeliverableKind, Project,
    ProjectStatus, Revision, User,
)
from app.schemas.marketplace import ProjectOut
from app.schemas.workflow import ApplyIn, DeliverableIn, RevisionIn
from app.services.notification_service import notify
from app.services.upload_service import file_info, require_file
from app.services.payment_service import for_project as payment_for_project, payment_service
from app.models.payments import PaymentStatus
from app.utils.responses import AppError

S = ProjectStatus


def _brand(user: User) -> BrandProfile:
    if not user.brand_profile:
        raise AppError("BRAND_NOT_FOUND", "Brand profile not found", 404)
    return user.brand_profile


def _creator(user: User) -> CreatorProfile:
    if not user.creator_profile:
        raise AppError("CREATOR_NOT_FOUND", "Creator profile not found", 404)
    return user.creator_profile


def _brand_user_id(db: Session, brand_id: str) -> str:
    return db.get(BrandProfile, brand_id).user_id


def _creator_user_id(db: Session, creator_id: str) -> str:
    return db.get(CreatorProfile, creator_id).user_id


def _project(db: Session, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    return p


def owned_project(db: Session, user: User, project_id: str) -> Project:
    p = _project(db, project_id)
    if p.brand_id != _brand(user).id:
        raise AppError("FORBIDDEN", "This project belongs to another brand", 403)
    return p


def _contract(db: Session, project_id: str) -> Contract | None:
    return db.scalar(select(Contract).where(Contract.project_id == project_id))


def _move(p: Project, to: S, allowed_from: set[S]) -> None:
    if p.status not in allowed_from:
        raise AppError("INVALID_STATE", f"Cannot do this while the project is {p.status.value}", 409)
    p.status = to


# ---------- applications ----------
def apply(db: Session, user: User, data: ApplyIn) -> Application:
    creator = _creator(user)
    project = _project(db, data.project_id)
    if project.status != S.OPEN:
        raise AppError("PROJECT_CLOSED", "This project is no longer accepting applications", 409)
    if db.scalar(select(Application).where(Application.project_id == project.id, Application.creator_id == creator.id)):
        raise AppError("ALREADY_APPLIED", "You have already applied to this project", 409)
    app = Application(creator_id=creator.id, **data.model_dump())
    db.add(app)
    notify(db, _brand_user_id(db, project.brand_id), "NEW_APPLICATION", "New application",
           f"{creator.display_name} applied to {project.title}", f"/dashboard/brand/projects/{project.id}/applications")
    db.commit()
    db.refresh(app)
    return app


def _app_dict(a: Application, creator: CreatorProfile, project: Project) -> dict:
    return {
        "id": a.id, "project_id": a.project_id, "proposal": a.proposal, "proposed_price": a.proposed_price,
        "delivery_days": a.delivery_days, "status": a.status.value, "created_at": a.created_at.isoformat(),
        "project_title": project.title, "project_status": project.status.value, "currency": project.currency,
        "creator": {"id": creator.id, "display_name": creator.display_name, "avatar": creator.avatar,
                    "rating": creator.rating, "verified": creator.verified, "completed_projects": creator.completed_projects},
    }


def my_applications(db: Session, user: User) -> list[dict]:
    c = _creator(user)
    rows = db.scalars(select(Application).where(Application.creator_id == c.id).order_by(Application.created_at.desc()))
    return [_app_dict(a, c, db.get(Project, a.project_id)) for a in rows]


def project_applications(db: Session, user: User, project_id: str) -> list[dict]:
    p = owned_project(db, user, project_id)
    rows = db.scalars(select(Application).where(Application.project_id == p.id).order_by(Application.created_at.desc()))
    return [_app_dict(a, db.get(CreatorProfile, a.creator_id), p) for a in rows]


def decide(db: Session, user: User, app_id: str, accept: bool) -> dict:
    a = db.get(Application, app_id)
    if not a:
        raise AppError("APPLICATION_NOT_FOUND", "Application not found", 404)
    p = owned_project(db, user, a.project_id)
    if a.status != ApplicationStatus.PENDING:
        raise AppError("INVALID_STATE", "This application has already been handled", 409)
    if not accept:
        a.status = ApplicationStatus.REJECTED
        notify(db, _creator_user_id(db, a.creator_id), "APPLICATION_REJECTED", "Application not selected", f"Your application to {p.title} was not selected", f"/jobs/{p.id}")
        db.commit()
        return {"application_id": a.id, "status": a.status.value}
    _move(p, S.IN_PROGRESS, {S.OPEN})
    fee = round(a.proposed_price * settings.PLATFORM_FEE_PERCENT / 100, 2)  # configurable, never hard-coded
    contract = Contract(project_id=p.id, brand_id=p.brand_id, creator_id=a.creator_id, agreed_price=a.proposed_price,
                        platform_fee=fee, creator_amount=round(a.proposed_price - fee, 2))
    db.add(contract)
    payment_service.create_payment(db, p, contract, _brand_user_id(db, p.brand_id), _creator_user_id(db, a.creator_id))
    a.status = ApplicationStatus.ACCEPTED
    for other in db.scalars(select(Application).where(Application.project_id == p.id, Application.id != a.id,
                                                      Application.status == ApplicationStatus.PENDING)):
        other.status = ApplicationStatus.REJECTED
        notify(db, _creator_user_id(db, other.creator_id), "APPLICATION_REJECTED", "Application not selected", f"{p.title} went to another creator", f"/jobs/{p.id}")
    notify(db, _creator_user_id(db, a.creator_id), "APPLICATION_ACCEPTED", "You were hired", f"You are hired on {p.title}", f"/projects/{p.id}/workspace")
    db.commit()
    return {"application_id": a.id, "status": a.status.value, "project_id": p.id}


def withdraw(db: Session, user: User, app_id: str) -> None:
    a = db.get(Application, app_id)
    if not a or a.creator_id != _creator(user).id:
        raise AppError("APPLICATION_NOT_FOUND", "Application not found", 404)
    if a.status != ApplicationStatus.PENDING:
        raise AppError("INVALID_STATE", "Only pending applications can be withdrawn", 409)
    a.status = ApplicationStatus.WITHDRAWN
    db.commit()


# ---------- project lists ----------
def my_projects(db: Session, user: User) -> dict:
    if user.brand_profile:
        b = user.brand_profile
        items = []
        for p in db.scalars(select(Project).where(Project.brand_id == b.id).order_by(Project.created_at.desc())):
            pending = db.scalar(select(func.count()).select_from(Application).where(
                Application.project_id == p.id, Application.status == ApplicationStatus.PENDING))
            items.append({**ProjectOut.model_validate(p).model_dump(mode="json"), "pending_applications": pending})
        return {"role": "BRAND", "items": items}
    c = _creator(user)
    rows = db.scalars(select(Project).join(Contract, Contract.project_id == Project.id)
                      .where(Contract.creator_id == c.id).order_by(Project.updated_at.desc()))
    return {"role": "CREATOR", "items": [ProjectOut.model_validate(p).model_dump(mode="json") for p in rows]}


# ---------- workspace ----------
def _role_in(db: Session, user: User, project: Project, contract: Contract | None) -> str:
    if user.brand_profile and user.brand_profile.id == project.brand_id:
        return "BRAND"
    if contract and user.creator_profile and user.creator_profile.id == contract.creator_id:
        return "CREATOR"
    raise AppError("FORBIDDEN", "You are not part of this project", 403)


def workspace(db: Session, user: User, project_id: str) -> dict:
    p = _project(db, project_id)
    c = _contract(db, p.id)
    role = _role_in(db, user, p, c)
    brand = db.get(BrandProfile, p.brand_id)
    creator = db.get(CreatorProfile, c.creator_id) if c else None
    deliverables = db.scalars(select(Deliverable).where(Deliverable.project_id == p.id).order_by(Deliverable.version.desc()))
    revisions = db.scalars(select(Revision).where(Revision.project_id == p.id).order_by(Revision.created_at.desc()))
    return {
        "role": role,
        "project": ProjectOut.model_validate(p).model_dump(mode="json"),
        "brand": {"id": brand.id, "company_name": brand.company_name},
        "creator": creator and {"id": creator.id, "display_name": creator.display_name, "avatar": creator.avatar},
        "contract": c and {"agreed_price": c.agreed_price, "platform_fee": c.platform_fee,
                           "creator_amount": c.creator_amount, "status": c.status.value},
        "deliverables": [{"id": d.id, "file_url": d.file_url, "kind": d.kind.value, "note": d.note, "version": d.version,
                          "status": d.status, "created_at": d.created_at.isoformat(), "file": file_info(db, d.file_id)} for d in deliverables],
        "revisions": [{"id": r.id, "description": r.description, "status": r.status,
                       "created_at": r.created_at.isoformat()} for r in revisions],
    }


def _hired_creator_project(db: Session, user: User, project_id: str) -> tuple[Project, Contract]:
    p = _project(db, project_id)
    c = _contract(db, p.id)
    if not c or c.creator_id != _creator(user).id:
        raise AppError("FORBIDDEN", "You are not hired on this project", 403)
    return p, c


# ---------- deliverables / revisions ----------
def submit_deliverable(db: Session, user: User, data: DeliverableIn) -> Deliverable:
    p, c = _hired_creator_project(db, user, data.project_id)
    if data.file_id:
        require_file(db, user, data.file_id, "DELIVERABLE", p.id)
    to = S.DRAFT_SUBMITTED if data.kind == DeliverableKind.DRAFT else S.FINAL_SUBMITTED
    _move(p, to, {S.IN_PROGRESS, S.REVISION_REQUESTED, S.DRAFT_SUBMITTED})
    version = (db.scalar(select(func.max(Deliverable.version)).where(Deliverable.project_id == p.id)) or 0) + 1
    d = Deliverable(project_id=p.id, creator_id=c.creator_id, file_url=str(data.file_url) if data.file_url else "", file_id=data.file_id,
                    kind=data.kind, note=data.note, version=version)
    db.add(d)
    for r in db.scalars(select(Revision).where(Revision.project_id == p.id, Revision.status == "OPEN")):
        r.status = "RESOLVED"
    notify(db, _brand_user_id(db, p.brand_id), "DELIVERABLE_UPLOADED", "New deliverable", f"A {data.kind.value.lower()} was submitted for {p.title}", f"/projects/{p.id}/workspace")
    db.commit()
    db.refresh(d)
    return d


def request_revision(db: Session, user: User, data: RevisionIn) -> Revision:
    p = owned_project(db, user, data.project_id)
    _move(p, S.REVISION_REQUESTED, {S.DRAFT_SUBMITTED, S.FINAL_SUBMITTED})
    r = Revision(project_id=p.id, requested_by=user.id, description=data.description)
    db.add(r)
    notify(db, _creator_user_id(db, _contract(db, p.id).creator_id), "REVISION_REQUESTED", "Revision requested", f"The brand asked for changes on {p.title}", f"/projects/{p.id}/workspace")
    db.commit()
    db.refresh(r)
    return r


def approve(db: Session, user: User, project_id: str) -> Project:
    p = owned_project(db, user, project_id)
    _move(p, S.APPROVED, {S.FINAL_SUBMITTED})
    latest = db.scalar(select(Deliverable).where(Deliverable.project_id == p.id, Deliverable.kind == DeliverableKind.FINAL)
                       .order_by(Deliverable.version.desc()))
    if latest:
        latest.status = "APPROVED"
    notify(db, _creator_user_id(db, _contract(db, p.id).creator_id), "PROJECT_APPROVED", "Final files approved", f"{p.title} was approved", f"/projects/{p.id}/workspace")
    db.commit()
    return p


def complete(db: Session, user: User, project_id: str) -> Project:
    p = owned_project(db, user, project_id)
    pay = payment_for_project(db, p.id)
    if p.status == S.APPROVED and (not pay or pay.status != PaymentStatus.HELD):
        raise AppError("PAYMENT_REQUIRED", "Fund the project before completing it so the creator can be paid", 409)
    _move(p, S.COMPLETED, {S.APPROVED})
    payment_service.release_creator_payment(db, pay)
    c = _contract(db, p.id)
    c.status = c.status.COMPLETED
    creator = db.get(CreatorProfile, c.creator_id)
    creator.completed_projects += 1
    notify(db, creator.user_id, "PAYMENT_RELEASED", "Payment released", f"{pay.amount - pay.platform_fee:g} {pay.currency} for {p.title} is in your balance", "/dashboard/payments")
    notify(db, creator.user_id, "PROJECT_COMPLETED", "Project completed", f"{p.title} is complete. You can now leave a review.", f"/projects/{p.id}/workspace")
    db.commit()
    return p


def cancel(db: Session, user: User, project_id: str) -> Project:
    p = owned_project(db, user, project_id)
    _move(p, S.CANCELLED, {S.OPEN, S.IN_PROGRESS, S.DRAFT_SUBMITTED, S.REVISION_REQUESTED, S.FINAL_SUBMITTED})
    for a in db.scalars(select(Application).where(Application.project_id == p.id, Application.status == ApplicationStatus.PENDING)):
        a.status = ApplicationStatus.REJECTED
    c = _contract(db, p.id)
    if c:
        c.status = c.status.CANCELLED
    pay = payment_for_project(db, p.id)
    if pay and pay.status == PaymentStatus.HELD:
        payment_service.refund_payment(db, pay)
    elif pay and pay.status == PaymentStatus.PENDING:
        payment_service.cancel_unfunded(db, pay)
    db.commit()
    return p
