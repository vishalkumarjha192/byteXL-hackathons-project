from pydantic import BaseModel, Field, HttpUrl, field_validator


class MessageIn(BaseModel):
    project_id: str
    message: str = Field(min_length=1, max_length=2000)
    attachment_url: HttpUrl | None = None
    attachment_file_id: str | None = None

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()


class ReviewIn(BaseModel):
    project_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=2000)
