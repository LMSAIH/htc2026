import uuid
import enum
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class MemberRole(str, enum.Enum):
    CONTRIBUTOR = "contributor"
    ANNOTATOR = "annotator"
    REVIEWER = "reviewer"


class MissionMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "mission_members"
    __table_args__ = (
        UniqueConstraint("mission_id", "user_id", name="uq_mission_user"),
    )

    mission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MemberRole] = mapped_column(
        SAEnum(MemberRole, name="member_role"), default=MemberRole.CONTRIBUTOR
    )
    approved_count: Mapped[int] = mapped_column(Integer, default=0)
    total_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    mission: Mapped["Mission"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="mission_memberships")
