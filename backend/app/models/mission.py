import uuid
from sqlalchemy import String, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, UUIDMixin, TimestampMixin


class MissionStatus(str, enum.Enum):
    ACTIVE = "active"
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
    data_type: Mapped[DataType] = mapped_column(
        SAEnum(DataType, name="data_type"), default=DataType.OTHER
    )
    status: Mapped[MissionStatus] = mapped_column(
        SAEnum(MissionStatus, name="mission_status"), default=MissionStatus.ACTIVE
    )
    goal_count: Mapped[int] = mapped_column(default=100)

    # Relationships
    contributions: Mapped[list["Contribution"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
    ai_models: Mapped[list["AIModel"]] = relationship(
        back_populates="mission", lazy="selectin"
    )
