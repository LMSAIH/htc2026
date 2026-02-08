"""
Training router — endpoints for launching training jobs, listing them,
fetching HuggingFace models, and GH200 GPU info.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.mission import Mission
from app.models.contribution import Contribution, ContributionStatus
from app.models.training_job import TrainingJob, TrainingJobStatus, TrainingTask
from app.schemas.training import (
    TrainJobRequest,
    TrainingJobResponse,
    TrainingJobListResponse,
    HFModelInfo,
    HFModelListResponse,
    GPUInfo,
    GPUInfoResponse,
)
from app.services import hf_models, vultr_gpu, training_orchestrator

router = APIRouter(prefix="/training", tags=["training"])


# ── Launch a training job ────────────────────────────────────────────────────

@router.post(
    "/missions/{mission_id}/train",
    response_model=TrainingJobResponse,
    status_code=202,
    summary="Launch a model training job on a GH200 for a mission",
)
async def start_training(
    mission_id: uuid.UUID,
    payload: TrainJobRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify mission exists
    mission = (
        await db.execute(select(Mission).where(Mission.id == mission_id))
    ).scalar_one_or_none()
    if not mission:
        raise HTTPException(404, "Mission not found")

    # 2. Check for approved contributions
    approved_count = sum(
        1
        for c in (mission.contributions or [])
        if c.status == ContributionStatus.APPROVED
    )
    if approved_count == 0:
        raise HTTPException(
            400,
            "Mission has no approved contributions to train on. "
            "Upload and approve data first.",
        )

    # 3. Resolve base model (auto-pick if not provided)
    base_model = hf_models.resolve_base_model(payload.task, payload.base_model)

    # 4. Estimate cost
    estimated_cost = vultr_gpu.estimate_cost(payload.max_epochs)

    # 5. Create the TrainingJob row
    job = TrainingJob(
        mission_id=mission_id,
        task=payload.task,
        base_model=base_model,
        max_epochs=payload.max_epochs,
        batch_size=payload.batch_size,
        learning_rate=payload.learning_rate,
        use_lora=payload.use_lora,
        target_accuracy=payload.target_accuracy,
        notify_webhook=payload.notify_webhook,
        estimated_cost_usd=estimated_cost,
        dataset_path=f"missions/{mission_id}/contributions/",
        status=TrainingJobStatus.QUEUED,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # 6. Kick off background training pipeline
    training_orchestrator.launch_training(job.id)

    return TrainingJobResponse.model_validate(job)


# ── Get a specific training job ──────────────────────────────────────────────

@router.get(
    "/jobs/{job_id}",
    response_model=TrainingJobResponse,
    summary="Get training job status",
)
async def get_training_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")
    return TrainingJobResponse.model_validate(job)


# ── List training jobs for a mission ─────────────────────────────────────────

@router.get(
    "/missions/{mission_id}/jobs",
    response_model=TrainingJobListResponse,
    summary="List all training jobs for a mission",
)
async def list_training_jobs(
    mission_id: uuid.UUID,
    status: TrainingJobStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(TrainingJob).where(TrainingJob.mission_id == mission_id)
    count_query = select(func.count(TrainingJob.id)).where(
        TrainingJob.mission_id == mission_id
    )

    if status:
        query = query.where(TrainingJob.status == status)
        count_query = count_query.where(TrainingJob.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(TrainingJob.created_at.desc()).offset(skip).limit(limit)
    )
    jobs = result.scalars().all()

    return TrainingJobListResponse(
        jobs=[TrainingJobResponse.model_validate(j) for j in jobs],
        total=total,
    )


# ── Cancel a training job ────────────────────────────────────────────────────

@router.post(
    "/jobs/{job_id}/cancel",
    response_model=TrainingJobResponse,
    summary="Cancel a queued or running training job",
)
async def cancel_training_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    if job.status in (TrainingJobStatus.COMPLETED, TrainingJobStatus.FAILED, TrainingJobStatus.CANCELLED):
        raise HTTPException(400, f"Cannot cancel a job with status '{job.status.value}'")

    if job.vultr_instance_id:
        try:
            await vultr_gpu.destroy_instance(job.vultr_instance_id)
        except Exception:
            pass  # best-effort cleanup

    job.status = TrainingJobStatus.CANCELLED
    job.error_message = "Cancelled by user"
    await db.flush()
    await db.refresh(job)

    return TrainingJobResponse.model_validate(job)


# ── Browse HuggingFace models by task ────────────────────────────────────────

@router.get(
    "/models",
    response_model=HFModelListResponse,
    summary="List HuggingFace models available for a task",
)
async def list_hf_models(
    task: TrainingTask,
    limit: int = Query(20, ge=1, le=50),
):
    models = await hf_models.list_models_for_task(task, limit=limit)
    return HFModelListResponse(
        models=[HFModelInfo(**m) for m in models],
        total=len(models),
        task_filter=task.value,
    )


# ── GPU info ─────────────────────────────────────────────────────────────────

@router.get(
    "/gpu-info",
    response_model=GPUInfoResponse,
    summary="Get active GPU specs, pricing, and training mode",
)
async def get_gpu_info():
    info = vultr_gpu.get_gpu_info()
    mode = vultr_gpu.get_training_mode()
    return GPUInfoResponse(gpu=GPUInfo(**info), mode=mode)
