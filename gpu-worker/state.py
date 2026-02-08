"""
Worker State Management — handles crash recovery via local state file.

This module manages the worker's persistent state file (`/worker/state/{job_id}.json`).
If the worker crashes and restarts, it reads the local state and resumes training
from the last checkpoint instead of starting over.

State file structure:
{
    "job_id": "uuid",
    "epoch": 1,
    "batch": 45,
    "loss": 0.324,
    "accuracy": 0.72,
    "retry_count": 0,
    "last_error": null,
    "created_at": "2026-02-08T06:00:00Z",
    "updated_at": "2026-02-08T06:30:00Z"
}
"""

import json
import logging
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

STATE_DIR = Path("/worker/state")
STATE_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class JobState:
    """Represents the worker's persistent state for a training job."""

    job_id: str
    epoch: int = 1
    batch: int = 0
    loss: Optional[float] = None
    accuracy: Optional[float] = None
    retry_count: int = 0
    last_error: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()
        self.updated_at = datetime.utcnow().isoformat()

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "JobState":
        return cls(**data)


def get_state_path(job_id: str) -> Path:
    """Get the path to the state file for a job."""
    return STATE_DIR / f"{job_id}.json"


def save_state(state: JobState) -> None:
    """Save job state to persistent storage."""
    path = get_state_path(state.job_id)
    try:
        with open(path, "w") as f:
            json.dump(state.to_dict(), f, indent=2)
        logger.debug("Saved state to %s", path)
    except Exception as exc:
        logger.error("Failed to save state to %s: %s", path, exc)
        raise


def load_state(job_id: str) -> Optional[JobState]:
    """Load job state from persistent storage. Returns None if no state exists."""
    path = get_state_path(job_id)
    if not path.exists():
        logger.info("No state file found for job %s", job_id)
        return None

    try:
        with open(path, "r") as f:
            data = json.load(f)
        state = JobState.from_dict(data)
        logger.info(
            "Loaded state for job %s: epoch=%d, batch=%d",
            job_id,
            state.epoch,
            state.batch,
        )
        return state
    except Exception as exc:
        logger.error("Failed to load state from %s: %s", path, exc)
        return None


def delete_state(job_id: str) -> None:
    """Delete job state file after successful completion."""
    path = get_state_path(job_id)
    if path.exists():
        try:
            os.remove(path)
            logger.info("Deleted state file %s", path)
        except Exception as exc:
            logger.error("Failed to delete state file %s: %s", path, exc)


def update_progress(
    state: JobState,
    epoch: int,
    batch: int,
    loss: Optional[float] = None,
    accuracy: Optional[float] = None,
) -> None:
    """Update progress in state and save to disk."""
    state.epoch = epoch
    state.batch = batch
    if loss is not None:
        state.loss = loss
    if accuracy is not None:
        state.accuracy = accuracy
    state.updated_at = datetime.utcnow().isoformat()
    state.last_error = None
    state.retry_count = 0
    save_state(state)


def increment_retry(state: JobState, error: str) -> int:
    """Increment retry count and save state. Returns new retry count."""
    state.retry_count += 1
    state.last_error = error
    state.updated_at = datetime.utcnow().isoformat()
    save_state(state)
    return state.retry_count


def clear_error(state: JobState) -> None:
    """Clear error state after successful operation."""
    state.last_error = None
    state.retry_count = 0
    state.updated_at = datetime.utcnow().isoformat()
    save_state(state)
