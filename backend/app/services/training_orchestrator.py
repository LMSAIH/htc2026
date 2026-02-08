"""
Training Orchestrator — coordinates the full training lifecycle:

  Cloud mode (TRAINING_MODE=vultr) — provisions a Vultr GH200 Neoverse V2:
    1. Provision GH200  →  2. SSH train  →  3. Upload artifacts  →  4. Tear down

  Local mode (TRAINING_MODE=local) — runs on the local RTX 4060 Mobile:
    1. Skip provisioning  →  2. Train locally  →  3. Save artifacts

Both modes: resolve HF model, create AIModel record, fire webhook.
Runs as a background asyncio task so the API returns immediately.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal as async_session_maker
from app.models.mission import Mission
from app.models.contribution import Contribution, ContributionStatus
from app.models.ai_model import AIModel, ModelStatus
from app.models.training_job import TrainingJob, TrainingJobStatus
from app.services import vultr_gpu, hf_models

logger = logging.getLogger(__name__)


# ── Public entry point ───────────────────────────────────────────────────────

def launch_training(job_id: uuid.UUID) -> asyncio.Task:
    """
    Schedule the training pipeline as a background asyncio task.
    Called from the router after creating the TrainingJob row.
    """
    task = asyncio.create_task(_run_pipeline(job_id), name=f"train-{job_id}")
    task.add_done_callback(_task_done_callback)
    return task


def _task_done_callback(task: asyncio.Task) -> None:
    if task.cancelled():
        logger.warning("Training task %s was cancelled", task.get_name())
    elif exc := task.exception():
        logger.error("Training task %s crashed: %s", task.get_name(), exc, exc_info=exc)


# ── Pipeline implementation ──────────────────────────────────────────────────

async def _run_pipeline(job_id: uuid.UUID) -> None:
    """Full training lifecycle — runs in background."""
    local_mode = vultr_gpu.is_local_mode()
    async with async_session_maker() as db:
        try:
            job = await _load_job(db, job_id)
            if not job:
                logger.error("Training job %s not found in DB", job_id)
                return

            if local_mode:
                # ── Local 4060 Mobile path ───────────────────────────────
                logger.info("Running job %s in LOCAL mode (RTX 4060 Mobile)", job_id)
                await _update_status(db, job, TrainingJobStatus.TRAINING)

                result = await _execute_training(job, local=True)

                await _update_status(db, job, TrainingJobStatus.UPLOADING)
                model_path = f"missions/{job.mission_id}/models/{job.id}/model.safetensors"
                job.output_model_path = model_path
            else:
                # ── Cloud GH200 Neoverse V2 path ────────────────────────
                logger.info("Running job %s in CLOUD mode (GH200 Neoverse V2)", job_id)
                await _update_status(db, job, TrainingJobStatus.PROVISIONING)

                instance_data = await _provision_gpu(db, job)
                instance_id = instance_data["bare_metal"]["id"]
                instance_ip = instance_data["bare_metal"].get("main_ip", "")

                job.vultr_instance_id = instance_id
                job.vultr_instance_ip = instance_ip
                await db.flush()

                await vultr_gpu.wait_for_instance_active(instance_id, timeout_seconds=600)

                await _update_status(db, job, TrainingJobStatus.TRAINING)
                result = await _execute_training(job, local=False)

                await _update_status(db, job, TrainingJobStatus.UPLOADING)
                model_path = f"missions/{job.mission_id}/models/{job.id}/model.safetensors"
                job.output_model_path = model_path

            # ── Common: create AIModel record ────────────────────────────
            ai_model = AIModel(
                mission_id=job.mission_id,
                name=f"{job.base_model.split('/')[-1]}-ft-{str(job.id)[:8]}",
                status=ModelStatus.COMPLETED,
                accuracy=result.get("accuracy"),
                epochs_completed=result.get("epochs_completed", job.max_epochs),
                total_epochs=job.max_epochs,
            )
            db.add(ai_model)
            await db.flush()
            await db.refresh(ai_model)

            # Link model to job
            job.model_id = ai_model.id
            job.result_accuracy = result.get("accuracy")
            job.result_loss = result.get("loss")
            job.epochs_completed = result.get("epochs_completed", job.max_epochs)
            job.actual_cost_usd = _calculate_actual_cost(job)
            await _update_status(db, job, TrainingJobStatus.COMPLETED)

            logger.info(
                "Training job %s completed (%s) — accuracy=%.4f",
                job_id, "local" if local_mode else "GH200", job.result_accuracy or 0,
            )

        except Exception as exc:
            logger.error("Training job %s failed: %s", job_id, exc, exc_info=exc)
            async with async_session_maker() as err_db:
                err_job = await _load_job(err_db, job_id)
                if err_job:
                    err_job.error_message = str(exc)[:2000]
                    await _update_status(err_db, err_job, TrainingJobStatus.FAILED)

        finally:
            # Tear down GPU instance if cloud mode and one was provisioned
            if not local_mode:
                await _cleanup_gpu(job_id, db)

            # Step 9 — fire webhook if configured
            async with async_session_maker() as hook_db:
                hook_job = await _load_job(hook_db, job_id)
                if hook_job and hook_job.notify_webhook:
                    await _fire_webhook(hook_job)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _load_job(db: AsyncSession, job_id: uuid.UUID) -> TrainingJob | None:
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    return result.scalar_one_or_none()


async def _update_status(
    db: AsyncSession, job: TrainingJob, status: TrainingJobStatus
) -> None:
    job.status = status
    await db.flush()
    logger.info("Job %s → %s", job.id, status.value)


async def _provision_gpu(db: AsyncSession, job: TrainingJob) -> dict:
    """Create a GH200 instance for this job."""
    label = f"dfa-train-{str(job.id)[:8]}"
    data = await vultr_gpu.create_gpu_instance(label=label)
    job.estimated_cost_usd = vultr_gpu.estimate_cost(job.max_epochs)
    await db.flush()
    return data


async def _execute_training(job: TrainingJob, local: bool = False) -> dict:
    """
    Execute training.

    In local mode (RTX 4060 Mobile, 8 GB VRAM):
      - Smaller batch sizes recommended (<=8)
      - LoRA strongly recommended
      - Simulated for now, but ready for real torch training loop

    In cloud mode (GH200 Neoverse V2, 96 GB HBM3):
      - Full fine-tuning feasible
      - SSH into Vultr node to run training

    TODO: Replace simulation with real training execution.
    """
    gpu_name = "RTX 4060 Mobile (local)" if local else "GH200 Neoverse V2 (cloud)"
    logger.info(
        "Simulating training for job %s on %s — model=%s, epochs=%d, batch=%d",
        job.id, gpu_name, job.base_model, job.max_epochs, job.batch_size,
    )

    if local and job.batch_size > 8 and not job.use_lora:
        logger.warning(
            "Job %s: batch_size=%d on 4060 Mobile without LoRA may OOM. "
            "Consider batch_size<=8 or use_lora=True.",
            job.id, job.batch_size,
        )

    # Simulate training time — faster on local for testing
    if local:
        sim_time = min(job.max_epochs * 1, 15)  # 1s/epoch, cap 15s
    else:
        sim_time = min(job.max_epochs * 2, 30)   # 2s/epoch, cap 30s
    await asyncio.sleep(sim_time)

    # Mock results
    import random
    base_acc = 0.65
    improvement = random.uniform(0.05, 0.25) * min(job.max_epochs / 10, 1.0)
    accuracy = min(base_acc + improvement, 0.98)
    loss = max(0.05, 1.0 - accuracy + random.uniform(-0.05, 0.05))

    return {
        "accuracy": round(accuracy, 4),
        "loss": round(loss, 4),
        "epochs_completed": job.max_epochs,
    }


def _calculate_actual_cost(job: TrainingJob) -> float:
    """Cost based on elapsed time. $0 in local mode."""
    if vultr_gpu.is_local_mode():
        return 0.0
    elapsed_hours = (
        datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
    ).total_seconds() / 3600
    rate = vultr_gpu.GH200_INFO["hourly_rate_usd"]
    return round(rate * elapsed_hours, 2)


async def _cleanup_gpu(job_id: uuid.UUID, db: AsyncSession) -> None:
    """Destroy the GH200 instance if one was provisioned."""
    job = await _load_job(db, job_id)
    if job and job.vultr_instance_id:
        try:
            await vultr_gpu.destroy_instance(job.vultr_instance_id)
        except Exception as exc:
            logger.error(
                "Failed to destroy GH200 instance %s for job %s: %s",
                job.vultr_instance_id, job_id, exc,
            )


async def _fire_webhook(job: TrainingJob) -> None:
    """POST a status update to the job's notify_webhook URL."""
    if not job.notify_webhook:
        return
    payload = {
        "job_id": str(job.id),
        "mission_id": str(job.mission_id),
        "status": job.status.value,
        "accuracy": job.result_accuracy,
        "loss": job.result_loss,
        "error": job.error_message,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(job.notify_webhook, json=payload)
            logger.info("Webhook %s → %d", job.notify_webhook, resp.status_code)
    except Exception as exc:
        logger.warning("Webhook delivery failed for job %s: %s", job.id, exc)
