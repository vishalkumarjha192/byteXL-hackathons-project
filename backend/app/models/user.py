import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    BRAND = "BRAND"
    CREATOR = "CREATOR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    brand_profile: Mapped["BrandProfile | None"] = relationship(back_populates="user", uselist=False)
    creator_profile: Mapped["CreatorProfile | None"] = relationship(back_populates="user", uselist=False)


class BrandProfile(Base):
    __tablename__ = "brand_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    company_name: Mapped[str] = mapped_column(String(200))
    logo: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(300))
    industry: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(100))
    user: Mapped[User] = relationship(back_populates="brand_profile")


class CreatorProfile(Base):
    __tablename__ = "creator_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String(150), index=True)
    avatar: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(100))
    hourly_rate: Mapped[float | None]
    starting_price: Mapped[float | None] = mapped_column(index=True)
    delivery_days: Mapped[int | None] = mapped_column(index=True)
    rating: Mapped[float] = mapped_column(default=0.0, index=True)
    review_count: Mapped[int] = mapped_column(default=0)
    completed_projects: Mapped[int] = mapped_column(default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), index=True)
    verification_requested: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    user: Mapped[User] = relationship(back_populates="creator_profile")


# Many-to-many tags on creators (tables live in marketplace.py)
CreatorProfile.skills = relationship("Skill", secondary="creator_skills", lazy="selectin")
CreatorProfile.niches = relationship("Niche", secondary="creator_niches", lazy="selectin")
CreatorProfile.languages = relationship("Language", secondary="creator_languages", lazy="selectin")
CreatorProfile.ai_tools = relationship("AITool", secondary="creator_ai_tools", lazy="selectin")
