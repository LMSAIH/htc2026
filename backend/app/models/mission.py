import uuid
from sqlalchemy import String, Text, Integer, ForeignKey, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
import enum

from app.models.base import Base, UUIDMixin, TimestampMixin


class MissionStatus(str, enum.Enum):
    ACTIVE = "active"
    DRAFT = "draft"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class DataType(str, enum.Enum):
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    TABULAR = "tabular"
    OTHER = "other"


class Mission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "missions"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    how_to_contribute: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(100), default="")
    model_type: Mapped[str] = mapped_column(String(50), default="vision")
    data_type: Mapped[DataType] = mapped_column(
        SAEnum(DataType, name="data_type"), default=DataType.OTHER
    )
    status: Mapped[MissionStatus] = mapped_column(
        SAEnum(MissionStatus, name="mission_status"), default=MissionStatus.ACTIVE
    )
    goal_count: Mapped[int] = mapped_column(default=100)
    current_contributions: Mapped[int] = mapped_column(Integer, default=0)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    owner_name: Mapped[str] = mapped_column(String(255), default="")
    accepted_types: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )
    model_available: Mapped[bool] = mapped_column(Boolean, default=False)
    configured_tasks: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    contributions: Mapped[list["Contribution"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
    ai_models: Mapped[list["AIModel"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
    training_jobs: Mapped[list["TrainingJob"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
    datasets: Mapped[list["Dataset"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
    members: Mapped[list["MissionMember"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
