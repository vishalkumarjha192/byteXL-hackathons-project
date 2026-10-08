import enum
from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, String, Table, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import _uuid


def _link(name: str, other: str, col: str) -> Table:
    return Table(
        name,
        Base.metadata,
        Column("creator_id", ForeignKey("creator_profiles.id"), primary_key=True),
        Column(col, ForeignKey(f"{other}.id"), primary_key=True),
    )


creator_skills = _link("creator_skills", "skills", "skill_id")
creator_niches = _link("creator_niches", "niches", "niche_id")
creator_languages = _link("creator_languages", "languages", "language_id")
creator_ai_tools = _link("creator_ai_tools", "ai_tools", "ai_tool_id")


class _Named:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Skill(_Named, Base):
    __tablename__ = "skills"


class Niche(_Named, Base):
    __tablename__ = "niches"


class Language(_Named, Base):
    __tablename__ = "languages"


class AITool(_Named, Base):
    __tablename__ = "ai_tools"


class MediaType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    LINK = "LINK"


class Portfolio(Base):
    __tablename__ = "portfolios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    creator_id: Mapped[str] = mapped_column(ForeignKey("creator_profiles.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str] = mapped_column(String(500))
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProjectStatus(str, enum.Enum):
    OPEN = "OPEN"  # published, accepting applications
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    DRAFT_SUBMITTED = "DRAFT_SUBMITTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    FINAL_SUBMITTED = "FINAL_SUBMITTED"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    brand_id: Mapped[str] = mapped_column(ForeignKey("brand_profiles.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), index=True)
    content_type: Mapped[str] = mapped_column(String(80))
    budget: Mapped[float]
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    deadline: Mapped[date | None] = mapped_column(Date)
    target_audience: Mapped[str | None] = mapped_column(String(200))
    language: Mapped[str | None] = mapped_column(String(50), index=True)
    platform: Mapped[str | None] = mapped_column(String(50))
    video_duration: Mapped[int | None] = mapped_column(Integer)  # seconds
    style: Mapped[str | None] = mapped_column(String(200))
    deliverables: Mapped[str | None] = mapped_column(Text)
    revisions: Mapped[int] = mapped_column(Integer, default=2, server_default=text("2"))
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.OPEN, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
