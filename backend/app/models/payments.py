import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import _uuid


def _now():
    return datetime.now(timezone.utc)


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"      # created at hire, waiting for the brand to fund it
    HELD = "HELD"            # captured and held until the project is completed
    RELEASED = "RELEASED"    # released to the creator's balance
    REFUNDED = "REFUNDED"    # returned to the brand
    CANCELLED = "CANCELLED"  # never funded and the project was cancelled


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True)
    payer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float]
    platform_fee: Mapped[float]
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    provider: Mapped[str] = mapped_column(String(30))
    provider_payment_id: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payout(Base):
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float]
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(20), default="PAID")
    provider: Mapped[str] = mapped_column(String(30))
    provider_payout_id: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
