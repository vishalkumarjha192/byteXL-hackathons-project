from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user, require_roles
from app.models import Role, User
from app.schemas.marketplace import ProjectOut
from app.schemas.workflow import ApplyIn, DeliverableIn, RevisionIn
from app.services import payment_service, review_service, workflow_service as svc
from app.utils.responses import ok

applications = APIRouter(prefix="/applications", tags=["applications"])
deliverables = APIRouter(prefix="/deliverables", tags=["deliverables"])
revisions = APIRouter(prefix="/revisions", tags=["revisions"])
workflow = APIRouter(prefix="/projects", tags=["project workflow"])

brand = require_roles(Role.BRAND)
creator = require_roles(Role.CREATOR)


@applications.post("", status_code=201)
def apply(body: ApplyIn, user: User = Depends(creator), db: Session = Depends(get_db)):
    a = svc.apply(db, user, body)
    return ok({"id": a.id, "status": a.status.value}, "Application sent")


@applications.get("/mine")
def mine(user: User = Depends(creator), db: Session = Depends(get_db)):
    return ok(svc.my_applications(db, user))


@applications.get("/project/{project_id}")
def for_project(project_id: str, user: User = Depends(brand), db: Session = Depends(get_db)):
    return ok(svc.project_applications(db, user, project_id))


@applications.post("/{app_id}/accept")
def accept(app_id: str, user: User = Depends(brand), db: Session = Depends(get_db)):
    return ok(svc.decide(db, user, app_id, True), "Creator hired")


@applications.post("/{app_id}/reject")
def reject(app_id: str, user: User = Depends(brand), db: Session = Depends(get_db)):
    return ok(svc.decide(db, user, app_id, False), "Application rejected")


@applications.post("/{app_id}/withdraw")
def withdraw(app_id: str, user: User = Depends(creator), db: Session = Depends(get_db)):
    svc.withdraw(db, user, app_id)
    return ok(None, "Application withdrawn")


@deliverables.post("", status_code=201)
def submit(body: DeliverableIn, user: User = Depends(creator), db: Session = Depends(get_db)):
    d = svc.submit_deliverable(db, user, body)
    return ok({"id": d.id, "version": d.version}, "Deliverable submitted")


@revisions.post("", status_code=201)
def request_revision(body: RevisionIn, user: User = Depends(brand), db: Session = Depends(get_db)):
    r = svc.request_revision(db, user, body)
    return ok({"id": r.id}, "Revision requested")


@workflow.get("/mine")
def my_projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ok(svc.my_projects(db, user))


@workflow.get("/{project_id}/workspace")
def workspace(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = svc.workspace(db, user, project_id)
    data.update(review_service.workspace_reviews(db, user, data))
    data["payment"] = payment_service.workspace_payment(db, project_id)
    return ok(data)


def _state(fn, message):
    def handler(project_id: str, user: User = Depends(brand), db: Session = Depends(get_db)):
        p = fn(db, user, project_id)
        return ok(ProjectOut.model_validate(p).model_dump(mode="json"), message)
    return handler


workflow.post("/{project_id}/approve")(_state(svc.approve, "Final files approved"))
workflow.post("/{project_id}/complete")(_state(svc.complete, "Project completed"))
workflow.post("/{project_id}/cancel")(_state(svc.cancel, "Project cancelled"))
