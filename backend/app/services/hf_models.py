"""
HuggingFace Hub model service — fetch models dynamically by task,
with a static fallback map for offline / rate-limited scenarios.
"""

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.training_job import TrainingTask

logger = logging.getLogger(__name__)

settings = get_settings()

HF_API_BASE = "https://huggingface.co/api"

# ── Task → default model fallback map ────────────────────────────────────────

TASK_DEFAULT_MODELS: dict[str, str] = {
    TrainingTask.IMAGE_CLASSIFICATION.value: "google/vit-base-patch16-224",
    TrainingTask.TABULAR_CLASSIFICATION.value: "microsoft/table-transformer-detection",
    TrainingTask.AUDIO_CLASSIFICATION.value: "facebook/wav2vec2-base",
    TrainingTask.TIME_SERIES_FORECASTING.value: "huggingface/autoformer-tourism-monthly",
    TrainingTask.ANOMALY_DETECTION.value: "facebook/dinov2-base",
    TrainingTask.TEXT_CLASSIFICATION.value: "distilbert/distilbert-base-uncased",
    TrainingTask.OBJECT_DETECTION.value: "facebook/detr-resnet-50",
}

# Map our TrainingTask values to HF Hub pipeline_tag values
TASK_TO_HF_PIPELINE: dict[str, str] = {
    TrainingTask.IMAGE_CLASSIFICATION.value: "image-classification",
    TrainingTask.TABULAR_CLASSIFICATION.value: "tabular-classification",
    TrainingTask.AUDIO_CLASSIFICATION.value: "audio-classification",
    TrainingTask.TIME_SERIES_FORECASTING.value: "time-series-forecasting",
    TrainingTask.ANOMALY_DETECTION.value: "image-classification",  # closest HF tag
    TrainingTask.TEXT_CLASSIFICATION.value: "text-classification",
    TrainingTask.OBJECT_DETECTION.value: "object-detection",
}


def _hf_headers() -> dict[str, str]:
    headers: dict[str, str] = {}
    if settings.HF_TOKEN:
        headers["Authorization"] = f"Bearer {settings.HF_TOKEN}"
    return headers


async def list_models_for_task(
    task: TrainingTask,
    limit: int = 20,
    sort: str = "downloads",
    direction: str = "-1",
) -> list[dict[str, Any]]:
    """
    Query HuggingFace Hub API for models matching the given task.
    Returns a simplified list of model dicts.
    """
    hf_pipeline = TASK_TO_HF_PIPELINE.get(task.value, task.value)

    params: dict[str, Any] = {
        "pipeline_tag": hf_pipeline,
        "sort": sort,
        "direction": direction,
        "limit": limit,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{HF_API_BASE}/models",
                headers=_hf_headers(),
                params=params,
            )
            resp.raise_for_status()
            raw_models = resp.json()
    except Exception as exc:
        logger.warning("HF Hub API error (%s), returning fallback: %s", task.value, exc)
        default = TASK_DEFAULT_MODELS.get(task.value)
        if default:
            return [{"model_id": default, "author": default.split("/")[0], "task": task.value, "downloads": 0, "likes": 0, "tags": []}]
        return []

    results = []
    for m in raw_models:
        model_id = m.get("modelId") or m.get("id", "")
        results.append({
            "model_id": model_id,
            "author": m.get("author") or (model_id.split("/")[0] if "/" in model_id else None),
            "task": hf_pipeline,
            "downloads": m.get("downloads", 0),
            "likes": m.get("likes", 0),
            "tags": m.get("tags", []),
        })

    return results


async def get_model_info(model_id: str) -> dict[str, Any] | None:
    """Fetch detailed info about a single HF model."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{HF_API_BASE}/models/{model_id}",
                headers=_hf_headers(),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to fetch model info for %s: %s", model_id, exc)
        return None


def get_default_model(task: TrainingTask) -> str:
    """Return the default base model for a given task."""
    return TASK_DEFAULT_MODELS.get(task.value, "distilbert/distilbert-base-uncased")


def resolve_base_model(task: TrainingTask, requested_model: str | None) -> str:
    """
    If the user provided a base_model, use it.
    Otherwise fall back to the task-specific default.
    """
    if requested_model:
        return requested_model
    return get_default_model(task)
