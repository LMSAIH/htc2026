import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.training_job import TrainingJobStatus, TrainingTask


# ── Request schemas ──────────────────────────────────────────────────────────

class TrainJobRequest(BaseModel):
    """Payload for POST /api/training/missions/{mission_id}/train"""
    task: TrainingTask
    base_model: str | None = Field(
        default=None,
        description="HuggingFace model ID. If omitted, auto-selected based on task.",
        max_length=512,
    )
    max_epochs: int = Field(default=10, ge=1, le=200)
    batch_size: int = Field(default=16, ge=1, le=512)
    learning_rate: float = Field(default=3e-4, gt=0, le=1.0)
    use_lora: bool = True
    target_accuracy: float | None = Field(default=None, ge=0.0, le=1.0)
    notify_webhook: str | None = Field(default=None, max_length=1024)


# ── Response schemas ─────────────────────────────────────────────────────────

class TrainingJobResponse(BaseModel):
    id: uuid.UUID
    mission_id: uuid.UUID
    task: TrainingTask
    base_model: str
    status: TrainingJobStatus
    vultr_instance_id: str | None
    max_epochs: int
    batch_size: int
    learning_rate: float
    use_lora: bool
    target_accuracy: float | None
    epochs_completed: int
    result_accuracy: float | None
    result_loss: float | None
    estimated_cost_usd: float | None
    actual_cost_usd: float | None
    error_message: str | None
    model_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrainingJobListResponse(BaseModel):
    jobs: list[TrainingJobResponse]
    total: int


# ── HuggingFace model info ──────────────────────────────────────────────────

class HFModelInfo(BaseModel):
    """Lightweight representation of a HuggingFace Hub model."""
    model_id: str
    author: str | None = None
    task: str | None = None
    downloads: int = 0
    likes: int = 0
    tags: list[str] = []


class HFModelListResponse(BaseModel):
    models: list[HFModelInfo]
    total: int
    task_filter: str | None = None


# ── GPU info ─────────────────────────────────────────────────────────────────

class GPUInfo(BaseModel):
    name: str
    plan: str
    hourly_rate_usd: float
    gpu_memory_gb: int
    cpu_memory_gb: int
    description: str


class GPUInfoResponse(BaseModel):
    gpu: GPUInfo
    mode: str  # "local" or "vultr"
