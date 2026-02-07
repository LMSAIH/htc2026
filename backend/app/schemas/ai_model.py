import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.ai_model import ModelStatus


class AIModelCreate(BaseModel):
    mission_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)


class AIModelResponse(BaseModel):
    id: uuid.UUID
    mission_id: uuid.UUID
    name: str
    status: ModelStatus
    accuracy: float | None
    epochs_completed: int
    total_epochs: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIModelListResponse(BaseModel):
    models: list[AIModelResponse]
    total: int


class TrainRequest(BaseModel):
    mission_id: uuid.UUID
    model_name: str = Field(default="dataforall-v1", max_length=255)
    epochs: int = Field(default=10, ge=1, le=100)
