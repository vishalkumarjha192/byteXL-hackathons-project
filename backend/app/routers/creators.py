from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Portfolio, Role, User
from app.models.marketplace import AITool, Language, Niche, Skill
from app.repositories import creator_repo
from app.schemas.marketplace import CreatorOut, CreatorUpdate, Named, PortfolioIn, PortfolioOut
from app.services import creator_service
from app.utils.responses import ok

router = APIRouter(prefix="/creators", tags=["creators"])
creator_only = require_roles(Role.CREATOR)


@router.get("/lookups")
def lookups(db: Session = Depends(get_db)):
    out = {}
    for key, m in {"skills": Skill, "niches": Niche, "languages": Language, "ai_tools": AITool}.items():
        out[key] = [Named.model_validate(r).model_dump() for r in db.scalars(select(m).order_by(m.id))]
    return ok(out)


@router.get("")
def search(
    q: str | None = None,
    category: str | None = None,
    niche: str | None = None,
    language: str | None = None,
    ai_tool: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    min_rating: float | None = Query(None, ge=0, le=5),
    delivery_days: int | None = Query(None, ge=1),
    sort: str = Query("recommended", pattern="^(recommended|rating|price|newest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    filters = dict(q=q, category=category, niche=niche, language=language, ai_tool=ai_tool, min_price=min_price,
                   max_price=max_price, min_rating=min_rating, delivery_days=delivery_days, sort=sort)
    rows, total = creator_repo.search(db, filters, page, page_size)
    items = [CreatorOut.model_validate(r).model_dump() for r in rows]
    return ok({"items": items, "page": page, "page_size": page_size, "total": total})


def _mine(p) -> dict:
    return {**CreatorOut.model_validate(p).model_dump(), "verification_requested": p.verification_requested}


@router.get("/me")
def me(user: User = Depends(creator_only), db: Session = Depends(get_db)):
    return ok(_mine(creator_service.my_profile(db, user)))


@router.post("/me/verification-request")
def request_verification(user: User = Depends(creator_only), db: Session = Depends(get_db)):
    return ok(_mine(creator_service.request_verification(db, user)), "Verification requested")


@router.patch("/me")
def update_me(body: CreatorUpdate, user: User = Depends(creator_only), db: Session = Depends(get_db)):
    p = creator_service.update_profile(db, user, body)
    return ok(_mine(p), "Profile updated")


@router.get("/{creator_id}")
def detail(creator_id: str, db: Session = Depends(get_db)):
    p = creator_service.get_public(db, creator_id)
    return ok(CreatorOut.model_validate(p).model_dump())


@router.get("/{creator_id}/portfolio")
def portfolio(creator_id: str, db: Session = Depends(get_db)):
    p = creator_service.get_public(db, creator_id)
    rows = db.scalars(select(Portfolio).where(Portfolio.creator_id == p.id).order_by(Portfolio.created_at.desc()))
    return ok([PortfolioOut.model_validate(r).model_dump(mode="json") for r in rows])


@router.post("/me/portfolio", status_code=201)
def add_portfolio(body: PortfolioIn, user: User = Depends(creator_only), db: Session = Depends(get_db)):
    item = creator_service.add_portfolio(db, user, body)
    return ok(PortfolioOut.model_validate(item).model_dump(mode="json"), "Portfolio item added")


@router.delete("/me/portfolio/{item_id}")
def delete_portfolio(item_id: str, user: User = Depends(creator_only), db: Session = Depends(get_db)):
    creator_service.delete_portfolio(db, user, item_id)
    return ok(None, "Portfolio item deleted")
