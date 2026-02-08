import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class FileAnnotation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "file_annotations"

    data_file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_files.id", ondelete="CASCADE"), nullable=False
    )
    annotator_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    annotator_name: Mapped[str] = mapped_column(String(255), default="anonymous")
    label: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    # Relationships
    data_file: Mapped["DataFile"] = relationship(back_populates="annotations")
