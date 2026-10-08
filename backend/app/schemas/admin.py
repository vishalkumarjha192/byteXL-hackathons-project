from typing import Literal

from pydantic import BaseModel, Field


class SuspendIn(BaseModel):
    suspended: bool


class VerifyIn(BaseModel):
    verified: bool


class FeatureIn(BaseModel):
    featured: bool


class ResolveIn(BaseModel):
    action: Literal["REMOVE_CONTENT", "RESOLVE", "DISMISS"]
    note: str | None = Field(None, max_length=500)


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class ReportIn(BaseModel):
    target_type: Literal["CREATOR", "PROJECT", "REVIEW", "PORTFOLIO"]
    target_id: str
    reason: Literal["SPAM", "INAPPROPRIATE", "FRAUD", "OTHER"]
    details: str | None = Field(None, max_length=1000)
