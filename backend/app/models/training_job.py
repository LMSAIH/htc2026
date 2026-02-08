import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class TrainingTask(str, enum.Enum):
    IMAGE_CLASSIFICATION = "image-classification"
    TABULAR_CLASSIFICATION = "tabular-classification"
    AUDIO_CLASSIFICATION = "audio-classification"
    TIME_SERIES_FORECASTING = "time-series-forecasting"
    ANOMALY_DETECTION = "anomaly-detection"
    TEXT_CLASSIFICATION = "text-classification"
    OBJECT_DETECTION = "object-detection"


class TrainingJobStatus(str, enum.Enum):
    QUEUED = "queued"
    PROVISIONING = "provisioning"
    TRAINING = "training"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "training_jobs"

    # FK to mission
    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False
    )

    # What kind of ML task
    task: Mapped[TrainingTask] = mapped_column(
        SAEnum(TrainingTask, name="training_task"), nullable=False
    )

    # HuggingFace base model identifier (e.g. "google/vit-base-patch16-224")
    base_model: Mapped[str] = mapped_column(String(512), nullable=False)

    # Job status
    status: Mapped[TrainingJobStatus] = mapped_column(
        SAEnum(TrainingJobStatus, name="training_job_status"),
        default=TrainingJobStatus.QUEUED,
    )

    # Vultr GPU provisioning (always GH200)
    vultr_instance_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vultr_instance_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # S3 / R2 paths
    dataset_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_model_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Hyperparameters
    max_epochs: Mapped[int] = mapped_column(Integer, default=10)
    batch_size: Mapped[int] = mapped_column(Integer, default=16)
    learning_rate: Mapped[float] = mapped_column(Float, default=3e-4)
    use_lora: Mapped[bool] = mapped_column(Boolean, default=True)
    target_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Results
    epochs_completed: Mapped[int] = mapped_column(Integer, default=0)
    result_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_loss: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Real-time progress fields
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    current_batch: Mapped[int] = mapped_column(Integer, default=0)
    total_batches: Mapped[int] = mapped_column(Integer, default=0)
    current_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    eta_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_progress_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Cost tracking
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Optional webhook for completion notification
    notify_webhook: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Error details if failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Link to AIModel record created on success
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_models.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    mission: Mapped["Mission"] = relationship(back_populates="training_jobs")
    ai_model: Mapped["AIModel"] = relationship(foreign_keys=[model_id])
