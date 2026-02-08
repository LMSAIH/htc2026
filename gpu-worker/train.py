"""
gpu-worker/train.py — Robust training worker for DataForAll

This script runs INSIDE an ephemeral GPU server (Lambda H100).
It receives job configuration via environment variables, executes training
(simulated or real), and reports progress/results back to the API.

Key Features:
- Crash recovery via local state file
- Heartbeat as async task (30s interval)
- Batch retry (3 attempts before failure)
- Structured logging via HTTP callbacks
- Graceful shutdown handling
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

JOB_ID = os.environ.get("JOB_ID", "")
API_BASE_URL = os.environ.get("API_BASE_URL", "").rstrip("/")
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")
BASE_MODEL = os.environ.get("BASE_MODEL", "")
TASK = os.environ.get("TASK", "")
MAX_EPOCHS = int(os.environ.get("MAX_EPOCHS", "10"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "16"))
LEARNING_RATE = float(os.environ.get("LEARNING_RATE", "3e-4"))
USE_LORA = os.environ.get("USE_LORA", "true").lower() == "true"
TARGET_ACCURACY = os.environ.get("TARGET_ACCURACY", "")
TRAINING_MODE = os.environ.get("TRAINING_MODE", "simulated")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
DATASET_PATH = os.environ.get("DATASET_PATH", "")

# S3 settings — for loading real mission contribution data
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")
MISSION_ID = os.environ.get("MISSION_ID", "")

WORKER_MODE = os.environ.get("WORKER_MODE", "job")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))

target_acc: Optional[float] = None
if TARGET_ACCURACY:
    try:
        target_acc = float(TARGET_ACCURACY)
    except ValueError:
        target_acc = None

OUTPUT_DIR = f"/tmp/training-{JOB_ID}"
MODEL_DIR = f"{OUTPUT_DIR}/model"
CHECKPOINT_DIR = f"{OUTPUT_DIR}/checkpoints"
STATE_DIR = Path("/worker/state")
STATE_DIR.mkdir(parents=True, exist_ok=True)

MAX_RETRIES = 3
HEARTBEAT_INTERVAL = 30

_http_client: Optional[httpx.AsyncClient] = None
_callback_headers = {
    "Content-Type": "application/json",
    "X-Callback-Secret": CALLBACK_SECRET,
}

_state: Optional[Dict[str, Any]] = None
_heartbeat_task: Optional[asyncio.Task] = None
_shutdown_event = asyncio.Event()


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client


def get_state_path() -> Path:
    return STATE_DIR / f"{JOB_ID}.json"


def load_state() -> Optional[Dict[str, Any]]:
    path = get_state_path()
    if not path.exists():
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as exc:
        logger.warning(f"Failed to load state: {exc}")
        return None


def save_state(data: Dict[str, Any]) -> None:
    path = get_state_path()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def delete_state() -> None:
    path = get_state_path()
    if path.exists():
        os.remove(path)


def init_state() -> Dict[str, Any]:
    global _state
    existing = load_state()
    if existing:
        _state = existing
        epoch = _state.get("epoch", 1)
        batch = _state.get("batch", 0)
        logger.info(f"Resuming from epoch={epoch}, batch={batch}")
    else:
        _state = {"job_id": JOB_ID, "epoch": 1, "batch": 0, "retry_count": 0}
        save_state(_state)
        logger.info("Starting fresh training")
    return _state


def update_state(
    epoch: int,
    batch: int,
    loss: Optional[float] = None,
    accuracy: Optional[float] = None,
):
    global _state
    if _state is None:
        return
    _state["epoch"] = epoch
    _state["batch"] = batch
    _state["last_error"] = None
    _state["retry_count"] = 0
    _state["updated_at"] = datetime.utcnow().isoformat()
    if loss is not None:
        _state["loss"] = loss
    if accuracy is not None:
        _state["accuracy"] = accuracy
    save_state(_state)


def apply_job_config(config: dict) -> None:
    """Apply job configuration from NextJobResponse JSON to module globals."""
    global JOB_ID, BASE_MODEL, TASK, MAX_EPOCHS, BATCH_SIZE, LEARNING_RATE
    global USE_LORA, TARGET_ACCURACY, TRAINING_MODE, MISSION_ID, DATASET_PATH
    global target_acc, OUTPUT_DIR, MODEL_DIR, CHECKPOINT_DIR

    JOB_ID = config.get("job_id", "")
    BASE_MODEL = config.get("base_model", "")
    TASK = config.get("task", "")
    MAX_EPOCHS = config.get("max_epochs", 10)
    BATCH_SIZE = config.get("batch_size", 16)
    LEARNING_RATE = float(config.get("learning_rate", 3e-4))
    USE_LORA = str(config.get("use_lora", "true")).lower() == "true"
    TARGET_ACCURACY = config.get("target_accuracy") or ""
    TRAINING_MODE = config.get("training_mode", "simulated")
    MISSION_ID = config.get("mission_id", "")
    DATASET_PATH = config.get("dataset_path", "")

    global target_acc
    if TARGET_ACCURACY:
        try:
            target_acc = float(TARGET_ACCURACY)
        except ValueError:
            target_acc = None
    else:
        target_acc = None

    OUTPUT_DIR = f"/tmp/training-{JOB_ID}"
    MODEL_DIR = f"{OUTPUT_DIR}/model"
    CHECKPOINT_DIR = f"{OUTPUT_DIR}/checkpoints"

    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Heartbeat — runs as an asyncio.Task on the MAIN event loop
# ---------------------------------------------------------------------------


async def _heartbeat_loop() -> None:
    """Background heartbeat that runs as an asyncio task on the main loop."""
    while True:
        try:
            await send_heartbeat()
        except asyncio.CancelledError:
            logger.info("Heartbeat task cancelled")
            return
        except Exception as exc:
            logger.warning(f"Heartbeat error: {exc}")
        try:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
        except asyncio.CancelledError:
            logger.info("Heartbeat task cancelled during sleep")
            return


def start_heartbeat() -> None:
    """Start heartbeat as an asyncio.Task on the currently-running loop."""
    global _heartbeat_task
    loop = asyncio.get_running_loop()
    _heartbeat_task = loop.create_task(_heartbeat_loop())
    logger.info(f"Heartbeat started (interval={HEARTBEAT_INTERVAL}s)")


async def stop_heartbeat() -> None:
    """Cancel the heartbeat task."""
    global _heartbeat_task
    if _heartbeat_task is not None and not _heartbeat_task.done():
        _heartbeat_task.cancel()
        try:
            await _heartbeat_task
        except asyncio.CancelledError:
            pass
    _heartbeat_task = None
    logger.info("Heartbeat stopped")


# ---------------------------------------------------------------------------
# GPU info helpers
# ---------------------------------------------------------------------------


def get_gpu_temp() -> Optional[float]:
    try:
        result = os.popen(
            "nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader"
        ).read()
        return float(result.strip())
    except Exception:
        return None


def get_gpu_memory() -> Optional[float]:
    try:
        result = os.popen(
            "nvidia-smi --query-gpu=memory.used --format=csv,noheader"
        ).read()
        used_mb = float(result.strip())
        return round(used_mb / 1024, 2)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Callback functions — all async, awaited directly from the main loop
# ---------------------------------------------------------------------------


async def send_heartbeat() -> None:
    """Send heartbeat to API."""
    if _state is None:
        return
    client = get_http_client()
    url = f"{API_BASE_URL}/api/training/jobs/{JOB_ID}/callback/heartbeat"
    payload = {
        "worker_status": "running",
        "gpu_temp_c": get_gpu_temp(),
        "gpu_memory_used_gb": get_gpu_memory(),
        "current_epoch": _state.get("epoch"),
        "current_batch": _state.get("batch"),
    }
    try:
        resp = await client.post(url, json=payload, headers=_callback_headers)
        if resp.status_code == 200:
            logger.debug("Heartbeat sent successfully")
        else:
            logger.warning(f"Heartbeat response: {resp.status_code}")
    except Exception as exc:
        logger.warning(f"Heartbeat failed: {exc}")


async def send_log(
    level: str, message: str, epoch: Optional[int] = None, batch: Optional[int] = None
) -> None:
    """Send a log message to API."""
    client = get_http_client()
    url = f"{API_BASE_URL}/api/training/jobs/{JOB_ID}/callback/log"
    payload = {
        "level": level.upper(),
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "epoch": epoch or (_state.get("epoch") if _state else None),
        "batch": batch or (_state.get("batch") if _state else None),
    }
    try:
        await client.post(url, json=payload, headers=_callback_headers)
    except Exception as exc:
        logger.warning(f"Log send failed: {exc}")
    logger.info(f"[{level}] {message}")


async def send_status(
    status: str,
    epoch: int,
    loss: Optional[float] = None,
    accuracy: Optional[float] = None,
    batch: Optional[int] = None,
    total_batches: Optional[int] = None,
    eta: Optional[int] = None,
) -> None:
    """Send training status update to API."""
    client = get_http_client()
    url = f"{API_BASE_URL}/api/training/jobs/{JOB_ID}/callback/status"
    payload = {
        "status": status,
        "epochs_completed": epoch,
        "current_epoch": epoch,
        "current_batch": batch or 0,
        "total_batches": total_batches or 0,
    }
    if loss is not None:
        payload["current_loss"] = loss
    if accuracy is not None:
        payload["current_accuracy"] = accuracy
    if eta is not None:
        payload["eta_seconds"] = eta
    try:
        resp = await client.post(url, json=payload, headers=_callback_headers)
        if resp.status_code != 200:
            logger.warning(f"Status callback failed: {resp.text}")
    except Exception as exc:
        logger.warning(f"Status callback error: {exc}")


async def send_complete(accuracy: float, loss: float, epochs: int) -> None:
    """Send training complete callback to API."""
    client = get_http_client()
    url = f"{API_BASE_URL}/api/training/jobs/{JOB_ID}/callback/complete"
    payload = {
        "result_accuracy": accuracy,
        "result_loss": loss,
        "epochs_completed": epochs,
    }
    try:
        resp = await client.post(url, json=payload, headers=_callback_headers)
        if resp.status_code != 200:
            logger.warning(f"Complete callback failed: {resp.text}")
        else:
            logger.info("Complete callback sent successfully")
    except Exception as exc:
        logger.warning(f"Complete callback error: {exc}")


async def send_fail(error_message: str) -> None:
    """Send training failure callback to API."""
    client = get_http_client()
    url = f"{API_BASE_URL}/api/training/jobs/{JOB_ID}/callback/fail"
    payload = {"error_message": error_message}
    try:
        resp = await client.post(url, json=payload, headers=_callback_headers)
        if resp.status_code != 200:
            logger.warning(f"Fail callback failed: {resp.text}")
        else:
            logger.info("Fail callback sent successfully")
    except Exception as exc:
        logger.warning(f"Fail callback error: {exc}")


async def terminate_self() -> None:
    """Terminate GPU instance via API."""
    logger.warning("Terminating GPU instance after repeated failures")
    await send_fail(f"Batch failed after {MAX_RETRIES} attempts")


# ---------------------------------------------------------------------------
# Training functions — now async to support await on callbacks
# ---------------------------------------------------------------------------


async def run_simulated_training() -> tuple[float, float, int]:
    """Simulate training with sleep + random metrics."""
    import random

    logger.info(f"Starting simulated training: model={BASE_MODEL}, epochs={MAX_EPOCHS}")

    loss = 2.5 + random.uniform(-0.5, 0.5)
    accuracy = 0.1 + random.uniform(0, 0.05)
    total_batches = 100
    start_time = time.time()

    current_epoch = _state.get("epoch", 1) if _state else 1
    start_batch = (
        (_state.get("batch", 0) + 1)
        if _state and _state.get("epoch", 1) == current_epoch
        else 1
    )

    for epoch in range(current_epoch, MAX_EPOCHS + 1):
        for batch in range(start_batch, total_batches + 1):
            # Use asyncio.sleep so we don't block the event loop (heartbeats keep going)
            await asyncio.sleep(random.uniform(0.1, 0.3))

            loss *= random.uniform(0.995, 0.999)
            accuracy = min(accuracy + random.uniform(0.001, 0.005), 0.99)

            elapsed = time.time() - start_time
            batches_done = (epoch - 1) * total_batches + batch
            batches_total = MAX_EPOCHS * total_batches
            eta = (
                int((elapsed / max(batches_done, 1)) * (batches_total - batches_done))
                if batches_done > 0
                else 0
            )

            progress = (batch / total_batches) * 100
            msg = (
                f"Epoch {epoch}/{MAX_EPOCHS}, Batch {batch}/{total_batches} "
                f"({progress:.0f}%) — loss: {loss:.4f}, accuracy: {accuracy:.4f}, ETA: {eta}s"
            )

            # Send log and status — these are now awaited directly
            await send_log("INFO", msg, epoch, batch)
            await send_status(
                "training", epoch, loss, accuracy, batch, total_batches, eta
            )

            update_state(epoch, batch, loss, accuracy)

            if target_acc and accuracy >= target_acc:
                logger.info(f"Target accuracy {target_acc} reached at epoch {epoch}")
                return round(accuracy, 4), round(loss, 4), epoch

        start_batch = 1

    return round(accuracy, 4), round(loss, 4), MAX_EPOCHS


async def run_real_training() -> tuple[float, float, int]:
    """
    Real HuggingFace training — dispatches on TASK env var.

    Supported tasks:
      - image-classification  → ViT + ViTImageProcessor
      - text-classification   → DistilBERT / AutoModelForSequenceClassification
      - object-detection      → DETR (AutoModelForObjectDetection)
      - tabular-classification → text-based approach (stringify columns)
      - anomaly-detection      → ViT-based image feature extraction
      - fallback               → sequence classification with dummy data

    Runs the HF Trainer in a thread executor so heartbeats keep flowing.
    """
    import torch
    from huggingface_hub import HfApi
    from transformers import (
        AutoModelForSequenceClassification,
        AutoModelForImageClassification,
        AutoImageProcessor,
        AutoTokenizer,
        Trainer,
        TrainingArguments,
        DataCollatorWithPadding,
        DefaultDataCollator,
    )
    from datasets import Dataset
    import peft

    logger.info(
        f"Starting real training: task={TASK}, model={BASE_MODEL}, use_lora={USE_LORA}"
    )

    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

    # --- Load dataset (S3 if available, dummy otherwise) ---
    logger.info("Loading dataset...")
    has_s3 = all(
        [S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME, MISSION_ID]
    )
    if has_s3:
        train_dataset, eval_dataset = load_s3_dataset(TASK)
    else:
        logger.info("No S3 config — using dummy dataset")
        train_dataset, eval_dataset = load_dummy_dataset()

    await send_log(
        "INFO", f"Dataset loaded: {len(train_dataset)} train, {len(eval_dataset)} eval"
    )

    # --- Dispatch by task ---
    task = TASK.lower().strip() if TASK else ""

    if task in ("image-classification", "anomaly-detection"):
        accuracy, loss, epochs = await _train_image_classification(
            train_dataset,
            eval_dataset,
            torch,
            peft,
            Trainer,
            TrainingArguments,
            AutoModelForImageClassification,
            AutoImageProcessor,
            DefaultDataCollator,
        )
    elif task == "text-classification" or task == "":
        accuracy, loss, epochs = await _train_text_classification(
            train_dataset,
            eval_dataset,
            torch,
            peft,
            Trainer,
            TrainingArguments,
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
        )
    elif task == "tabular-classification":
        # Stringify tabular columns and use text classification pipeline
        accuracy, loss, epochs = await _train_text_classification(
            train_dataset,
            eval_dataset,
            torch,
            peft,
            Trainer,
            TrainingArguments,
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
            tabular_mode=True,
        )
    elif task == "object-detection":
        # Object detection requires bounding box annotations. Without annotations
        # from S3, we fall back to image-classification on the same images.
        logger.warning(
            "Object detection requires bbox annotations — falling back to image-classification training"
        )
        accuracy, loss, epochs = await _train_image_classification(
            train_dataset,
            eval_dataset,
            torch,
            peft,
            Trainer,
            TrainingArguments,
            AutoModelForImageClassification,
            AutoImageProcessor,
            DefaultDataCollator,
        )
    else:
        logger.warning(f"Unknown task '{task}' — defaulting to text-classification")
        accuracy, loss, epochs = await _train_text_classification(
            train_dataset,
            eval_dataset,
            torch,
            peft,
            Trainer,
            TrainingArguments,
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
        )

    return accuracy, loss, epochs


async def _train_image_classification(
    train_dataset,
    eval_dataset,
    torch,
    peft,
    Trainer,
    TrainingArguments,
    AutoModelForImageClassification,
    AutoImageProcessor,
    DefaultDataCollator,
) -> tuple[float, float, int]:
    """Image classification training path (ViT-based)."""
    from huggingface_hub import HfApi

    model_name = BASE_MODEL or "google/vit-base-patch16-224"
    logger.info(f"Image classification: loading processor from {model_name}")

    processor = AutoImageProcessor.from_pretrained(model_name)

    # Determine num_labels from dataset
    labels_col = train_dataset.column_names
    if "label" in labels_col:
        unique_labels = set(train_dataset["label"])
        num_labels = max(len(unique_labels), 2)
    else:
        num_labels = 2

    logger.info(f"Loading image model with num_labels={num_labels}...")
    model = AutoModelForImageClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        ignore_mismatched_sizes=True,
        torch_dtype=torch.float16 if torch.cuda.is_available() else "auto",
        device_map="auto" if torch.cuda.is_available() else None,
    )

    if USE_LORA:
        logger.info("Applying LoRA for image model...")
        lora_config = peft.LoraConfig(
            task_type="SEQ_CLS",  # peft maps this for ViT
            inference_mode=False,
            r=16,
            lora_alpha=32,
            lora_dropout=0.1,
            target_modules=["query", "value"],  # ViT attention layers
        )
        model = peft.get_peft_model(model, lora_config)
        model.print_trainable_parameters()

    # Preprocess: apply the image processor to the dataset
    def preprocess(examples):
        images = examples["image"]
        # processor expects PIL images; the HF Image column auto-decodes
        inputs = processor(images=images, return_tensors="pt")
        inputs["labels"] = examples["label"]
        return inputs

    logger.info("Preprocessing images...")
    train_dataset = train_dataset.with_transform(preprocess)
    eval_dataset = eval_dataset.with_transform(preprocess)

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = torch.argmax(torch.tensor(logits), dim=-1).numpy()
        labels_np = labels if hasattr(labels, "__len__") else [labels]
        correct = sum(1 for p, l in zip(preds, labels_np) if p == l)
        return {"accuracy": correct / max(len(labels_np), 1)}

    training_args = TrainingArguments(
        output_dir=CHECKPOINT_DIR,
        num_train_epochs=MAX_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        weight_decay=0.01,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        logging_steps=10,
        fp16=torch.cuda.is_available(),
        dataloader_num_workers=0,
        remove_unused_columns=False,  # Important for image datasets with transform
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=DefaultDataCollator(),
        compute_metrics=compute_metrics,
    )

    logger.info("Starting image training (in executor)...")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, trainer.train)

    logger.info("Evaluating...")
    metrics = trainer.evaluate()
    final_accuracy = metrics.get("eval_accuracy", 0.0)
    final_loss = metrics.get("eval_loss", 0.0)

    logger.info(f"Saving model to {MODEL_DIR}...")
    model.save_pretrained(MODEL_DIR)
    processor.save_pretrained(MODEL_DIR)

    _upload_to_hub(HfApi)

    return float(final_accuracy), float(final_loss), MAX_EPOCHS


async def _train_text_classification(
    train_dataset,
    eval_dataset,
    torch,
    peft,
    Trainer,
    TrainingArguments,
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    tabular_mode: bool = False,
) -> tuple[float, float, int]:
    """Text/tabular classification training path (DistilBERT-based)."""
    from huggingface_hub import HfApi

    model_name = BASE_MODEL or "distilbert/distilbert-base-uncased"
    logger.info(f"Text classification: loading tokenizer from {model_name}")

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # If tabular mode, stringify all non-label columns into a "text" column
    if tabular_mode:
        logger.info("Tabular mode: stringifying columns into text")

        def stringify_row(example):
            parts = []
            for col in sorted(example.keys()):
                if col != "label":
                    parts.append(f"{col}: {example[col]}")
            return {"text": " | ".join(parts), "label": example.get("label", 0)}

        train_dataset = train_dataset.map(stringify_row)
        eval_dataset = eval_dataset.map(stringify_row)

    # Determine the text column name
    text_col = None
    for candidate in ["text", "text_a", "sentence", "content", "input"]:
        if candidate in train_dataset.column_names:
            text_col = candidate
            break
    if text_col is None:
        # Use first non-label string column
        for col in train_dataset.column_names:
            if col != "label":
                text_col = col
                break
    if text_col is None:
        text_col = "text"  # will fail if missing — caught by retry

    logger.info(f"Using text column: '{text_col}'")

    # Tokenize
    def tokenize_fn(examples):
        return tokenizer(
            examples[text_col], truncation=True, padding="max_length", max_length=512
        )

    train_dataset = train_dataset.map(tokenize_fn, batched=True)
    eval_dataset = eval_dataset.map(tokenize_fn, batched=True)

    # Determine num_labels
    if "label" in train_dataset.column_names:
        unique_labels = set(train_dataset["label"])
        num_labels = max(len(unique_labels), 2)
    else:
        num_labels = 2

    logger.info(f"Loading text model with num_labels={num_labels}...")
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        torch_dtype=torch.float16 if torch.cuda.is_available() else "auto",
        device_map="auto" if torch.cuda.is_available() else None,
    )

    if USE_LORA:
        logger.info("Applying LoRA for text model...")
        lora_config = peft.LoraConfig(
            task_type="SEQ_CLS",
            inference_mode=False,
            r=16,
            lora_alpha=32,
            lora_dropout=0.1,
            target_modules=["q_proj", "v_proj"],
        )
        try:
            model = peft.get_peft_model(model, lora_config)
            model.print_trainable_parameters()
        except ValueError:
            # Some models (e.g. distilbert) use different attention layer names
            logger.warning("LoRA target modules not found — trying 'q_lin', 'v_lin'")
            lora_config = peft.LoraConfig(
                task_type="SEQ_CLS",
                inference_mode=False,
                r=16,
                lora_alpha=32,
                lora_dropout=0.1,
                target_modules=["q_lin", "v_lin"],
            )
            model = peft.get_peft_model(model, lora_config)
            model.print_trainable_parameters()

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        return {
            "accuracy": (
                torch.argmax(torch.tensor(logits), dim=-1) == torch.tensor(labels)
            )
            .float()
            .mean()
            .item()
        }

    training_args = TrainingArguments(
        output_dir=CHECKPOINT_DIR,
        num_train_epochs=MAX_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        weight_decay=0.01,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        logging_steps=10,
        fp16=torch.cuda.is_available(),
        dataloader_num_workers=0,
    )

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    logger.info("Starting text training (in executor)...")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, trainer.train)

    logger.info("Evaluating...")
    metrics = trainer.evaluate()
    final_accuracy = metrics.get("eval_accuracy", 0.0)
    final_loss = metrics.get("eval_loss", 0.0)

    logger.info(f"Saving model to {MODEL_DIR}...")
    model.save_pretrained(MODEL_DIR)
    tokenizer.save_pretrained(MODEL_DIR)

    _upload_to_hub(HfApi)

    return float(final_accuracy), float(final_loss), MAX_EPOCHS


def _upload_to_hub(HfApi) -> None:
    """Upload trained model to HuggingFace Hub (if HF_TOKEN is set)."""
    if not HF_TOKEN:
        return
    logger.info("Uploading to HuggingFace Hub...")
    repo_name = f"dataforall-{JOB_ID[:8]}"
    try:
        api = HfApi(token=HF_TOKEN)
        api.create_repo(repo_id=f"dataforall/{repo_name}", exist_ok=True)
        api.upload_folder(
            folder_dir=MODEL_DIR,
            repo_id=f"dataforall/{repo_name}",
            repo_type="model",
        )
        logger.info(f"Uploaded to https://huggingface.co/dataforall/{repo_name}")
    except Exception as exc:
        logger.warning(f"Hub upload failed: {exc}")


def load_dummy_dataset() -> tuple[Any, Any]:
    from datasets import Dataset

    text_a = ["Sample text"] * 100
    text_b = ["Another sample"] * 100
    labels = [0, 1] * 50
    data = {"text_a": text_a, "text_b": text_b, "labels": labels}
    dataset = Dataset.from_dict(data)
    split = dataset.train_test_split(test_size=0.1, seed=42)
    return split["train"], split["test"]


def load_s3_dataset(task: str) -> tuple[Any, Any]:
    """
    Download mission contribution files from S3 and build a HuggingFace Dataset.

    Supports:
      - image tasks  → returns Dataset with "image" (PIL) and "label" (int) columns
      - text tasks   → returns Dataset with "text" and "label" columns
      - tabular tasks → loads CSV/JSON into Dataset with all columns + "label"

    Falls back to load_dummy_dataset() if S3 is unconfigured or download fails.
    """
    import io
    import boto3
    from PIL import Image
    from datasets import Dataset, Features, Value, ClassLabel, Image as HFImage

    if not all(
        [S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME, MISSION_ID]
    ):
        logger.warning("S3 settings incomplete — falling back to dummy dataset")
        return load_dummy_dataset()

    prefix = f"missions/{MISSION_ID}/contributions/"
    logger.info(f"Loading S3 dataset: bucket={S3_BUCKET_NAME}, prefix={prefix}")

    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
    )

    # List all objects under the mission prefix
    keys: list[str] = []
    continuation_token = None
    while True:
        kwargs: Dict[str, Any] = {
            "Bucket": S3_BUCKET_NAME,
            "Prefix": prefix,
            "MaxKeys": 1000,
        }
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        resp = s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            keys.append(obj["Key"])
        if resp.get("IsTruncated"):
            continuation_token = resp["NextContinuationToken"]
        else:
            break

    if not keys:
        logger.warning(
            f"No files found in S3 under {prefix} — falling back to dummy dataset"
        )
        return load_dummy_dataset()

    logger.info(f"Found {len(keys)} files in S3")

    # Classify files by extension
    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
    TEXT_EXTS = {".txt", ".md"}
    TABULAR_EXTS = {".csv", ".json", ".jsonl"}
    # AUDIO_EXTS = {".wav", ".mp3", ".ogg", ".flac"}  # future

    def ext_of(key: str) -> str:
        return Path(key).suffix.lower()

    image_keys = [k for k in keys if ext_of(k) in IMAGE_EXTS]
    text_keys = [k for k in keys if ext_of(k) in TEXT_EXTS]
    tabular_keys = [k for k in keys if ext_of(k) in TABULAR_EXTS]

    # ---- IMAGE tasks ----
    if (
        task in ("image-classification", "object-detection", "anomaly-detection")
        and image_keys
    ):
        logger.info(f"Loading {len(image_keys)} images for task={task}")
        images = []
        labels = []
        for i, key in enumerate(image_keys):
            try:
                obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=key)
                img_bytes = obj["Body"].read()
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                images.append(img)
                # Without annotation files we assign synthetic labels.
                # For image-classification: round-robin across 2 classes.
                # For object-detection: the training loop will need to handle
                # bounding box annotations separately — for now label=0.
                if task == "image-classification":
                    labels.append(i % 2)
                else:
                    labels.append(0)
            except Exception as exc:
                logger.warning(f"Failed to load image {key}: {exc}")

        if not images:
            logger.warning("No images loaded successfully — falling back to dummy")
            return load_dummy_dataset()

        logger.info(f"Loaded {len(images)} images, building Dataset")
        ds = Dataset.from_dict({"image": images, "label": labels})
        ds = ds.cast_column("image", HFImage())
        split = ds.train_test_split(test_size=0.1, seed=42)
        return split["train"], split["test"]

    # ---- TEXT tasks ----
    if task in ("text-classification",) and text_keys:
        logger.info(f"Loading {len(text_keys)} text files for task={task}")
        texts = []
        labels = []
        for i, key in enumerate(text_keys):
            try:
                obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=key)
                content = obj["Body"].read().decode("utf-8", errors="replace").strip()
                if content:
                    texts.append(content)
                    labels.append(i % 2)
            except Exception as exc:
                logger.warning(f"Failed to load text {key}: {exc}")

        if not texts:
            logger.warning("No text files loaded — falling back to dummy")
            return load_dummy_dataset()

        ds = Dataset.from_dict({"text": texts, "label": labels})
        split = ds.train_test_split(test_size=0.1, seed=42)
        return split["train"], split["test"]

    # ---- TABULAR tasks ----
    if task in ("tabular-classification", "time-series-forecasting") and tabular_keys:
        import csv as csv_mod

        logger.info(f"Loading {len(tabular_keys)} tabular files for task={task}")
        all_rows: list[dict] = []
        for key in tabular_keys:
            try:
                obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=key)
                raw = obj["Body"].read().decode("utf-8", errors="replace")
                ext = ext_of(key)
                if ext == ".csv":
                    reader = csv_mod.DictReader(io.StringIO(raw))
                    all_rows.extend(list(reader))
                elif ext in (".json", ".jsonl"):
                    # Try JSON-lines first, then single JSON array
                    lines = raw.strip().splitlines()
                    for line in lines:
                        line = line.strip()
                        if line:
                            parsed = json.loads(line)
                            if isinstance(parsed, list):
                                all_rows.extend(parsed)
                            elif isinstance(parsed, dict):
                                all_rows.append(parsed)
            except Exception as exc:
                logger.warning(f"Failed to load tabular {key}: {exc}")

        if not all_rows:
            logger.warning("No tabular rows loaded — falling back to dummy")
            return load_dummy_dataset()

        # If no "label" column exists, add synthetic labels
        if "label" not in all_rows[0]:
            for i, row in enumerate(all_rows):
                row["label"] = i % 2

        ds = Dataset.from_list(all_rows)
        split = ds.train_test_split(test_size=0.1, seed=42)
        return split["train"], split["test"]

    # ---- FALLBACK: try images if any exist regardless of task ----
    if image_keys:
        logger.info(
            f"Task '{task}' has no special handler but images exist — loading as image-classification"
        )
        return load_s3_dataset("image-classification")

    if tabular_keys:
        logger.info(
            f"Task '{task}' has no special handler but tabular files exist — loading as tabular-classification"
        )
        return load_s3_dataset("tabular-classification")

    logger.warning(f"No loadable files for task={task} — falling back to dummy dataset")
    return load_dummy_dataset()


# ---------------------------------------------------------------------------
# Retry wrapper
# ---------------------------------------------------------------------------


async def run_with_retry(training_fn):
    """Run training with retry logic."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await training_fn()
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            if _state:
                _state["retry_count"] = attempt
                _state["last_error"] = error_msg
                _state["updated_at"] = datetime.utcnow().isoformat()
                save_state(_state)

            logger.warning(f"Attempt {attempt}/{MAX_RETRIES} failed: {exc}")
            traceback.print_exc()

            if attempt >= MAX_RETRIES:
                logger.error(f"All {MAX_RETRIES} attempts failed")
                await send_log(
                    "ERROR", f"Training failed after {MAX_RETRIES} attempts: {exc}"
                )
                await send_fail(f"Failed after {MAX_RETRIES} attempts: {exc}")
                if WORKER_MODE != "persistent":
                    await terminate_self()
                raise

    raise RuntimeError("Unexpected exit from retry loop")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main_async():
    global _state

    _state = init_state()

    # Start heartbeat as a task on THIS event loop
    start_heartbeat()

    logger.info("=" * 60)
    logger.info("DataForAll GPU Worker")
    logger.info(f"Job ID: {JOB_ID}")
    logger.info(f"Mode: {TRAINING_MODE}")
    logger.info(f"API URL: {API_BASE_URL}")
    logger.info(f"Callback Secret: {'set' if CALLBACK_SECRET else 'NOT SET'}")
    logger.info("=" * 60)

    await send_log("INFO", f"Worker started (mode={TRAINING_MODE})")
    current_epoch = _state.get("epoch", 1) if _state else 1
    await send_status("training", current_epoch)

    try:
        if TRAINING_MODE == "simulated":
            accuracy, loss, epochs = await run_with_retry(run_simulated_training)
        else:
            accuracy, loss, epochs = await run_with_retry(run_real_training)

        logger.info(
            f"Training complete: accuracy={accuracy}, loss={loss}, epochs={epochs}"
        )
        await send_complete(accuracy, loss, epochs)
        await send_log("INFO", f"Training complete: accuracy={accuracy}, loss={loss}")
        delete_state()

    except Exception as exc:
        logger.error(f"Training failed: {exc}")
        traceback.print_exc()
        await send_log("ERROR", str(exc)[:500])
        await send_fail(str(exc)[:2000])
    finally:
        await stop_heartbeat()
        delete_state()
        if _http_client is not None:
            await _http_client.aclose()


async def run_persistent_loop() -> None:
    """Main loop for persistent worker mode — polls for jobs and executes them."""
    logger.info(f"Starting persistent worker loop (poll_interval={POLL_INTERVAL}s)")

    while not _shutdown_event.is_set():
        try:
            client = get_http_client()
            url = f"{API_BASE_URL}/api/training/worker/next-job"
            headers = {"X-Callback-Secret": CALLBACK_SECRET}

            try:
                resp = await client.get(url, headers=headers)
            except Exception as e:
                logger.warning(f"Polling failed: {e}")
                await asyncio.sleep(POLL_INTERVAL)
                continue

            if resp.status_code == 204:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            if resp.status_code != 200:
                logger.warning(f"Unexpected polling response: {resp.status_code}")
                await asyncio.sleep(POLL_INTERVAL)
                continue

            config = resp.json()
            job_id = config.get("job_id", "unknown")
            logger.info(f"Received job: {job_id}")

            try:
                apply_job_config(config)
                init_state()
                start_heartbeat()

                if TRAINING_MODE == "simulated":
                    accuracy, loss, epochs = await run_with_retry(
                        run_simulated_training
                    )
                else:
                    accuracy, loss, epochs = await run_with_retry(run_real_training)

                logger.info(f"Job {job_id} complete: accuracy={accuracy}, loss={loss}")
                await send_complete(accuracy, loss, epochs)
                await send_log(
                    "INFO", f"Training complete: accuracy={accuracy}, loss={loss}"
                )

            except Exception as exc:
                logger.error(f"Job {job_id} failed: {exc}")
                await send_log("ERROR", str(exc)[:500])
                await send_fail(str(exc)[:2000])
            finally:
                await stop_heartbeat()
                delete_state()

        except asyncio.CancelledError:
            logger.info("Persistent loop cancelled")
            break
        except Exception as exc:
            logger.error(f"Unexpected error in loop: {exc}")
            await asyncio.sleep(POLL_INTERVAL)

    logger.info("Persistent worker loop exiting")


def main():
    if WORKER_MODE == "persistent":

        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, initiating graceful shutdown...")
            _shutdown_event.set()

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        asyncio.run(run_persistent_loop())
    else:
        signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
        signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
        asyncio.run(main_async())

    sys.exit(0)

    asyncio.run(main_async())
    sys.exit(0)


if __name__ == "__main__":
    main()
