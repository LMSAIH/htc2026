import uuid
from sqlalchemy import String, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, UUIDMixin, TimestampMixin


class ContributionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"


class Contribution(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contributions"

    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(default=0)
    content_type: Mapped[str] = mapped_column(
        String(100), default="application/octet-stream"
    )
    contributor_name: Mapped[str] = mapped_column(String(255), default="anonymous")
    status: Mapped[ContributionStatus] = mapped_column(
        SAEnum(ContributionStatus, name="contribution_status"),
        default=ContributionStatus.PENDING,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    mission: Mapped["Mission"] = relationship(back_populates="contributions")
    curation_actions: Mapped[list["CurationAction"]] = relationship(
        back_populates="contribution", lazy="selectin"
    )
