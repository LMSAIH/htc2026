"""
Vultr Cloud GPU service — provision, poll, and destroy NVIDIA GH200 bare-metal
instances via the Vultr v2 REST API (https://www.vultr.com/api/#tag/baremetal).

Production GPU: NVIDIA GH200 (ARM Neoverse V2 CPU + H100 GPU, 96 GB HBM3).
Local testing:  NVIDIA RTX 4060 Mobile (8 GB GDDR6) — no Vultr provisioning.

Set TRAINING_MODE=local in .env to run training on the local 4060 Mobile.
Set TRAINING_MODE=vultr to provision a GH200 on Vultr Cloud.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

VULTR_BASE = "https://api.vultr.com/v2"

# ── GPU specifications ───────────────────────────────────────────────────────

GH200_INFO = {
    "name": "NVIDIA GH200 (Neoverse V2)",
    "plan": "vcg-a18-16c-128g-3200s-gh200",
    "hourly_rate_usd": 2.72,
    "gpu_memory_gb": 96,      # 96 GB HBM3
    "cpu_memory_gb": 480,     # 480 GB LPDDR5X (ARM Neoverse V2)
    "description": (
        "NVIDIA GH200 — H100-class GPU with 96 GB HBM3 + 72-core ARM Neoverse V2 "
        "CPU with 480 GB LPDDR5X. Production GPU for large model fine-tuning, "
        "full training runs, and inference."
    ),
}

LOCAL_4060_INFO = {
    "name": "NVIDIA RTX 4060 Mobile (local)",
    "plan": "local",
    "hourly_rate_usd": 0.0,
    "gpu_memory_gb": 8,       # 8 GB GDDR6
    "cpu_memory_gb": 0,       # depends on host machine
    "description": (
        "NVIDIA RTX 4060 Mobile — 8 GB GDDR6, Ada Lovelace architecture. "
        "Local testing GPU. Use small batch sizes and LoRA for memory efficiency. "
        "Not suitable for large models or full fine-tuning."
    ),
}

# Ubuntu 24.04 with CUDA — NVIDIA GPU Cloud image
VULTR_OS_ID = 2284


def is_local_mode() -> bool:
    """Check if we're running in local testing mode."""
    return settings.TRAINING_MODE.lower() == "local"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.VULTR_API_KEY}",
        "Content-Type": "application/json",
    }


async def create_gpu_instance(
    label: str = "dataforall-training",
    region: str | None = None,
) -> dict[str, Any]:
    """
    Provision a GH200 bare-metal GPU server on Vultr.
    Returns the raw Vultr API response body (contains 'bare_metal' key).
    """
    payload = {
        "region": region or settings.VULTR_DEFAULT_REGION,
        "plan": GH200_INFO["plan"],
        "os_id": VULTR_OS_ID,
        "label": label,
        "tags": ["dataforall", "training"],
        "enable_ipv6": False,
    }
    if settings.VULTR_SSH_KEY_ID:
        payload["sshkey_id"] = [settings.VULTR_SSH_KEY_ID]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{VULTR_BASE}/bare-metal",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("Vultr GH200 instance created: %s", data.get("bare_metal", {}).get("id"))
        return data


async def get_instance(instance_id: str) -> dict[str, Any]:
    """Get info about a bare-metal instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{VULTR_BASE}/bare-metal/{instance_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def wait_for_instance_active(
    instance_id: str,
    timeout_seconds: int = 600,
    poll_interval: int = 15,
) -> dict[str, Any]:
    """
    Poll Vultr until the bare-metal server reaches 'active' status.
    Returns instance info dict or raises TimeoutError.
    """
    elapsed = 0
    while elapsed < timeout_seconds:
        data = await get_instance(instance_id)
        bm = data.get("bare_metal", {})
        status = bm.get("status", "")
        power = bm.get("power_status", "")
        logger.info(
            "Vultr GH200 %s — status=%s power=%s (waited %ds)",
            instance_id, status, power, elapsed,
        )
        if status == "active" and power == "running":
            return data
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(
        f"Vultr GH200 instance {instance_id} did not become active within {timeout_seconds}s"
    )


async def destroy_instance(instance_id: str) -> None:
    """Terminate and delete a bare-metal instance."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{VULTR_BASE}/bare-metal/{instance_id}",
            headers=_headers(),
        )
        if resp.status_code == 204:
            logger.info("Vultr GH200 instance %s destroyed", instance_id)
        else:
            logger.warning(
                "Vultr destroy returned %d: %s", resp.status_code, resp.text
            )


def estimate_cost(max_epochs: int, approx_hours: float = 1.0) -> float:
    """Rough cost estimate. $0 in local mode."""
    if is_local_mode():
        return 0.0
    return round(GH200_INFO["hourly_rate_usd"] * approx_hours, 2)


def get_gpu_info() -> dict[str, Any]:
    """Return info about the active GPU (local 4060 or cloud GH200)."""
    if is_local_mode():
        return dict(LOCAL_4060_INFO)
    return dict(GH200_INFO)


def get_training_mode() -> str:
    """Return current training mode string."""
    return "local" if is_local_mode() else "vultr"
