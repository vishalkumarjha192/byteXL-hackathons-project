import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import _uuid


def _now():
    return datetime.now(timezone.utc)


class ApplicationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("project_id", "creator_id", name="uq_application_project_creator"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("creator_profiles.id"), index=True)
    proposal: Mapped[str] = mapped_column(Text)
    proposed_price: Mapped[float]
    delivery_days: Mapped[int]
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.PENDING, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ContractStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True)
    brand_id: Mapped[str] = mapped_column(ForeignKey("brand_profiles.id"), index=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("creator_profiles.id"), index=True)
    agreed_price: Mapped[float]
    platform_fee: Mapped[float]
    creator_amount: Mapped[float]
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DeliverableKind(str, enum.Enum):
    DRAFT = "DRAFT"
    FINAL = "FINAL"


class Deliverable(Base):
    __tablename__ = "deliverables"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("creator_profiles.id"))
    file_url: Mapped[str] = mapped_column(String(500))  # empty when the deliverable is an uploaded file
    file_id: Mapped[str | None] = mapped_column(ForeignKey("uploaded_files.id"))
    kind: Mapped[DeliverableKind] = mapped_column(Enum(DeliverableKind))
    note: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int]
    status: Mapped[str] = mapped_column(String(20), default="SUBMITTED")  # SUBMITTED | APPROVED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN | RESOLVED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
