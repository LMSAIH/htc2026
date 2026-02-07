import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.curation import CurationActionType


class CurationCreate(BaseModel):
    contribution_id: uuid.UUID
    action: CurationActionType
    reviewer: str = Field(default="system", max_length=255)
    notes: str | None = None


class CurationResponse(BaseModel):
    id: uuid.UUID
    contribution_id: uuid.UUID
    action: CurationActionType
    reviewer: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CurationListResponse(BaseModel):
    actions: list[CurationResponse]
    total: int
