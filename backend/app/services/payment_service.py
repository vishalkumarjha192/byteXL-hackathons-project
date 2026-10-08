from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contract, CreatorProfile, Payment, PaymentStatus, Payout, Project, User
from app.schemas.payments import WithdrawIn
from app.services.notification_service import notify
from app.services.payment_providers import PaymentProvider, get_provider
from app.utils.responses import AppError

S = PaymentStatus


class PaymentService:
    """Holds the payment rules. Money movement is delegated to a PaymentProvider."""

    def __init__(self, provider_factory=get_provider):
        self._provider_factory = provider_factory

    @property
    def provider(self) -> PaymentProvider:
        return self._provider_factory()

    @staticmethod
    def _require(payment: Payment, allowed: set[PaymentStatus]) -> None:
        if payment.status not in allowed:
            raise AppError("INVALID_PAYMENT_STATE", f"This payment is {payment.status.value.lower()}", 409)

    def create_payment(self, db: Session, project: Project, contract: Contract, payer_id: str, recipient_id: str) -> Payment:
        prov = self.provider
        payment = Payment(
            project_id=project.id, payer_id=payer_id, recipient_id=recipient_id, amount=contract.agreed_price,
            platform_fee=contract.platform_fee, currency=project.currency, provider=prov.name,
            provider_payment_id=prov.create_payment(contract.agreed_price, project.currency, project.id),
        )
        db.add(payment)
        return payment

    def capture_payment(self, db: Session, payment: Payment) -> Payment:
        self._require(payment, {S.PENDING})
        self.provider.capture_payment(payment.provider_payment_id)
        payment.status = S.HELD
        return payment

    def refund_payment(self, db: Session, payment: Payment) -> Payment:
        self._require(payment, {S.HELD})
        self.provider.refund_payment(payment.provider_payment_id, payment.amount)
        payment.status = S.REFUNDED
        return payment

    def release_creator_payment(self, db: Session, payment: Payment) -> Payment:
        self._require(payment, {S.HELD})
        self.provider.transfer_to_creator(payment.provider_payment_id, payment.amount - payment.platform_fee, payment.currency)
        payment.status = S.RELEASED
        payment.released_at = datetime.now(timezone.utc)
        return payment

    def cancel_unfunded(self, db: Session, payment: Payment) -> Payment:
        self._require(payment, {S.PENDING})
        payment.status = S.CANCELLED
        return payment


payment_service = PaymentService()


def for_project(db: Session, project_id: str) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.project_id == project_id))


def fund(db: Session, user: User, project_id: str) -> Payment:
    p = db.get(Project, project_id)
    if not p:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    if not user.brand_profile or p.brand_id != user.brand_profile.id:
        raise AppError("FORBIDDEN", "This project belongs to another brand", 403)
    pay = for_project(db, p.id)
    if not pay:
        raise AppError("PAYMENT_NOT_FOUND", "Hire a creator before funding the project", 404)
    payment_service.capture_payment(db, pay)
    notify(db, pay.recipient_id, "PROJECT_FUNDED", "Project funded", f"The payment for {p.title} is secured. You can work with confidence.", f"/projects/{p.id}/workspace")
    db.commit()
    return pay


def workspace_payment(db: Session, project_id: str) -> dict | None:
    pay = for_project(db, project_id)
    if not pay:
        return None
    return {"status": pay.status.value, "amount": pay.amount, "platform_fee": pay.platform_fee,
            "creator_amount": round(pay.amount - pay.platform_fee, 2), "currency": pay.currency}


def _balance(db: Session, user_id: str, currency: str) -> float:
    earned = sum(p.amount - p.platform_fee for p in db.scalars(select(Payment).where(
        Payment.recipient_id == user_id, Payment.currency == currency, Payment.status == S.RELEASED)))
    paid = sum(o.amount for o in db.scalars(select(Payout).where(Payout.user_id == user_id, Payout.currency == currency)))
    return round(earned - paid, 2)


def mine(db: Session, user: User) -> dict:
    is_brand = bool(user.brand_profile)
    col = Payment.payer_id if is_brand else Payment.recipient_id
    rows = list(db.scalars(select(Payment).where(col == user.id).order_by(Payment.created_at.desc())))
    titles = {p.id: p.title for p in db.scalars(select(Project).where(Project.id.in_([r.project_id for r in rows])))} if rows else {}
    items = [{"id": r.id, "project_id": r.project_id, "project_title": titles.get(r.project_id, ""), "amount": r.amount,
              "platform_fee": r.platform_fee, "creator_amount": round(r.amount - r.platform_fee, 2), "currency": r.currency,
              "status": r.status.value, "created_at": r.created_at.isoformat(),
              "released_at": r.released_at.isoformat() if r.released_at else None} for r in rows]

    summary: dict[str, dict] = {}
    for r in rows:
        s = summary.setdefault(r.currency, {"currency": r.currency, "spent": 0.0, "in_escrow": 0.0, "earned": 0.0, "withdrawn": 0.0, "available": 0.0})
        share = r.amount - r.platform_fee
        if is_brand and r.status in (S.HELD, S.RELEASED):
            s["spent"] += r.amount
        if r.status == S.HELD:
            s["in_escrow"] += r.amount if is_brand else share
        if not is_brand and r.status == S.RELEASED:
            s["earned"] += share
    payouts = []
    if not is_brand:
        for o in db.scalars(select(Payout).where(Payout.user_id == user.id).order_by(Payout.created_at.desc())):
            s = summary.setdefault(o.currency, {"currency": o.currency, "spent": 0.0, "in_escrow": 0.0, "earned": 0.0, "withdrawn": 0.0, "available": 0.0})
            s["withdrawn"] += o.amount
            payouts.append({"id": o.id, "amount": o.amount, "currency": o.currency, "status": o.status, "created_at": o.created_at.isoformat()})
        for s in summary.values():
            s["available"] = round(s["earned"] - s["withdrawn"], 2)

    monthly: dict[tuple[str, str], float] = {}
    if not is_brand:
        for r in rows:
            if r.status == S.RELEASED and r.released_at:
                key = (r.released_at.strftime("%Y-%m"), r.currency)
                monthly[key] = monthly.get(key, 0.0) + (r.amount - r.platform_fee)
    return {
        "role": "BRAND" if is_brand else "CREATOR", "items": items, "payouts": payouts,
        "summary": [{k: (round(v, 2) if isinstance(v, float) else v) for k, v in s.items()} for s in summary.values()],
        "monthly": [{"month": m, "currency": c, "earned": round(v, 2)} for (m, c), v in sorted(monthly.items())],
    }


def withdraw(db: Session, user: User, data: WithdrawIn) -> dict:
    if not user.creator_profile:
        raise AppError("CREATOR_NOT_FOUND", "Creator profile not found", 404)
    cur = data.currency.upper()
    available = _balance(db, user.id, cur)
    if data.amount > available:
        raise AppError("INSUFFICIENT_BALANCE", f"You can withdraw up to {available:g} {cur}", 409)
    prov = payment_service.provider
    payout = Payout(user_id=user.id, amount=data.amount, currency=cur, provider=prov.name,
                    provider_payout_id=prov.payout(user.creator_profile.id, data.amount, cur))
    db.add(payout)
    db.commit()
    return {"id": payout.id, "amount": payout.amount, "currency": cur, "available": _balance(db, user.id, cur)}
