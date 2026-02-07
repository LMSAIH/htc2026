import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.mission import MissionStatus, DataType


# --- Create / Update ---
class MissionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    data_type: DataType = DataType.OTHER
    goal_count: int = Field(default=100, ge=1)


class MissionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    data_type: DataType | None = None
    status: MissionStatus | None = None
    goal_count: int | None = None


# --- Response ---
class MissionResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    data_type: DataType
    status: MissionStatus
    goal_count: int
    created_at: datetime
    updated_at: datetime
    contribution_count: int = 0

    model_config = {"from_attributes": True}


class MissionListResponse(BaseModel):
    missions: list[MissionResponse]
    total: int
