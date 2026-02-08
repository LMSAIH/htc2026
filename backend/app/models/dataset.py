import uuid
from sqlalchemy import String, Text, Integer, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY

from app.models.base import Base, UUIDMixin, TimestampMixin


class Dataset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "datasets"

    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    total_size_mb: Mapped[float] = mapped_column(Float, default=0.0)
    accepted_types: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )

    # Relationships
    mission: Mapped["Mission"] = relationship(back_populates="datasets")
    files: Mapped[list["DataFile"]] = relationship(
        back_populates="dataset", lazy="selectin"
    )
