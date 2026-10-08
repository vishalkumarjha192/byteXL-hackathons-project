from typing import Literal

from pydantic import BaseModel, Field


class BriefIn(BaseModel):
    prompt: str = Field(min_length=10, max_length=500)


class Scene(BaseModel):
    time: str
    visual: str
    voiceover: str


class Suggested(BaseModel):
    category: str
    content_type: str
    platform: str
    language: str = "English"


class Brief(BaseModel):
    title: str
    hook: str
    script: str
    scenes: list[Scene]
    cta: str
    deliverables: list[str]
    suggested: Suggested
    source: Literal["template", "ai"] = "template"
