from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.seed_lookups import DATA
from app.models.marketplace import Niche

INDUSTRIES = DATA[Niche]


class BrandUpdate(BaseModel):
    company_name: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = Field(None, max_length=2000)
    website: str | None = Field(None, max_length=300)
    industry: str | None = None
    location: str | None = Field(None, max_length=100)
    logo: str | None = Field(None, max_length=500)

    @field_validator("industry")
    @classmethod
    def known_industry(cls, v):
        if v and v not in INDUSTRIES:
            raise ValueError(f"Choose one of: {', '.join(INDUSTRIES)}")
        return v


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_name: str
    logo: str | None
    description: str | None
    website: str | None
    industry: str | None
    location: str | None
