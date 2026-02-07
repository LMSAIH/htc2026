import uuid
from sqlalchemy import String, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, UUIDMixin, TimestampMixin


class ModelStatus(str, enum.Enum):
    QUEUED = "queued"
    TRAINING = "training"
    COMPLETED = "completed"
    FAILED = "failed"


class AIModel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_models"

    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ModelStatus] = mapped_column(
        SAEnum(ModelStatus, name="model_status"), default=ModelStatus.QUEUED
    )
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    epochs_completed: Mapped[int] = mapped_column(default=0)
    total_epochs: Mapped[int] = mapped_column(default=10)

    # Relationships
    mission: Mapped["Mission"] = relationship(back_populates="ai_models")
