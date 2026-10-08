from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.models.workflow import DeliverableKind


class ApplyIn(BaseModel):
    project_id: str
    proposal: str = Field(min_length=20, max_length=3000)
    proposed_price: float = Field(gt=0)
    delivery_days: int = Field(ge=1, le=365)


class DeliverableIn(BaseModel):
    project_id: str
    file_url: HttpUrl | None = None
    file_id: str | None = None
    kind: DeliverableKind
    note: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def one_source(self):
        if bool(self.file_url) == bool(self.file_id):
            raise ValueError("Provide either a link or an uploaded file")
        return self


class RevisionIn(BaseModel):
    project_id: str
    description: str = Field(min_length=5, max_length=2000)
