from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, ApplicationStatus, BrandProfile, CreatorProfile, Portfolio, Project, ProjectStatus, Report, ReportStatus, Review, User
from app.schemas.admin import ReportIn
from app.services import audit_service
from app.services.notification_service import notify
from app.services.review_service import recompute_creator_rating
from app.utils.responses import AppError

MODEL = {"CREATOR": CreatorProfile, "PROJECT": Project, "REVIEW": Review, "PORTFOLIO": Portfolio}


def target_label(db: Session, target_type: str, target_id: str) -> str:
    t = db.get(MODEL[target_type], target_id)
    if not t:
        return "(removed)"
    if target_type == "CREATOR":
        return t.display_name
    if target_type == "REVIEW":
        return f"{t.rating} stars: {t.comment[:60]}"
    return t.title


def create(db: Session, user: User, data: ReportIn) -> Report:
    if not db.get(MODEL[data.target_type], data.target_id):
        raise AppError("TARGET_NOT_FOUND", "The content you are reporting no longer exists", 404)
    if db.scalar(select(Report).where(Report.reporter_id == user.id, Report.target_type == data.target_type,
                                      Report.target_id == data.target_id, Report.status == ReportStatus.OPEN)):
        raise AppError("ALREADY_REPORTED", "You have already reported this and we are reviewing it", 409)
    r = Report(reporter_id=user.id, **data.model_dump())
    db.add(r)
    db.commit()
    return r


def remove_target(db: Session, rep: Report) -> None:
    if rep.target_type == "CREATOR":
        raise AppError("INVALID_ACTION", "Profiles cannot be removed here. Suspend the user instead.", 422)
    target = db.get(MODEL[rep.target_type], rep.target_id)
    if not target:
        raise AppError("TARGET_NOT_FOUND", "This content has already been removed", 404)
    if rep.target_type == "PROJECT":
        if target.status != ProjectStatus.OPEN:
            raise AppError("INVALID_STATE", "Only open projects can be removed. This one already has a hired creator.", 409)
        target.status = ProjectStatus.CANCELLED
        for a in db.scalars(select(Application).where(Application.project_id == target.id, Application.status == ApplicationStatus.PENDING)):
            a.status = ApplicationStatus.REJECTED
        notify(db, db.get(BrandProfile, target.brand_id).user_id, "CONTENT_REMOVED", "Project removed",
               f"Your project \"{target.title}\" was removed by our moderators.", "/dashboard/brand")
    elif rep.target_type == "REVIEW":
        creator = db.scalar(select(CreatorProfile).where(CreatorProfile.user_id == target.reviewee_id))
        db.delete(target)
        db.flush()
        if creator:
            recompute_creator_rating(db, creator)
    else:  # PORTFOLIO
        db.delete(target)


def resolve(db: Session, admin: User, report_id: str, action: str, note: str | None) -> Report:
    rep = db.get(Report, report_id)
    if not rep:
        raise AppError("REPORT_NOT_FOUND", "Report not found", 404)
    if rep.status != ReportStatus.OPEN:
        raise AppError("INVALID_STATE", "This report has already been handled", 409)
    if action == "REMOVE_CONTENT":
        remove_target(db, rep)
    rep.status = ReportStatus.DISMISSED if action == "DISMISS" else ReportStatus.RESOLVED
    rep.resolution_note, rep.resolved_by, rep.resolved_at = note, admin.id, datetime.now(timezone.utc)
    notify(db, rep.reporter_id, "REPORT_REVIEWED", "Your report was reviewed", "Thank you for helping keep Creatorly safe. Our team has reviewed your report.", None)
    audit_service.record(db, admin, f"REPORT_{action}", rep.target_type, rep.target_id, f"{action.replace('_', ' ').capitalize()}: {rep.target_type.lower()} report for {rep.reason.lower()}")
    db.commit()
    return rep
