import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class WorkerStatus(str, enum.Enum):
    starting = "starting"
    online = "online"
    busy = "busy"  # Currently running a job
    offline = "offline"
    terminated = "terminated"


class PersistentWorker(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "persistent_workers"

    lambda_instance_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    status: Mapped[WorkerStatus] = mapped_column(
        Enum(WorkerStatus), default=WorkerStatus.starting, nullable=False
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)

    def __repr__(self) -> str:
        return (
            f"<PersistentWorker {self.id} "
            f"instance={self.lambda_instance_id} "
            f"status={self.status}>"
        )
