from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Role, User
from app.schemas.ai import BriefIn
from app.schemas.brand import BrandOut, BrandUpdate
from app.services import ai_service, brand_service
from app.utils.ratelimit import RateLimiter
from app.utils.responses import ok

router = APIRouter(prefix="/ai", tags=["ai"])
brands = APIRouter(prefix="/brands", tags=["brands"])
brief_limiter = RateLimiter(limit=10, window_seconds=60)


def _limited_brand(user: User = Depends(require_roles(Role.BRAND))) -> User:
    brief_limiter.check(user.id)
    return user


@router.post("/brief")
def brief(body: BriefIn, _: User = Depends(_limited_brand)):
    return ok(ai_service.generate_brief(body.prompt))


@router.get("/match/{project_id}")
def match(project_id: str, limit: int = Query(10, ge=1, le=30), user: User = Depends(require_roles(Role.BRAND)), db: Session = Depends(get_db)):
    return ok(ai_service.match_creators(db, user, project_id, limit))


@router.get("/recommendations/projects")
def recommended(limit: int = Query(10, ge=1, le=30), user: User = Depends(require_roles(Role.CREATOR)), db: Session = Depends(get_db)):
    return ok(ai_service.recommended_projects(db, user, limit))


@brands.get("/me")
def my_brand(user: User = Depends(require_roles(Role.BRAND))):
    return ok(BrandOut.model_validate(brand_service.my_profile(user)).model_dump())


@brands.patch("/me")
def update_brand(body: BrandUpdate, user: User = Depends(require_roles(Role.BRAND)), db: Session = Depends(get_db)):
    return ok(BrandOut.model_validate(brand_service.update(db, user, body)).model_dump(), "Company profile updated")
