"""
Simulated Training Service — CPU-based training simulation for testing.

This module provides a simulated training experience that runs entirely on CPU
without requiring actual GPU resources. It's designed for:
- Development and testing without GPU costs
- Demo environments
- Fallback when GPU instances are unavailable

The simulation mimics the full training pipeline:
1. Data loading and preprocessing (simulated)
2. Model training with epoch/batch progress
3. Loss/accuracy metrics
4. Model checkpointing (simulated)
5. Final model export (simulated)

All progress and logs are reported via the same callbacks as real GPU training.
"""

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal as async_session_maker
from app.models.training_job import TrainingJob, TrainingJobStatus

logger = logging.getLogger(__name__)

SIMULATED_EPOCH_TIME_SECONDS = 30
SIMULATED_BATCH_TIME_SECONDS = 2
HEARTBEAT_INTERVAL = 30


class SimulatedTaskType(str, Enum):
    IMAGE_CLASSIFICATION = "image-classification"
    TEXT_CLASSIFICATION = "text-classification"
    OBJECT_DETECTION = "object-detection"
    SENTIMENT_ANALYSIS = "sentiment-analysis"
    TOKEN_CLASSIFICATION = "token-classification"


async def run_simulated_training(job_id: uuid.UUID) -> None:
    """
    Execute a simulated training job.

    This runs the full training simulation with:
    - Progress callbacks every epoch/batch
    - Heartbeat every 30 seconds
    - Structured logging to backend
    - Proper state management
    """
    settings = get_settings()
    base_url = settings.API_BASE_URL
    heartbeat_url = f"{base_url}/api/training/jobs/{job_id}/callback/heartbeat"
    log_url = f"{base_url}/api/training/jobs/{job_id}/callback/log"
    complete_url = f"{base_url}/api/training/jobs/{job_id}/callback/complete"
    state_dir = Path("/worker/state")
    state_dir.mkdir(parents=True, exist_ok=True)

    state_file = state_dir / f"{job_id}.json"

    async with async_session_maker() as db:
        result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            logger.error("Job %s not found in database", job_id)
            return

        if job.status == TrainingJobStatus.CANCELLED:
            logger.info("Job %s was cancelled, skipping simulation", job_id)
            return

        job.status = TrainingJobStatus.TRAINING
        job.started_at = datetime.utcnow()
        job.gpu_temp_c = 45.0
        job.gpu_memory_used_gb = 0.5
        job.worker_status = "running"
        await db.commit()

    logger.info("Starting simulated training for job %s", job_id)

    try:
        await _send_log(
            log_url,
            "INFO",
            f"Starting simulated training for task: {job.task.value if hasattr(job.task, 'value') else job.task}",
            None,
            None,
        )

        initial_loss = 2.5
        target_loss = 0.1
        current_loss = initial_loss
        loss_decay = (initial_loss - target_loss) / job.max_epochs
        accuracy = 0.1
        accuracy_gain = 0.85 / job.max_epochs

        for epoch in range(1, job.max_epochs + 1):
            if state_file.exists():
                with open(state_file) as f:
                    saved_state = f.read().strip()
                if saved_state != str(epoch):
                    logger.info("Resuming from epoch %s", saved_state)
                    epoch = int(saved_state)
                    current_loss = initial_loss - (loss_decay * (epoch - 1))
                    accuracy = 0.1 + (accuracy_gain * (epoch - 1))

            await _send_log(
                log_url, "INFO", f"Epoch {epoch}/{job.max_epochs}", epoch, None
            )

            num_batches = max(10, 100 // job.batch_size)

            for batch in range(1, num_batches + 1):
                await asyncio.sleep(SIMULATED_BATCH_TIME_SECONDS)

                batch_loss = current_loss + (random.random() - 0.5) * 0.1
                batch_accuracy = accuracy + (random.random() - 0.5) * 0.05

                await _send_log(
                    log_url,
                    "INFO",
                    f"Batch {batch}/{num_batches} - loss: {batch_loss:.4f} - accuracy: {batch_accuracy:.4f}",
                    epoch,
                    batch,
                )

                if batch % 10 == 0:
                    await _send_heartbeat(
                        heartbeat_url,
                        worker_status="running",
                        gpu_temp_c=45.0 + random.random() * 5,
                        gpu_memory_used_gb=0.5 + random.random() * 0.3,
                    )

                with open(state_file, "w") as f:
                    f.write(str(epoch))

            current_loss = max(target_loss, current_loss - loss_decay)
            accuracy = min(0.95, accuracy + accuracy_gain)

            await _send_log(
                log_url,
                "INFO",
                f"Epoch {epoch} completed - loss: {current_loss:.4f} - accuracy: {accuracy:.4f}",
                epoch,
                None,
            )

            final_model_path = f"/tmp/model_epoch_{epoch}"
            await _send_log(
                log_url, "INFO", f"Checkpoint saved: {final_model_path}", epoch, None
            )

        final_loss = current_loss
        final_accuracy = accuracy

        await _send_log(
            log_url,
            "INFO",
            f"Training completed - final_loss: {final_loss:.4f} - final_accuracy: {final_accuracy:.4f}",
            None,
            None,
        )

        await _complete_training(job_id, final_loss, final_accuracy, complete_url)

        if state_file.exists():
            state_file.unlink()

        logger.info("Simulated training completed for job %s", job_id)

    except asyncio.CancelledError:
        await _send_log(log_url, "WARNING", "Training cancelled", None, None)
        logger.info("Simulated training cancelled for job %s", job_id)
        raise
    except Exception as exc:
        logger.error("Simulated training failed for job %s: %s", job_id, exc)
        await _send_log(log_url, "ERROR", f"Training failed: {str(exc)}", None, None)
        await _fail_training(job_id, str(exc), complete_url)
        raise


async def _send_heartbeat(
    url: str, worker_status: str, gpu_temp_c: float, gpu_memory_used_gb: float
) -> None:
    """Send a heartbeat to the backend."""
    payload = {
        "worker_status": worker_status,
        "gpu_temp_c": gpu_temp_c,
        "gpu_memory_used_gb": gpu_memory_used_gb,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except Exception as exc:
        logger.warning("Failed to send heartbeat: %s", exc)


async def _send_log(
    url: str, level: str, message: str, epoch: Optional[int], batch: Optional[int]
) -> None:
    """Send a log message to the backend."""
    payload = {
        "level": level,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "epoch": epoch,
        "batch": batch,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except Exception as exc:
        logger.warning("Failed to send log: %s", exc)


async def _complete_training(
    job_id: uuid.UUID, final_loss: float, final_accuracy: float, url: str
) -> None:
    """Mark the training as completed."""
    payload = {
        "status": "completed",
        "final_loss": final_loss,
        "final_accuracy": final_accuracy,
        "model_path": f"/tmp/model_final",
        "training_time_seconds": random.randint(300, 600),
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(url, json=payload)
    except Exception as exc:
        logger.warning("Failed to send completion: %s", exc)

    async with async_session_maker() as db:
        result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = TrainingJobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.final_loss = final_loss
            job.final_accuracy = final_accuracy
            job.error_message = None
            job.worker_status = "completed"
            await db.commit()


async def _fail_training(job_id: uuid.UUID, error_message: str, url: str) -> None:
    """Mark the training as failed."""
    payload = {"status": "failed", "error_message": error_message}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(url, json=payload)
    except Exception as exc:
        logger.warning("Failed to send failure: %s", exc)

    async with async_session_maker() as db:
        result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = TrainingJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = error_message
            job.worker_status = "failed"
            await db.commit()
