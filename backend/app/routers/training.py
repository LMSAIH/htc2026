"""
Training router — endpoints for launching training jobs, listing them,
fetching HuggingFace models, and real-time progress/logs via WebSocket.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Annotated
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models.mission import Mission
from app.models.contribution import Contribution, ContributionStatus
from app.models.training_job import TrainingJob, TrainingJobStatus, TrainingTask
from app.models.training_log import TrainingLog
from app.schemas.training import (
    TrainJobRequest,
    TrainingJobResponse,
    TrainingJobListResponse,
    HFModelInfo,
    HFModelListResponse,
    GPUInfo,
    GPUInfoResponse,
    CallbackStatusRequest,
    CallbackCompleteRequest,
    CallbackFailRequest,
    TrainingProgressResponse,
    HeartbeatRequest,
    LogMessage,
    LogEntry,
    LogEntryListResponse,
    NextJobResponse,
    WorkerStatusResponse,
    WorkerActionResponse,
)
from app.services import hf_models, lambda_gpu, training_orchestrator, worker_manager


class ProgressConnectionManager:
    """Manages WebSocket connections for training progress updates."""

    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            for connection in self.active_connections[job_id]:
                await connection.send_json(message)


class LogConnectionManager:
    """Manages WebSocket connections for training log streaming."""

    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
        # Send recent logs from DB on connection
        # TODO: Load and send recent logs

    def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            for connection in self.active_connections[job_id]:
                await connection.send_json(message)


progress_manager = ProgressConnectionManager()
log_manager = LogConnectionManager()

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
    settings = get_settings()

    # 1. Verify mission exists
    mission = (
        await db.execute(select(Mission).where(Mission.id == mission_id))
    ).scalar_one_or_none()
    if not mission:
        raise HTTPException(404, "Mission not found")

    # 2. Check for approved contributions (skip if TRAINING_SKIP_APPROVAL_CHECK=true)
    if not settings.TRAINING_SKIP_APPROVAL_CHECK:
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
    estimated_cost = lambda_gpu.estimate_cost(payload.max_epochs)

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
    await training_orchestrator.launch_training(job.id)

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

    if job.status in (
        TrainingJobStatus.COMPLETED,
        TrainingJobStatus.FAILED,
        TrainingJobStatus.CANCELLED,
    ):
        raise HTTPException(
            400, f"Cannot cancel a job with status '{job.status.value}'"
        )

    if job.vultr_instance_id:
        try:
            await lambda_gpu.destroy_instance(job.vultr_instance_id)
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
    info = lambda_gpu.get_gpu_info()
    mode = lambda_gpu.get_training_mode()
    return GPUInfoResponse(gpu=GPUInfo(**info), mode=mode)


# ── Real-time Training Progress ───────────────────────────────────────────


@router.get(
    "/jobs/{job_id}/progress",
    response_model=TrainingProgressResponse,
    summary="Get real-time training progress",
)
async def get_training_progress(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get current training progress including epoch, batch, loss, accuracy, and ETA."""
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    return TrainingProgressResponse(
        id=job.id,
        mission_id=job.mission_id,
        status=job.status,
        current_epoch=job.current_epoch or 0,
        total_epochs=job.max_epochs,
        current_batch=job.current_batch or 0,
        total_batches=job.total_batches or 0,
        epochs_completed=job.epochs_completed,
        current_loss=job.current_loss,
        current_accuracy=job.current_accuracy,
        eta_seconds=job.eta_seconds,
        updated_at=job.last_progress_at,
    )


@router.websocket("/ws/training/{job_id}")
async def websocket_training_progress(
    job_id: str,
    websocket: WebSocket,
):
    """WebSocket endpoint for real-time training progress updates."""
    await progress_manager.connect(job_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        progress_manager.disconnect(job_id, websocket)


@router.websocket("/ws/logs/{job_id}")
async def websocket_logs(
    job_id: str,
    websocket: WebSocket,
):
    """WebSocket endpoint for real-time training log streaming from worker."""
    await log_manager.connect(job_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        log_manager.disconnect(job_id, websocket)


# ── GPU Worker Callbacks ───────────────────────────────────────────────────────


@router.post(
    "/jobs/{job_id}/callback/status",
    summary="GPU worker reports training progress",
)
async def callback_status(
    job_id: uuid.UUID,
    payload: CallbackStatusRequest,
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    job.status = TrainingJobStatus.TRAINING
    job.epochs_completed = payload.epochs_completed
    job.current_epoch = payload.current_epoch or 0
    job.current_batch = payload.current_batch or 0
    job.total_batches = payload.total_batches or 0
    job.eta_seconds = payload.eta_seconds
    job.last_progress_at = datetime.utcnow()

    if payload.current_loss is not None:
        job.result_loss = payload.current_loss
        job.current_loss = payload.current_loss
    if payload.current_accuracy is not None:
        job.result_accuracy = payload.current_accuracy
        job.current_accuracy = payload.current_accuracy

    await db.commit()

    await progress_manager.broadcast(
        str(job_id),
        {
            "current_epoch": job.current_epoch,
            "total_epochs": job.max_epochs,
            "current_batch": job.current_batch,
            "total_batches": job.total_batches,
            "epochs_completed": job.epochs_completed,
            "current_loss": job.current_loss,
            "current_accuracy": job.current_accuracy,
            "eta_seconds": job.eta_seconds,
        },
    )

    return {"ok": True}


@router.post(
    "/jobs/{job_id}/callback/heartbeat",
    summary="GPU worker reports heartbeat (alive signal)",
)
async def callback_heartbeat(
    job_id: uuid.UUID,
    payload: HeartbeatRequest,
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Update heartbeat timestamp and worker status. No status change, just 'I'm alive'."""
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    job.last_heartbeat_at = datetime.utcnow()
    job.worker_status = payload.worker_status
    if payload.gpu_temp_c is not None:
        job.gpu_temp_c = payload.gpu_temp_c
    if payload.gpu_memory_used_gb is not None:
        job.gpu_memory_used_gb = payload.gpu_memory_used_gb
    if payload.current_epoch is not None:
        job.current_epoch = payload.current_epoch
    if payload.current_batch is not None:
        job.current_batch = payload.current_batch

    await db.commit()

    return {"ok": True}


@router.post(
    "/jobs/{job_id}/callback/log",
    summary="Worker sends structured log entry (WS fallback)",
)
async def callback_log(
    job_id: uuid.UUID,
    payload: LogMessage,
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Receive log entry from worker, store in DB and broadcast to WS clients."""
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    log_entry = TrainingLog(
        job_id=job_id,
        level=payload.level,
        message=payload.message,
        timestamp=payload.timestamp,
        epoch=payload.epoch,
        batch=payload.batch,
    )
    db.add(log_entry)
    await db.commit()

    await log_manager.broadcast(
        str(job_id),
        {
            "level": payload.level,
            "message": payload.message,
            "timestamp": payload.timestamp.isoformat(),
            "epoch": payload.epoch,
            "batch": payload.batch,
        },
    )

    return {"ok": True}


@router.post(
    "/jobs/{job_id}/callback/complete",
    summary="GPU worker reports training completion",
)
async def callback_complete(
    job_id: uuid.UUID,
    payload: CallbackCompleteRequest,
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    job.status = TrainingJobStatus.COMPLETED
    job.result_accuracy = payload.result_accuracy
    job.result_loss = payload.result_loss
    job.epochs_completed = payload.epochs_completed
    job.last_progress_at = datetime.utcnow()

    await db.commit()

    await progress_manager.broadcast(
        str(job_id),
        {
            "status": "completed",
            "epochs_completed": job.epochs_completed,
            "result_accuracy": job.result_accuracy,
            "result_loss": job.result_loss,
        },
    )

    asyncio.create_task(training_orchestrator.cleanup_job(job_id))

    return {"ok": True}


@router.post(
    "/jobs/{job_id}/callback/fail",
    summary="GPU worker reports training failure",
)
async def callback_fail(
    job_id: uuid.UUID,
    payload: CallbackFailRequest,
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    job.status = TrainingJobStatus.FAILED
    job.error_message = payload.error_message
    job.last_progress_at = datetime.utcnow()

    await db.commit()

    await progress_manager.broadcast(
        str(job_id),
        {
            "status": "failed",
            "error_message": payload.error_message,
        },
    )

    asyncio.create_task(training_orchestrator.cleanup_job(job_id))

    return {"ok": True}


@router.delete(
    "/jobs/{job_id}",
    summary="Permanently delete a training job and terminate GPU instance",
)
async def delete_training_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a training job from the database and terminate the GPU instance."""
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    instance_id = job.vultr_instance_id
    await db.delete(job)
    await db.commit()

    if instance_id:
        asyncio.create_task(lambda_gpu.destroy_instance(instance_id))

    return {"ok": True, "message": f"Job {job_id} deleted"}


@router.get(
    "/jobs/{job_id}/logs",
    response_model=LogEntryListResponse,
    summary="Get training logs for a job",
)
async def get_training_logs(
    job_id: uuid.UUID,
    level: str | None = Query(None, description="Filter by log level"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated training logs for a job."""
    result = await db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found")

    query = select(TrainingLog).where(TrainingLog.job_id == job_id)
    count_query = select(func.count(TrainingLog.id)).where(TrainingLog.job_id == job_id)

    if level:
        query = query.where(TrainingLog.level == level.upper())
        count_query = count_query.where(TrainingLog.level == level.upper())

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(TrainingLog.timestamp.desc()).offset(skip).limit(limit)
    )
    logs = result.scalars().all()

    return LogEntryListResponse(
        logs=[LogEntry.model_validate(log) for log in logs],
        total=total,
    )


# ── Persistent Worker Endpoints ───────────────────────────────────────────────


@router.get(
    "/worker/next-job",
    response_model=NextJobResponse,
    responses={204: {"description": "No queued jobs available"}},
    summary="Persistent worker polls for the next queued job",
)
async def worker_next_job(
    x_callback_secret: str = Header(..., alias="X-Callback-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Core polling endpoint for the persistent GPU worker.

    The worker calls this every ~10s. It always records a heartbeat (even when
    idle) and atomically claims the oldest QUEUED job if one exists.
    Returns 204 when the queue is empty.
    """
    settings = get_settings()
    if x_callback_secret != settings.CALLBACK_SECRET:
        raise HTTPException(403, "Invalid callback secret")

    # Always heartbeat — keeps the worker marked as alive
    await worker_manager.worker_heartbeat()

    # Find the oldest QUEUED job
    result = await db.execute(
        select(TrainingJob)
        .where(TrainingJob.status == TrainingJobStatus.QUEUED)
        .order_by(TrainingJob.created_at.asc())
        .limit(1)
    )
    job = result.scalar_one_or_none()

    if job is None:
        await worker_manager.set_worker_idle()
        return Response(status_code=204)

    # Atomically claim the job
    job.status = TrainingJobStatus.TRAINING
    job.last_progress_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)

    await worker_manager.set_worker_busy(str(job.id))

    return NextJobResponse(
        job_id=str(job.id),
        mission_id=str(job.mission_id),
        base_model=job.base_model,
        task=job.task.value,
        max_epochs=job.max_epochs,
        batch_size=job.batch_size,
        learning_rate=job.learning_rate,
        use_lora=job.use_lora,
        target_accuracy=job.target_accuracy,
        training_mode=settings.WORKER_TRAINING_MODE,
        dataset_path=job.dataset_path or f"missions/{job.mission_id}/contributions/",
    )


@router.post(
    "/workers/start",
    response_model=WorkerActionResponse,
    summary="Start the persistent GPU worker (launches Lambda H100)",
)
async def start_worker():
    try:
        result = await worker_manager.start_worker()
        return WorkerActionResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))


@router.post(
    "/workers/stop",
    response_model=WorkerActionResponse,
    summary="Stop the persistent GPU worker (terminates Lambda instance)",
)
async def stop_worker():
    try:
        result = await worker_manager.stop_worker()
        return WorkerActionResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))


@router.get(
    "/workers/status",
    response_model=WorkerStatusResponse,
    summary="Get persistent worker status",
)
async def get_worker_status():
    result = await worker_manager.get_status()
    return WorkerStatusResponse(**result)


@router.post(
    "/workers/refresh",
    response_model=WorkerActionResponse,
    summary="Pull latest Docker image and restart the persistent worker container",
)
async def refresh_worker():
    try:
        result = await worker_manager.refresh_image()
        return WorkerActionResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))
