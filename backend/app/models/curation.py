import uuid
from sqlalchemy import String, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, UUIDMixin, TimestampMixin


class CurationActionType(str, enum.Enum):
    APPROVE = "approve"
    REJECT = "reject"
    FLAG = "flag"
    RESET = "reset"


class CurationAction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "curation_actions"

    contribution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contributions.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[CurationActionType] = mapped_column(
        SAEnum(CurationActionType, name="curation_action_type"), nullable=False
    )
    reviewer: Mapped[str] = mapped_column(String(255), default="system")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    contribution: Mapped["Contribution"] = relationship(
        back_populates="curation_actions"
    )
