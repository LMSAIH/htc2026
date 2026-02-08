"""
Persistent GPU Worker Manager — manages a long-lived Lambda H100 instance
that polls for training jobs instead of spinning up a new instance per job.

Lifecycle:
  start_worker()  → Launch Lambda instance, SSH in, start container in polling mode
  stop_worker()   → Terminate the Lambda instance
  get_status()    → Combine Lambda API + DB last_seen for health check
  refresh_image() → SSH into running instance, docker pull + restart container
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal as async_session_maker
from app.core.config import get_settings
from app.models.persistent_worker import PersistentWorker, WorkerStatus
from app.services import lambda_gpu

logger = logging.getLogger(__name__)

settings = get_settings()

# Consider worker offline if no heartbeat for this long
WORKER_OFFLINE_TIMEOUT_SECONDS = 120


def _build_persistent_startup_script() -> str:
    """
    Build a shell script that starts the gpu-worker container in persistent
    polling mode. Unlike the per-job script, this does NOT set job-specific
    env vars (JOB_ID, BASE_MODEL, etc.) — the worker fetches those by
    polling GET /api/training/worker/next-job.
    """
    registry_url = settings.VULTR_REGISTRY_URL
    registry_user = settings.VULTR_REGISTRY_USERNAME
    registry_pass = settings.VULTR_REGISTRY_PASSWORD
    image = settings.GPU_WORKER_IMAGE

    script = f'''set -e

echo "===== DataForAll Persistent GPU Worker Starting ====="

# Wait for Docker to be ready
echo "Waiting for Docker..."
for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
done
echo "Docker is ready"

# Docker login to Vultr registry
echo "Logging into Vultr container registry..."
echo "{registry_pass}" | docker login {registry_url} -u {registry_user} --password-stdin

# Pull the gpu-worker image
echo "Pulling gpu-worker image..."
docker pull {image}

# Stop any existing worker container
docker stop dfa-persistent-worker 2>/dev/null || true
docker rm dfa-persistent-worker 2>/dev/null || true

# Run the worker container in persistent polling mode
echo "Starting persistent worker container..."
nohup docker run --gpus all \
    --name dfa-persistent-worker \
    --restart unless-stopped \
    -e WORKER_MODE=persistent \
    -e API_BASE_URL={settings.API_BASE_URL} \
    -e CALLBACK_SECRET={settings.CALLBACK_SECRET} \
    -e S3_ENDPOINT_URL={settings.S3_ENDPOINT_URL} \
    -e S3_ACCESS_KEY={settings.S3_ACCESS_KEY} \
    -e S3_SECRET_KEY={settings.S3_SECRET_KEY} \
    -e S3_BUCKET_NAME={settings.S3_BUCKET_NAME} \
    -e HF_TOKEN={settings.HF_TOKEN} \
    -e TRAINING_MODE={settings.WORKER_TRAINING_MODE} \
    {image} > /tmp/gpu-worker.log 2>&1 &

echo "===== Persistent GPU Worker launched ====="
'''
    return script


def _build_refresh_script() -> str:
    """
    Build a script to pull the latest Docker image and restart the container.
    """
    registry_url = settings.VULTR_REGISTRY_URL
    registry_user = settings.VULTR_REGISTRY_USERNAME
    registry_pass = settings.VULTR_REGISTRY_PASSWORD
    image = settings.GPU_WORKER_IMAGE

    script = f'''set -e

echo "===== Refreshing GPU Worker Image ====="

# Docker login
echo "{registry_pass}" | docker login {registry_url} -u {registry_user} --password-stdin

# Pull latest image
echo "Pulling latest image..."
docker pull {image}

# Stop existing container
echo "Stopping existing container..."
docker stop dfa-persistent-worker 2>/dev/null || true
docker rm dfa-persistent-worker 2>/dev/null || true

# Restart with new image
echo "Restarting with new image..."
nohup docker run --gpus all \
    --name dfa-persistent-worker \
    --restart unless-stopped \
    -e WORKER_MODE=persistent \
    -e API_BASE_URL={settings.API_BASE_URL} \
    -e CALLBACK_SECRET={settings.CALLBACK_SECRET} \
    -e S3_ENDPOINT_URL={settings.S3_ENDPOINT_URL} \
    -e S3_ACCESS_KEY={settings.S3_ACCESS_KEY} \
    -e S3_SECRET_KEY={settings.S3_SECRET_KEY} \
    -e S3_BUCKET_NAME={settings.S3_BUCKET_NAME} \
    -e HF_TOKEN={settings.HF_TOKEN} \
    -e TRAINING_MODE={settings.WORKER_TRAINING_MODE} \
    {image} > /tmp/gpu-worker.log 2>&1 &

echo "===== GPU Worker refreshed ====="
'''
    return script


async def _get_active_worker(db: AsyncSession) -> Optional[PersistentWorker]:
    """Get the most recently created non-terminated worker."""
    result = await db.execute(
        select(PersistentWorker)
        .where(PersistentWorker.status != WorkerStatus.terminated)
        .order_by(desc(PersistentWorker.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def start_worker() -> dict[str, Any]:
    """
    Launch a persistent GPU worker on Lambda Labs.
    Returns worker info dict.
    """
    async with async_session_maker() as db:
        # Check if there's already an active worker
        existing = await _get_active_worker(db)
        if existing:
            # Verify the Lambda instance is actually running
            instance_still_exists_and_running = False
            if existing.lambda_instance_id:
                try:
                    instance_info = await lambda_gpu.get_instance(
                        existing.lambda_instance_id
                    )
                    lambda_status = instance_info.get("data", {}).get("status", "")
                    if lambda_status == "running":
                        instance_still_exists_and_running = True
                except Exception:
                    # Instance doesn't exist or API unreachable - treat as not running
                    pass

            if instance_still_exists_and_running:
                raise RuntimeError(
                    f"A persistent worker is already active: {existing.id} "
                    f"(status={existing.status.value}, instance={existing.lambda_instance_id}). "
                    f"Stop it first with POST /api/training/workers/stop"
                )
            else:
                # Stale worker record - Lambda instance is gone or not running
                # Delete the stale record so we can start fresh
                logger.warning(
                    "Found stale worker record %s (Lambda instance %s not running). "
                    "Deleting stale record and proceeding with new worker.",
                    existing.id,
                    existing.lambda_instance_id,
                )
                await db.delete(existing)
                await db.commit()

        logger.info("Starting persistent GPU worker...")

        # Launch Lambda instance (no job params — just get the instance)
        instance_data = await lambda_gpu.create_gpu_instance(
            label="dfa-persistent-worker",
        )

        instance_id = instance_data["instance"]["id"]
        instance_ip = instance_data["instance"]["main_ip"]

        logger.info(
            "Lambda instance %s active at %s, SSHing to start persistent worker...",
            instance_id,
            instance_ip,
        )

        # SSH in and start the persistent worker container
        script = _build_persistent_startup_script()
        max_ssh_retries = 5
        for attempt in range(max_ssh_retries):
            try:
                await asyncio.to_thread(lambda_gpu._ssh_execute, instance_ip, script)
                break
            except Exception as exc:
                if attempt < max_ssh_retries - 1:
                    logger.warning(
                        "SSH attempt %d/%d failed: %s — retrying in 15s",
                        attempt + 1,
                        max_ssh_retries,
                        exc,
                    )
                    await asyncio.sleep(15)
                else:
                    # Destroy instance to avoid leak
                    await lambda_gpu.destroy_instance(instance_id)
                    raise RuntimeError(
                        f"Failed to SSH into instance {instance_id} after "
                        f"{max_ssh_retries} attempts: {exc}"
                    )

        # Create DB record
        worker = PersistentWorker(
            lambda_instance_id=instance_id,
            ip=instance_ip,
            status=WorkerStatus.starting,
        )
        db.add(worker)
        await db.commit()
        await db.refresh(worker)

        logger.info(
            "Persistent worker %s created (instance=%s)", worker.id, instance_id
        )

        return {
            "worker_id": str(worker.id),
            "lambda_instance_id": instance_id,
            "ip": instance_ip,
            "status": worker.status.value,
            "message": "Persistent worker launched. It will appear online once it starts polling.",
        }


async def stop_worker() -> dict[str, Any]:
    """
    Stop the active persistent worker by terminating its Lambda instance.
    """
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if not worker:
            raise RuntimeError("No active persistent worker found.")

        logger.info(
            "Stopping persistent worker %s (instance=%s)...",
            worker.id,
            worker.lambda_instance_id,
        )

        # Terminate the Lambda instance
        try:
            await lambda_gpu.destroy_instance(worker.lambda_instance_id)
        except Exception as exc:
            logger.error("Failed to terminate Lambda instance: %s", exc)
            # Still mark as terminated in DB

        worker.status = WorkerStatus.terminated
        await db.commit()

        logger.info("Persistent worker %s terminated", worker.id)

        return {
            "worker_id": str(worker.id),
            "status": "terminated",
            "message": "Persistent worker terminated.",
        }


async def get_status() -> dict[str, Any]:
    """
    Get the current status of the persistent worker.
    Combines DB record + Lambda API instance status + heartbeat freshness.
    """
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if not worker:
            return {
                "active": False,
                "status": "no_worker",
                "message": "No active persistent worker. Start one with POST /api/training/workers/start",
            }

        # Check Lambda instance status
        lambda_status = "unknown"
        try:
            instance_info = await lambda_gpu.get_instance(worker.lambda_instance_id)
            lambda_status = instance_info.get("data", {}).get("status", "unknown")
        except Exception as exc:
            logger.warning("Failed to check Lambda instance status: %s", exc)
            lambda_status = "unreachable"

        # Check heartbeat freshness
        heartbeat_age = None
        now = datetime.now(timezone.utc)
        if worker.last_seen_at:
            last_seen = (
                worker.last_seen_at.replace(tzinfo=timezone.utc)
                if worker.last_seen_at.tzinfo is None
                else worker.last_seen_at
            )
            heartbeat_age = (now - last_seen).total_seconds()
            if heartbeat_age > WORKER_OFFLINE_TIMEOUT_SECONDS:
                # Worker hasn't reported in — mark offline if it was online/busy
                if worker.status in (WorkerStatus.online, WorkerStatus.busy):
                    worker.status = WorkerStatus.offline
                    await db.commit()

        return {
            "active": True,
            "worker_id": str(worker.id),
            "lambda_instance_id": worker.lambda_instance_id,
            "ip": worker.ip,
            "status": worker.status.value,
            "lambda_status": lambda_status,
            "last_seen_at": worker.last_seen_at.isoformat()
            if worker.last_seen_at
            else None,
            "heartbeat_age_seconds": round(heartbeat_age, 1) if heartbeat_age else None,
            "current_job_id": str(worker.current_job_id)
            if worker.current_job_id
            else None,
            "created_at": worker.created_at.isoformat(),
            "hourly_cost_usd": lambda_gpu.LAMBDA_GPU_INFO["hourly_rate_usd"],
        }


async def refresh_image() -> dict[str, Any]:
    """
    SSH into the running persistent worker instance, pull latest Docker image,
    and restart the container.
    """
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if not worker:
            raise RuntimeError("No active persistent worker found.")

        if not worker.ip:
            raise RuntimeError("Worker has no IP address recorded.")

        logger.info("Refreshing worker image on %s...", worker.ip)

        script = _build_refresh_script()
        await asyncio.to_thread(lambda_gpu._ssh_execute, worker.ip, script)

        # Mark as starting — it'll come back online when it starts polling
        worker.status = WorkerStatus.starting
        await db.commit()

        logger.info("Worker image refreshed, waiting for worker to come back online...")

        return {
            "worker_id": str(worker.id),
            "status": "starting",
            "message": "Image pulled and container restarted. Worker will appear online shortly.",
        }


async def worker_heartbeat(worker_id: Optional[str] = None) -> None:
    """
    Called when the persistent worker checks in (polls for next job).
    Updates last_seen_at and status.
    """
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if worker:
            worker.last_seen_at = datetime.utcnow()
            if worker.status in (WorkerStatus.starting, WorkerStatus.offline):
                worker.status = WorkerStatus.online
            await db.commit()


async def set_worker_busy(job_id: str) -> None:
    """Mark the worker as busy with a specific job."""
    import uuid as _uuid

    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if worker:
            worker.status = WorkerStatus.busy
            worker.current_job_id = _uuid.UUID(job_id)
            await db.commit()


async def set_worker_idle() -> None:
    """Mark the worker as idle (online, no current job)."""
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if worker:
            worker.status = WorkerStatus.online
            worker.current_job_id = None
            await db.commit()


async def get_persistent_instance_id() -> Optional[str]:
    """Return the Lambda instance ID of the active persistent worker, or None."""
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if worker:
            return worker.lambda_instance_id
        return None


async def is_worker_online() -> bool:
    """Check if there's a persistent worker that's online or busy."""
    async with async_session_maker() as db:
        worker = await _get_active_worker(db)
        if not worker:
            return False
        if worker.status in (WorkerStatus.online, WorkerStatus.busy):
            # Double-check heartbeat freshness
            if worker.last_seen_at:
                age = (datetime.utcnow() - worker.last_seen_at).total_seconds()
                return age < WORKER_OFFLINE_TIMEOUT_SECONDS
        return False
