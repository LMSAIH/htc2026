import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.contribution import ContributionStatus


class ContributionCreate(BaseModel):
    mission_id: uuid.UUID
    filename: str = Field(..., min_length=1, max_length=500)
    content_type: str = "application/octet-stream"
    contributor_name: str = Field(default="anonymous", max_length=255)


class ContributionResponse(BaseModel):
    id: uuid.UUID
    mission_id: uuid.UUID
    filename: str
    s3_key: str
    file_size: int
    content_type: str
    contributor_name: str
    status: ContributionStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContributionListResponse(BaseModel):
    contributions: list[ContributionResponse]
    total: int


class PresignedUploadResponse(BaseModel):
    contribution_id: uuid.UUID
    upload_url: str
    s3_key: str
    expires_in: int = 3600
