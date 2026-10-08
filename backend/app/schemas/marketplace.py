from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.marketplace import MediaType


class Named(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class PortfolioIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    media_url: HttpUrl
    media_type: MediaType
    thumbnail_url: HttpUrl | None = None


class PortfolioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: str | None
    media_url: str
    media_type: MediaType
    thumbnail_url: str | None
    created_at: datetime


class CreatorUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=2, max_length=150)
    avatar: str | None = None
    bio: str | None = Field(None, max_length=2000)
    location: str | None = None
    hourly_rate: float | None = Field(None, ge=0)
    starting_price: float | None = Field(None, ge=0)
    delivery_days: int | None = Field(None, ge=1, le=365)
    skills: list[str] | None = None
    niches: list[str] | None = None
    languages: list[str] | None = None
    ai_tools: list[str] | None = None


class CreatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    display_name: str
    avatar: str | None
    bio: str | None
    location: str | None
    starting_price: float | None
    hourly_rate: float | None
    delivery_days: int | None
    rating: float
    review_count: int
    completed_projects: int
    verified: bool
    featured: bool
    skills: list[Named]
    niches: list[Named]
    languages: list[Named]
    ai_tools: list[Named]


class ProjectBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    category: str
    content_type: str
    budget: float = Field(gt=0)
    currency: str = Field("INR", min_length=3, max_length=3)
    deadline: date | None = None
    target_audience: str | None = None
    language: str | None = None
    platform: str | None = None
    video_duration: int | None = Field(None, ge=1, le=3600)
    style: str | None = Field(None, max_length=200)
    deliverables: str | None = Field(None, max_length=2000)
    revisions: int = Field(2, ge=0, le=20)


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    brand_id: str
    status: str
    created_at: datetime


class AssetIn(BaseModel):
    file_id: str
    file_type: Literal["PRODUCT_IMAGE", "PRODUCT_VIDEO", "LOGO", "GUIDELINES", "REFERENCE_VIDEO"]


class ProjectIn(ProjectBase):
    assets: list[AssetIn] = Field(default_factory=list, max_length=10)
