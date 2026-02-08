"""
Vultr Cloud GPU service — provision, poll, and destroy Cloud GPU instances
via the Vultr v2 REST API (https://www.vultr.com/api/#tag/instances).

GPU Provisioning: Creates an A100 Cloud GPU instance with a cloud-init startup
script that runs the gpu-worker Docker container. The container handles actual
training and reports back to the API via HTTP callbacks.
"""

import asyncio
import base64
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

VULTR_BASE = "https://api.vultr.com/v2"

VULTR_OS_ID = 2284

CLOUD_GPU_INFO = {
    "name": "NVIDIA A100 Cloud GPU",
    "plan": "vcg-a100-2c-15g-10vram",
    "hourly_rate_usd": 0.342,
    "gpu_memory_gb": 10,
    "cpu_memory_gb": 15,
    "description": (
        "NVIDIA A100 — 10 GB VRAM, 15 GB RAM, 2 vCPU. Cloud GPU in ewr. $0.342/hr."
    ),
}

LOCAL_4060_INFO = {
    "name": "NVIDIA RTX 4060 Mobile (local)",
    "plan": "local",
    "hourly_rate_usd": 0.0,
    "gpu_memory_gb": 8,
    "cpu_memory_gb": 0,
    "description": (
        "NVIDIA RTX 4060 Mobile — 8 GB GDDR6, Ada Lovelace architecture. "
        "Local testing GPU. Use small batch sizes and LoRA for memory efficiency. "
        "Not suitable for large models or full fine-tuning."
    ),
}


def _build_startup_script(
    job_id: str,
    base_model: str,
    task: str,
    max_epochs: int,
    batch_size: int,
    learning_rate: float,
    use_lora: bool,
    target_accuracy: float | None,
    api_callback_url: str,
    callback_secret: str,
) -> str:
    """
    Generate a cloud-init bash script that:
    1. Docker login to Vultr registry
    2. Docker pull the gpu-worker image
    3. Docker run with all job config as environment variables

    The gpu-worker container runs training and reports back via callbacks.
    """
    registry_url = settings.VULTR_REGISTRY_URL
    registry_user = settings.VULTR_REGISTRY_USERNAME
    registry_pass = settings.VULTR_REGISTRY_PASSWORD
    image = settings.GPU_WORKER_IMAGE

    target_acc_str = f"{target_accuracy}" if target_accuracy else ""

    script = f'''#!/bin/bash
set -e

# Log startup
echo "===== DataForAll GPU Worker Starting ====="
echo "Job ID: {job_id}"
echo "Base Model: {base_model}"
echo "Task: {task}"
echo "Max Epochs: {max_epochs}"

# Wait for Docker to be ready
echo "Waiting for Docker..."
while ! docker info >/dev/null 2>&1; do
    sleep 1
done
echo "Docker is ready"

# Docker login to Vultr registry
echo "Logging into Vultr container registry..."
echo "{registry_pass}" | docker login {registry_url} -u {registry_user} --password-stdin

# Pull the gpu-worker image
echo "Pulling gpu-worker image..."
docker pull {image}

# Run the training container with all config as environment variables
echo "Starting training container..."
docker run --rm --gpus all \
    -e JOB_ID={job_id} \
    -e API_CALLBACK_URL={api_callback_url} \
    -e CALLBACK_SECRET={callback_secret} \
    -e BASE_MODEL={base_model} \
    -e TASK={task} \
    -e MAX_EPOCHS={max_epochs} \
    -e BATCH_SIZE={batch_size} \
    -e LEARNING_RATE={learning_rate} \
    -e USE_LORA={"true" if use_lora else "false"} \
    -e TARGET_ACCURACY={target_acc_str} \
    -e TRAINING_MODE=simulated \
    {image}

echo "===== GPU Worker Exiting ====="
'''
    return script


async def create_gpu_instance(
    label: str = "dataforall-training",
    region: str | None = None,
    job_id: str | None = None,
    base_model: str | None = None,
    task: str | None = None,
    max_epochs: int | None = None,
    batch_size: int | None = None,
    learning_rate: float | None = None,
    use_lora: bool | None = None,
    target_accuracy: float | None = None,
    api_callback_url: str | None = None,
    callback_secret: str | None = None,
) -> dict[str, Any]:
    """
    Provision a Cloud GPU instance on Vultr.
    If job parameters are provided, includes a cloud-init startup script
    that runs the gpu-worker Docker container.

    Returns the raw Vultr API response body (contains 'instance' key).
    """
    startup_script = None
    if job_id and base_model and task and api_callback_url and callback_secret:
        assert job_id is not None
        assert base_model is not None
        assert task is not None
        assert api_callback_url is not None
        assert callback_secret is not None
        startup_script = _build_startup_script(
            job_id=job_id,
            base_model=base_model,
            task=task,
            max_epochs=max_epochs or 10,
            batch_size=batch_size or 16,
            learning_rate=learning_rate or 3e-4,
            use_lora=use_lora if use_lora is not None else True,
            target_accuracy=target_accuracy,
            api_callback_url=api_callback_url,
            callback_secret=callback_secret,
        )
        logger.info("Generated startup script for job %s", job_id)

    payload = {
        "region": region or settings.VULTR_DEFAULT_REGION,
        "plan": CLOUD_GPU_INFO["plan"],
        "os_id": VULTR_OS_ID,
        "label": label,
        "tags": ["dataforall", "training"],
        "enable_ipv6": False,
        "user_data": base64.b64encode(startup_script.encode()).decode()
        if startup_script
        else "",
    }
    if settings.VULTR_SSH_KEY_ID:
        payload["sshkey_id"] = [settings.VULTR_SSH_KEY_ID]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{VULTR_BASE}/instances",
            headers=_headers(),
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error("Vultr API error %d: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        data = resp.json()
        logger.info(
            "Vultr Cloud GPU instance created: %s", data.get("instance", {}).get("id")
        )
        return data


async def get_instance(instance_id: str) -> dict[str, Any]:
    """Get info about a Cloud GPU instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{VULTR_BASE}/instances/{instance_id}",
            headers=_headers(),
        )
        if resp.status_code >= 400:
            logger.error("Vultr API error %d: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        return resp.json()


async def wait_for_instance_active(
    instance_id: str,
    timeout_seconds: int = 600,
    poll_interval: int = 15,
) -> dict[str, Any]:
    """
    Poll Vultr until the Cloud GPU instance reaches 'active' status.
    Returns instance info dict or raises TimeoutError.
    """
    elapsed = 0
    while elapsed < timeout_seconds:
        data = await get_instance(instance_id)
        inst = data.get("instance", {})
        status = inst.get("status", "")
        power = inst.get("power_status", "")
        logger.info(
            "Vultr Cloud GPU %s — status=%s power=%s (waited %ds)",
            instance_id,
            status,
            power,
            elapsed,
        )
        if status == "active" and power == "running":
            return data
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(
        f"Vultr Cloud GPU instance {instance_id} did not become active within {timeout_seconds}s"
    )


async def destroy_instance(instance_id: str) -> None:
    """Terminate and delete a Cloud GPU instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{VULTR_BASE}/instances/{instance_id}",
            headers=_headers(),
        )
        if resp.status_code == 204:
            logger.info("Vultr Cloud GPU instance %s destroyed", instance_id)
        else:
            logger.error("Vultr destroy error %d: %s", resp.status_code, resp.text)


def estimate_cost(max_epochs: int, approx_hours: float = 1.0) -> float:
    """Rough cost estimate. $0 in local mode."""
    if is_local_mode():
        return 0.0
    return round(CLOUD_GPU_INFO["hourly_rate_usd"] * approx_hours, 2)


def get_gpu_info() -> dict[str, Any]:
    """Return info about the active GPU (local 4060 or Cloud GPU A100)."""
    if is_local_mode():
        return dict(LOCAL_4060_INFO)
    return dict(CLOUD_GPU_INFO)


def get_training_mode() -> str:
    """Return current training mode string."""
    return "local" if is_local_mode() else "vultr"


def is_local_mode() -> bool:
    """Check if we're running in local testing mode."""
    return settings.TRAINING_MODE.lower() == "local"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.VULTR_API_KEY}",
        "Content-Type": "application/json",
    }
