"""
Lambda Labs GPU service — provision, poll, and destroy GPU instances
via the Lambda Labs REST API (https://cloud.lambdalabs.com/api/v1).

GPU Provisioning: Launches a Lambda GPU instance, waits for it to become
active, then SSHes in via paramiko to pull and run the gpu-worker Docker
container. The container handles actual training and reports back to the
API via HTTP callbacks.

Key difference from Vultr: Lambda does NOT support cloud-init / user_data.
We must SSH into the instance after boot to deliver the startup commands.
"""

import asyncio
import io
import logging
from typing import Any

import httpx
import paramiko

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

LAMBDA_BASE = "https://cloud.lambdalabs.com/api/v1"

LAMBDA_GPU_INFO = {
    "name": "NVIDIA A10 (Lambda Labs)",
    "plan": "gpu_1x_a10",
    "hourly_rate_usd": 0.75,
    "gpu_memory_gb": 24,
    "cpu_memory_gb": 0,
    "description": (
        "NVIDIA A10 — 24 GB VRAM, Lambda Labs cloud. $0.75/hr. "
        "Good for LoRA fine-tuning of models up to 7B parameters."
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


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.LAMBDA_API_KEY}",
        "Content-Type": "application/json",
    }


def _build_startup_commands(
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
    Build a shell script string to run on the Lambda instance via SSH.
    Same logic as the Vultr cloud-init script, but executed over SSH.
    """
    registry_url = settings.VULTR_REGISTRY_URL
    registry_user = settings.VULTR_REGISTRY_USERNAME
    registry_pass = settings.VULTR_REGISTRY_PASSWORD
    image = settings.GPU_WORKER_IMAGE
    target_acc_str = f"{target_accuracy}" if target_accuracy else ""

    script = f'''set -e

echo "===== DataForAll GPU Worker Starting ====="
echo "Job ID: {job_id}"
echo "Base Model: {base_model}"
echo "Task: {task}"
echo "Max Epochs: {max_epochs}"

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

# Run the training container with all config as environment variables
echo "Starting training container..."
nohup docker run --rm --gpus all \
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
    {image} > /tmp/gpu-worker.log 2>&1 &

echo "===== GPU Worker launched in background ====="
'''
    return script


def _ssh_execute(ip: str, script: str, timeout: int = 120) -> str:
    """
    SSH into a Lambda instance and execute a script.
    Uses paramiko with the SSH private key from config.
    Returns the combined stdout output.
    """
    key_path = settings.LAMBDA_SSH_PRIVATE_KEY_PATH

    # Load the SSH private key
    try:
        pkey = paramiko.Ed25519Key.from_private_key_file(key_path)
    except Exception:
        # Try RSA as fallback
        pkey = paramiko.RSAKey.from_private_key_file(key_path)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        logger.info("SSH connecting to %s as ubuntu...", ip)
        client.connect(
            hostname=ip,
            port=22,
            username="ubuntu",
            pkey=pkey,
            timeout=30,
            banner_timeout=30,
            auth_timeout=30,
        )

        logger.info("SSH connected, executing startup script...")
        stdin, stdout, stderr = client.exec_command(
            f"bash -c '{script}'",
            timeout=timeout,
        )
        output = stdout.read().decode("utf-8", errors="replace")
        errors = stderr.read().decode("utf-8", errors="replace")

        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            logger.error("SSH command failed (exit %d): %s", exit_code, errors)
            raise RuntimeError(
                f"SSH script failed with exit code {exit_code}: {errors[:500]}"
            )

        logger.info("SSH script executed successfully on %s", ip)
        return output

    finally:
        client.close()


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
    Provision a GPU instance on Lambda Labs.
    If job parameters are provided, SSHes into the instance after boot
    to pull and run the gpu-worker Docker container.

    Returns dict matching Vultr format: {"instance": {"id": ..., "main_ip": ...}}
    """
    # 1. Launch instance via Lambda API
    payload = {
        "region_name": region or settings.LAMBDA_DEFAULT_REGION,
        "instance_type_name": settings.LAMBDA_DEFAULT_INSTANCE_TYPE,
        "ssh_key_names": [settings.LAMBDA_SSH_KEY_NAME],
        "file_system_names": [],
        "quantity": 1,
        "name": label,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{LAMBDA_BASE}/instance-operations/launch",
            headers=_headers(),
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error("Lambda API error %d: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        launch_data = resp.json()

    instance_ids = launch_data.get("data", {}).get("instance_ids", [])
    if not instance_ids:
        raise RuntimeError(f"Lambda launch returned no instance IDs: {launch_data}")

    instance_id = instance_ids[0]
    logger.info("Lambda GPU instance launched: %s", instance_id)

    # 2. Wait for instance to become active
    instance_info = await wait_for_instance_active(instance_id)
    instance_ip = instance_info.get("data", {}).get("ip", "")

    logger.info("Lambda instance %s is active at %s", instance_id, instance_ip)

    # 3. SSH in and run the startup script (if job params provided)
    if job_id and base_model and task and api_callback_url and callback_secret:
        script = _build_startup_commands(
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

        # SSH can block — run in a thread
        # Retry SSH a few times since instance may not be ready for SSH immediately
        max_ssh_retries = 5
        for attempt in range(max_ssh_retries):
            try:
                await asyncio.to_thread(_ssh_execute, instance_ip, script)
                break
            except Exception as exc:
                if attempt < max_ssh_retries - 1:
                    logger.warning(
                        "SSH attempt %d/%d failed for %s: %s — retrying in 15s",
                        attempt + 1,
                        max_ssh_retries,
                        instance_ip,
                        exc,
                    )
                    await asyncio.sleep(15)
                else:
                    logger.error("All SSH attempts failed for %s", instance_ip)
                    # Destroy the instance so we don't leak it
                    await destroy_instance(instance_id)
                    raise RuntimeError(
                        f"Failed to SSH into Lambda instance {instance_id} after "
                        f"{max_ssh_retries} attempts: {exc}"
                    )

    # 4. Return in Vultr-compatible format for the orchestrator
    return {
        "instance": {
            "id": instance_id,
            "main_ip": instance_ip,
        }
    }


async def get_instance(instance_id: str) -> dict[str, Any]:
    """Get info about a Lambda GPU instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{LAMBDA_BASE}/instances/{instance_id}",
            headers=_headers(),
        )
        if resp.status_code >= 400:
            logger.error("Lambda API error %d: %s", resp.status_code, resp.text)
        resp.raise_for_status()
        return resp.json()


async def wait_for_instance_active(
    instance_id: str,
    timeout_seconds: int = 600,
    poll_interval: int = 15,
) -> dict[str, Any]:
    """
    Poll Lambda until the instance reaches 'active' status.
    Returns instance info dict or raises TimeoutError.
    """
    elapsed = 0
    while elapsed < timeout_seconds:
        data = await get_instance(instance_id)
        inst = data.get("data", {})
        status = inst.get("status", "")
        ip = inst.get("ip", "")

        logger.info(
            "Lambda GPU %s — status=%s ip=%s (waited %ds)",
            instance_id,
            status,
            ip,
            elapsed,
        )

        if status == "active" and ip:
            return data

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(
        f"Lambda GPU instance {instance_id} did not become active within {timeout_seconds}s"
    )


async def destroy_instance(instance_id: str) -> None:
    """Terminate a Lambda GPU instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{LAMBDA_BASE}/instance-operations/terminate",
            headers=_headers(),
            json={"instance_ids": [instance_id]},
        )
        if resp.status_code < 300:
            logger.info("Lambda GPU instance %s terminated", instance_id)
        else:
            logger.error("Lambda terminate error %d: %s", resp.status_code, resp.text)


def estimate_cost(max_epochs: int, approx_hours: float = 1.0) -> float:
    """Rough cost estimate. $0 in local mode."""
    if is_local_mode():
        return 0.0
    return round(LAMBDA_GPU_INFO["hourly_rate_usd"] * approx_hours, 2)


def get_gpu_info() -> dict[str, Any]:
    """Return info about the active GPU (local 4060 or Lambda A10)."""
    if is_local_mode():
        return dict(LOCAL_4060_INFO)
    return dict(LAMBDA_GPU_INFO)


def get_training_mode() -> str:
    """Return current training mode string."""
    return "local" if is_local_mode() else "lambda"


def is_local_mode() -> bool:
    """Check if we're running in local testing mode."""
    return settings.TRAINING_MODE.lower() == "local"
