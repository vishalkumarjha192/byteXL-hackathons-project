from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Application, BrandProfile, Contract, CreatorProfile, Deliverable, Payment, PaymentStatus, Project, ProjectStatus, Report,
    ReportStatus, Role, User,
)
from app.models.marketplace import AITool, Language, Niche, Skill, creator_ai_tools, creator_languages, creator_niches, creator_skills
from app.services import audit_service, report_service
from app.services.notification_service import notify
from app.utils.responses import AppError

ACTIVE = [ProjectStatus.IN_PROGRESS, ProjectStatus.DRAFT_SUBMITTED, ProjectStatus.REVISION_REQUESTED, ProjectStatus.FINAL_SUBMITTED, ProjectStatus.APPROVED]


def _count(db: Session, q) -> int:
    return db.scalar(select(func.count()).select_from(q.subquery())) or 0


def _page(db: Session, q, order, page: int, size: int, build) -> dict:
    total = _count(db, q)
    rows = db.scalars(q.order_by(order).offset((page - 1) * size).limit(size))
    return {"items": [build(r) for r in rows], "page": page, "page_size": size, "total": total}


def _iso(d):
    return d.isoformat() if d else None


def _name(db: Session, user_id: str) -> str:
    u = db.get(User, user_id)
    if not u:
        return "(deleted)"
    return u.brand_profile.company_name if u.brand_profile else u.creator_profile.display_name if u.creator_profile else u.email


# ---------- statistics ----------
def stats(db: Session) -> dict:
    by_cur = lambda col, *where: [{"currency": c, "amount": round(float(a or 0), 2)} for c, a in
                                  db.execute(select(Payment.currency, func.sum(col)).where(*where).group_by(Payment.currency))]
    return {
        "total_users": _count(db, select(User)), "total_creators": _count(db, select(CreatorProfile)), "total_brands": _count(db, select(BrandProfile)),
        "suspended_users": _count(db, select(User).where(User.is_active.is_(False))),
        "open_projects": _count(db, select(Project).where(Project.status == ProjectStatus.OPEN)),
        "active_projects": _count(db, select(Project).where(Project.status.in_(ACTIVE))),
        "completed_projects": _count(db, select(Project).where(Project.status == ProjectStatus.COMPLETED)),
        "pending_verification": _count(db, select(CreatorProfile).where(CreatorProfile.verification_requested.is_(True), CreatorProfile.verified.is_(False))),
        "open_reports": _count(db, select(Report).where(Report.status == ReportStatus.OPEN)),
        "gross_volume": by_cur(Payment.amount, Payment.status.in_([PaymentStatus.HELD, PaymentStatus.RELEASED])),
        "platform_revenue": by_cur(Payment.platform_fee, Payment.status == PaymentStatus.RELEASED),
    }


# ---------- tables ----------
def users(db: Session, q, role, active, page, size) -> dict:
    stmt = select(User)
    if q:
        stmt = stmt.where(User.email.ilike(f"%{q}%"))
    if role:
        stmt = stmt.where(User.role == Role(role))
    if active is not None:
        stmt = stmt.where(User.is_active.is_(active))
    return _page(db, stmt, User.created_at.desc(), page, size, lambda u: {
        "id": u.id, "email": u.email, "role": u.role.value, "name": _name(db, u.id), "is_active": u.is_active,
        "is_verified": u.is_verified, "created_at": _iso(u.created_at)})


def creators(db: Session, q, verified, pending, featured, page, size) -> dict:
    stmt = select(CreatorProfile).join(User, User.id == CreatorProfile.user_id)
    if q:
        stmt = stmt.where(CreatorProfile.display_name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    if verified is not None:
        stmt = stmt.where(CreatorProfile.verified.is_(verified))
    if pending:
        stmt = stmt.where(CreatorProfile.verification_requested.is_(True), CreatorProfile.verified.is_(False))
    if featured is not None:
        stmt = stmt.where(CreatorProfile.featured.is_(featured))
    return _page(db, stmt, User.created_at.desc(), page, size, lambda c: {
        "id": c.id, "user_id": c.user_id, "display_name": c.display_name, "email": c.user.email, "verified": c.verified,
        "verification_requested": c.verification_requested, "featured": c.featured, "is_active": c.user.is_active, "rating": c.rating,
        "review_count": c.review_count, "completed_projects": c.completed_projects})


def brands(db: Session, q, page, size) -> dict:
    stmt = select(BrandProfile).join(User, User.id == BrandProfile.user_id)
    if q:
        stmt = stmt.where(BrandProfile.company_name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    return _page(db, stmt, User.created_at.desc(), page, size, lambda b: {
        "id": b.id, "user_id": b.user_id, "company_name": b.company_name, "email": b.user.email, "industry": b.industry,
        "is_active": b.user.is_active, "projects": _count(db, select(Project).where(Project.brand_id == b.id))})


def projects(db: Session, q, status, page, size) -> dict:
    stmt = select(Project)
    if q:
        stmt = stmt.where(Project.title.ilike(f"%{q}%"))
    if status:
        stmt = stmt.where(Project.status == ProjectStatus(status))
    return _page(db, stmt, Project.created_at.desc(), page, size, lambda p: {
        "id": p.id, "title": p.title, "brand": db.get(BrandProfile, p.brand_id).company_name, "status": p.status.value,
        "budget": p.budget, "currency": p.currency, "category": p.category, "created_at": _iso(p.created_at)})


def payments(db: Session, status, page, size) -> dict:
    stmt = select(Payment)
    if status:
        stmt = stmt.where(Payment.status == PaymentStatus(status))
    return _page(db, stmt, Payment.created_at.desc(), page, size, lambda p: {
        "id": p.id, "project_id": p.project_id, "project": db.get(Project, p.project_id).title, "payer": _name(db, p.payer_id),
        "recipient": _name(db, p.recipient_id), "amount": p.amount, "platform_fee": p.platform_fee, "currency": p.currency,
        "status": p.status.value, "created_at": _iso(p.created_at)})


def reports(db: Session, status, page, size) -> dict:
    stmt = select(Report)
    if status:
        stmt = stmt.where(Report.status == ReportStatus(status))
    return _page(db, stmt, Report.created_at.desc(), page, size, lambda r: {
        "id": r.id, "target_type": r.target_type, "target_id": r.target_id, "target": report_service.target_label(db, r.target_type, r.target_id),
        "reason": r.reason, "details": r.details, "status": r.status.value, "reporter": db.get(User, r.reporter_id).email,
        "resolution_note": r.resolution_note, "created_at": _iso(r.created_at)})


# ---------- detail views (flat key/value) ----------
def project_detail(db: Session, project_id: str) -> dict:
    p = db.get(Project, project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    c = db.scalar(select(Contract).where(Contract.project_id == p.id))
    pay = db.scalar(select(Payment).where(Payment.project_id == p.id))
    return {
        "title": p.title, "status": p.status.value, "brand": db.get(BrandProfile, p.brand_id).company_name, "category": p.category,
        "content_type": p.content_type, "budget": f"{p.budget:g} {p.currency}", "deadline": _iso(p.deadline), "language": p.language,
        "platform": p.platform, "applications": _count(db, select(Application).where(Application.project_id == p.id)),
        "creator": db.get(CreatorProfile, c.creator_id).display_name if c else None,
        "agreed_price": c and c.agreed_price, "payment_status": pay and pay.status.value,
        "deliverables": _count(db, select(Deliverable).where(Deliverable.project_id == p.id)), "created_at": _iso(p.created_at),
        "description": p.description,
    }


def payment_detail(db: Session, payment_id: str) -> dict:
    p = db.get(Payment, payment_id)
    if not p:
        raise AppError("PAYMENT_NOT_FOUND", "Payment not found", 404)
    return {
        "project": db.get(Project, p.project_id).title, "status": p.status.value, "payer": _name(db, p.payer_id), "recipient": _name(db, p.recipient_id),
        "amount": f"{p.amount:g} {p.currency}", "platform_fee": f"{p.platform_fee:g} {p.currency}",
        "creator_receives": f"{p.amount - p.platform_fee:g} {p.currency}", "provider": p.provider, "provider_payment_id": p.provider_payment_id,
        "created_at": _iso(p.created_at), "released_at": _iso(p.released_at),
    }


# ---------- actions ----------
def set_suspended(db: Session, admin: User, user_id: str, suspended: bool) -> User:
    u = db.get(User, user_id)
    if not u:
        raise AppError("USER_NOT_FOUND", "User not found", 404)
    if u.id == admin.id or u.role == Role.ADMIN:
        raise AppError("FORBIDDEN", "Admin accounts cannot be suspended", 403)
    u.is_active = not suspended
    audit_service.record(db, admin, "SUSPEND_USER" if suspended else "REINSTATE_USER", "USER", u.id, f"{'Suspended' if suspended else 'Reinstated'} {u.email}")
    db.commit()
    return u


def _creator(db: Session, creator_id: str) -> CreatorProfile:
    c = db.get(CreatorProfile, creator_id)
    if not c:
        raise AppError("CREATOR_NOT_FOUND", "Creator not found", 404)
    return c


def set_verified(db: Session, admin: User, creator_id: str, verified: bool) -> CreatorProfile:
    c = _creator(db, creator_id)
    c.verified, c.verification_requested = verified, False
    audit_service.record(db, admin, "VERIFY_CREATOR" if verified else "UNVERIFY_CREATOR", "CREATOR", c.id, f"{'Verified' if verified else 'Removed verification from'} {c.display_name}")
    if verified:
        notify(db, c.user_id, "CREATOR_VERIFIED", "You are verified", "Your profile now shows the verified badge.", "/dashboard/creator/profile")
    db.commit()
    return c


def set_featured(db: Session, admin: User, creator_id: str, featured: bool) -> CreatorProfile:
    c = _creator(db, creator_id)
    c.featured = featured
    audit_service.record(db, admin, "FEATURE_CREATOR" if featured else "UNFEATURE_CREATOR", "CREATOR", c.id, f"{'Featured' if featured else 'Unfeatured'} {c.display_name}")
    db.commit()
    return c


# ---------- categories ----------
KINDS = {
    "skills": (Skill, creator_skills, "skill_id"), "niches": (Niche, creator_niches, "niche_id"),
    "languages": (Language, creator_languages, "language_id"), "ai_tools": (AITool, creator_ai_tools, "ai_tool_id"),
}


def _kind(kind: str):
    if kind not in KINDS:
        raise AppError("UNKNOWN_CATEGORY_TYPE", f"Unknown category type. Use one of: {', '.join(KINDS)}", 404)
    return KINDS[kind]


def _usage(db: Session, kind: str, row) -> int:
    model, link, col = KINDS[kind]
    n = _count(db, select(link).where(link.c[col] == row.id))
    return n + (_count(db, select(Project).where(Project.category == row.name)) if kind == "skills" else 0)


def categories(db: Session) -> dict:
    return {k: [{"id": r.id, "name": r.name, "usage": _usage(db, k, r)} for r in db.scalars(select(m).order_by(m.id))] for k, (m, _, _) in KINDS.items()}


def add_category(db: Session, admin: User, kind: str, name: str):
    model, _, _ = _kind(kind)
    name = name.strip()
    if db.scalar(select(model).where(func.lower(model.name) == name.lower())):
        raise AppError("CATEGORY_EXISTS", f"{name} already exists", 409)
    row = model(name=name)
    db.add(row)
    db.flush()
    audit_service.record(db, admin, "ADD_CATEGORY", kind.upper(), str(row.id), f"Added {kind} category {name}")
    db.commit()
    return row


def delete_category(db: Session, admin: User, kind: str, category_id: int) -> None:
    model, _, _ = _kind(kind)
    row = db.get(model, category_id)
    if not row:
        raise AppError("CATEGORY_NOT_FOUND", "Category not found", 404)
    n = _usage(db, kind, row)
    if n:
        raise AppError("CATEGORY_IN_USE", f"{row.name} is used by {n} creators or projects, so it cannot be deleted", 409)
    audit_service.record(db, admin, "DELETE_CATEGORY", kind.upper(), str(row.id), f"Deleted {kind} category {row.name}")
    db.delete(row)
    db.commit()
