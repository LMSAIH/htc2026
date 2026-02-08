"""
Training Orchestrator — coordinates GPU provisioning for training jobs.

This module handles the lifecycle of training jobs:
  1. Creates a TrainingJob row in DB (done by router)
  2. Provisions a Vultr GH200 GPU instance with a startup script (with retry)
  3. The GPU worker runs training and reports back via HTTP callbacks
  4. Cleanup: destroy the GPU instance when done

The actual training execution happens in the separate gpu-worker container,
not in the API process.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal as async_session_maker
from app.core.config import get_settings
from app.models.training_job import TrainingJob, TrainingJobStatus
from app.services import vultr_gpu

logger = logging.getLogger(__name__)

MAX_PROVISION_RETRIES = 3
PROVISION_TIMEOUT_MINUTES = 15
ORPHANED_JOB_TIMEOUT_MINUTES = 30


def launch_training(job_id: uuid.UUID) -> None:
    """
    Provision a GPU instance for the training job and return immediately.
    The GPU worker will handle actual training and report back via callbacks.
    """
    asyncio.create_task(
        _provision_with_retry(job_id, retry_count=0), name=f"train-{job_id}"
    )


async def _provision_with_retry(job_id: uuid.UUID, retry_count: int) -> None:
    """
    Provision GPU with retry logic.
    """
    try:
        await _provision_and_monitor(job_id)
    except Exception as exc:
        logger.error(
            "Provision attempt %d/%d failed for job %s: %s",
            retry_count + 1,
            MAX_PROVISION_RETRIES,
            job_id,
            exc,
        )

        async with async_session_maker() as db:
            job = await _load_job(db, job_id)
            if job and retry_count < MAX_PROVISION_RETRIES - 1:
                logger.info(
                    "Retrying provisioning for job %s (attempt %d)",
                    job_id,
                    retry_count + 2,
                )
                await _update_status(db, job, TrainingJobStatus.QUEUED)
                await asyncio.sleep(5 * (retry_count + 1))
                asyncio.create_task(
                    _provision_with_retry(job_id, retry_count + 1),
                    name=f"train-retry-{job_id}",
                )
            elif job:
                job.error_message = f"Provisioning failed after {MAX_PROVISION_RETRIES} attempts: {str(exc)[:2000]}"
                await _update_status(db, job, TrainingJobStatus.FAILED)
                await _fire_webhook(job, "failed", str(exc))


async def _provision_and_monitor(job_id: uuid.UUID) -> None:
    """
    Provision GPU, store instance info, and monitor via callbacks.
    The actual training happens in the GPU worker container.
    """
    async with async_session_maker() as db:
        try:
            job = await _load_job(db, job_id)
            if not job:
                logger.error("Training job %s not found in DB", job_id)
                return

            logger.info("Provisioning GPU for job %s", job_id)

            await _update_status(db, job, TrainingJobStatus.PROVISIONING)

            settings = get_settings()

            instance_data = await vultr_gpu.create_gpu_instance(
                label=f"dfa-train-{str(job_id)[:8]}",
                job_id=str(job_id),
                base_model=job.base_model,
                task=job.task.value if hasattr(job.task, "value") else str(job.task),
                max_epochs=job.max_epochs,
                batch_size=job.batch_size,
                learning_rate=job.learning_rate,
                use_lora=job.use_lora,
                target_accuracy=job.target_accuracy,
                api_callback_url=settings.API_BASE_URL,
                callback_secret=settings.CALLBACK_SECRET,
            )

            instance_id = instance_data.get("bare_metal", {}).get("id")
            instance_ip = instance_data.get("bare_metal", {}).get("main_ip", "")

            job.vultr_instance_id = instance_id
            job.vultr_instance_ip = instance_ip
            await db.flush()

            logger.info("GPU instance %s provisioned for job %s", instance_id, job_id)

            await _fire_webhook(
                job, "provisioning", f"GPU instance {instance_id} provisioned"
            )

            logger.info(
                "Job %s handed off to GPU worker. Waiting for completion...", job_id
            )

        except Exception as exc:
            logger.error(
                "Failed to provision GPU for job %s: %s", job_id, exc, exc_info=exc
            )
            raise


async def cleanup_job(job_id: uuid.UUID) -> None:
    """
    Called when a job is cancelled or completed to clean up GPU resources.
    """
    async with async_session_maker() as db:
        job = await _load_job(db, job_id)
        if job and job.vultr_instance_id:
            try:
                await vultr_gpu.destroy_instance(job.vultr_instance_id)
                logger.info(
                    "Destroyed GPU instance %s for job %s",
                    job.vultr_instance_id,
                    job_id,
                )
            except Exception as exc:
                logger.error(
                    "Failed to destroy GPU instance %s for job %s: %s",
                    job.vultr_instance_id,
                    job_id,
                    exc,
                )


async def cleanup_orphaned_jobs() -> None:
    """
    Check for jobs stuck in PROVISIONING status and clean them up.
    Should be called periodically (e.g., via a cron or scheduler).
    """
    cutoff_time = datetime.now(timezone.utc)
    cutoff_time = cutoff_time.replace(
        minute=cutoff_time.minute - ORPHANED_JOB_TIMEOUT_MINUTES
    )

    async with async_session_maker() as db:
        result = await db.execute(
            select(TrainingJob).where(
                TrainingJob.status == TrainingJobStatus.PROVISIONING,
                TrainingJob.updated_at < cutoff_time,
            )
        )
        orphaned = result.scalars().all()

        for job in orphaned:
            logger.warning(
                "Found orphaned job %s in PROVISIONING status since %s, cleaning up",
                job.id,
                job.updated_at,
            )
            if job.vultr_instance_id:
                try:
                    await vultr_gpu.destroy_instance(job.vultr_instance_id)
                    logger.info(
                        "Destroyed orphaned GPU instance %s", job.vultr_instance_id
                    )
                except Exception as exc:
                    logger.error("Failed to destroy orphaned instance: %s", exc)
            job.status = TrainingJobStatus.FAILED
            job.error_message = "Job timed out during provisioning"
            await db.flush()

        if orphaned:
            logger.info("Cleaned up %d orphaned jobs", len(orphaned))


async def _load_job(db: AsyncSession, job_id: uuid.UUID) -> TrainingJob | None:
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    return result.scalar_one_or_none()


async def _update_status(
    db: AsyncSession, job: TrainingJob, status: TrainingJobStatus
) -> None:
    job.status = status
    job.updated_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("Job %s → %s", job.id, status.value)


async def _fire_webhook(
    job: TrainingJob, status: str, message: str | None = None
) -> None:
    """POST a status update to the job's notify_webhook URL."""
    if not job.notify_webhook:
        return
    payload = {
        "job_id": str(job.id),
        "mission_id": str(job.mission_id),
        "status": status,
        "message": message,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(job.notify_webhook, json=payload)
            logger.info("Webhook %s → %d", job.notify_webhook, resp.status_code)
    except Exception as exc:
        logger.warning("Webhook delivery failed for job %s: %s", job.id, exc)
