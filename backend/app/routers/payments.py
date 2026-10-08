from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Role, User
from app.schemas.payments import WithdrawIn
from app.services import payment_service as svc
from app.utils.responses import ok

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/mine")
def mine(user: User = Depends(require_roles(Role.BRAND, Role.CREATOR)), db: Session = Depends(get_db)):
    return ok(svc.mine(db, user))


@router.post("/project/{project_id}/fund")
def fund(project_id: str, user: User = Depends(require_roles(Role.BRAND)), db: Session = Depends(get_db)):
    pay = svc.fund(db, user, project_id)
    return ok(svc.workspace_payment(db, pay.project_id), "Project funded")


@router.post("/withdraw", status_code=201)
def withdraw(body: WithdrawIn, user: User = Depends(require_roles(Role.CREATOR)), db: Session = Depends(get_db)):
    return ok(svc.withdraw(db, user, body), "Withdrawal sent")
