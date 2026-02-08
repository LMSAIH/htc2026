"""
Training Orchestrator — coordinates GPU provisioning for training jobs.

This module handles the lifecycle of training jobs:
  1. Creates a TrainingJob row in DB (done by router)
  2. Provisions a Vultr GH200 GPU instance with a startup script
  3. The GPU worker runs training and reports back via HTTP callbacks
  4. Cleanup: destroy the GPU instance when done

The actual training execution happens in the separate gpu-worker container,
not in the API process.
"""

import asyncio
import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal as async_session_maker
from app.core.config import get_settings
from app.models.training_job import TrainingJob, TrainingJobStatus
from app.services import vultr_gpu

logger = logging.getLogger(__name__)


def launch_training(job_id: uuid.UUID) -> None:
    """
    Provision a GPU instance for the training job and return immediately.
    The GPU worker will handle actual training and report back via callbacks.
    """
    asyncio.create_task(_provision_and_monitor(job_id), name=f"train-{job_id}")


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
            async with async_session_maker() as err_db:
                err_job = await _load_job(err_db, job_id)
                if err_job:
                    err_job.error_message = f"Provisioning failed: {str(exc)[:2000]}"
                    await _update_status(err_db, err_job, TrainingJobStatus.FAILED)
                    await _fire_webhook(err_job, "failed", str(exc))


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


async def _load_job(db: AsyncSession, job_id: uuid.UUID) -> TrainingJob | None:
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    return result.scalar_one_or_none()


async def _update_status(
    db: AsyncSession, job: TrainingJob, status: TrainingJobStatus
) -> None:
    job.status = status
    await db.flush()
    logger.info("Job %s → %s", job.id, status.value)


async def _fire_webhook(job: TrainingJob, status: str, message: str = None) -> None:
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
