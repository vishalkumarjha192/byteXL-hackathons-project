from pydantic import BaseModel, Field


class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
