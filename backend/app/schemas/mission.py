import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field

from app.models.mission import MissionStatus, DataType


# --- Nested sub-objects ---
class DatasetBrief(BaseModel):
    id: str
    name: str
    description: str
    file_count: int
    total_size_mb: float
    accepted_types: list[str] | None = None
    created_at: str

    model_config = {"from_attributes": True}


class ContributorBrief(BaseModel):
    user_id: str
    user_name: str
    role: str
    approved_count: int
    total_count: int

    model_config = {"from_attributes": True}


# --- Create / Update ---
class MissionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    reason: str = ""
    how_to_contribute: str = ""
    category: str = ""
    model_type: str = "vision"
    data_type: DataType = DataType.OTHER
    goal_count: int = Field(default=100, ge=1)
    accepted_types: list[str] | None = None
    configured_tasks: Any | None = None
    datasets: list[dict] | None = None  # [{name, description}]


class MissionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    reason: str | None = None
    how_to_contribute: str | None = None
    category: str | None = None
    model_type: str | None = None
    data_type: DataType | None = None
    status: MissionStatus | None = None
    goal_count: int | None = None
    accepted_types: list[str] | None = None
    configured_tasks: Any | None = None


# --- Response ---
class MissionResponse(BaseModel):
    id: str
    title: str
    description: str
    reason: str = ""
    how_to_contribute: str = ""
    category: str = ""
    model_type: str = "vision"
    data_type: DataType
    status: MissionStatus
    owner_id: str | None = None
    owner_name: str = ""
    accepted_types: list[str] | None = None
    target_contributions: int = 100  # alias for goal_count
    current_contributions: int = 0
    model_available: bool = False
    configured_tasks: Any | None = None
    datasets: list[DatasetBrief] = []
    contributors: list[ContributorBrief] = []
    created_at: str
    updated_at: str | None = None

    model_config = {"from_attributes": True}


class MissionListResponse(BaseModel):
    missions: list[MissionResponse]
    total: int
