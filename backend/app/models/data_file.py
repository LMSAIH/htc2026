import uuid
import enum
from sqlalchemy import String, Integer, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class FileStatus(str, enum.Enum):
    PENDING = "pending"
    NEEDS_ANNOTATION = "needs_annotation"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class DataFile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "data_files"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    size_kb: Mapped[int] = mapped_column(Integer, default=0)
    file_type: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[FileStatus] = mapped_column(
        SAEnum(FileStatus, name="file_status"), default=FileStatus.PENDING
    )
    contributor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    contributor_name: Mapped[str] = mapped_column(String(255), default="anonymous")
    s3_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Relationships
    dataset: Mapped["Dataset"] = relationship(back_populates="files")
    annotations: Mapped[list["FileAnnotation"]] = relationship(
        back_populates="data_file", lazy="selectin"
    )
