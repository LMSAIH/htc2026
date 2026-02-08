"""
gpu-worker/train.py — One-shot training worker for DataForAll

This script runs INSIDE an ephemeral GPU server (Vultr GH200 bare metal).
It receives job configuration via environment variables, executes training
(simulated or real), and reports progress/results back to the API via HTTP
callbacks.

Lifecycle:
  1. Read config from env vars
  2. POST callback: status → "training"
  3. Run training loop (simulated: sleep + fake metrics)
  4. POST callback: complete (with final metrics) OR fail (with error)
  5. Exit (the API server will then destroy this GPU instance)

Environment variables:
  JOB_ID            - UUID of the TrainingJob
  API_CALLBACK_URL  - Base URL of the API (e.g. https://api.dataforall.xyz)
  CALLBACK_SECRET   - Shared secret for authenticating callbacks
  BASE_MODEL        - HuggingFace model ID
  TASK              - ML task type (e.g. image-classification)
  MAX_EPOCHS        - Number of training epochs
  BATCH_SIZE        - Batch size
  LEARNING_RATE     - Learning rate
  USE_LORA          - "true" or "false"
  TARGET_ACCURACY   - Optional target accuracy (float or empty)
  TRAINING_MODE     - "simulated" (default) or "real"
"""

import os
import sys
import time
import random
import traceback

import httpx


# ── Config from environment ──────────────────────────────────────────────────


def get_env(key: str, default: str | None = None, required: bool = False) -> str:
    val = os.environ.get(key, default)
    if required and not val:
        print(f"FATAL: Required env var {key} is not set", file=sys.stderr)
        sys.exit(1)
    return val or ""


JOB_ID = get_env("JOB_ID", required=True)
API_CALLBACK_URL = get_env("API_CALLBACK_URL", required=True).rstrip("/")
CALLBACK_SECRET = get_env("CALLBACK_SECRET", required=True)
BASE_MODEL = get_env("BASE_MODEL", required=True)
TASK = get_env("TASK", required=True)
MAX_EPOCHS = int(get_env("MAX_EPOCHS", "10"))
BATCH_SIZE = int(get_env("BATCH_SIZE", "16"))
LEARNING_RATE = float(get_env("LEARNING_RATE", "3e-4"))
USE_LORA = get_env("USE_LORA", "true").lower() == "true"
TARGET_ACCURACY = get_env("TARGET_ACCURACY", "")
TRAINING_MODE = get_env("TRAINING_MODE", "simulated")

# Parse optional target accuracy
target_acc: float | None = None
if TARGET_ACCURACY:
    try:
        target_acc = float(TARGET_ACCURACY)
    except ValueError:
        target_acc = None


# ── HTTP callback helpers ────────────────────────────────────────────────────

CLIENT = httpx.Client(timeout=30.0)

CALLBACK_HEADERS = {
    "Content-Type": "application/json",
    "X-Callback-Secret": CALLBACK_SECRET,
}


def callback_status(
    status: str,
    epoch: int = 0,
    loss: float | None = None,
    accuracy: float | None = None,
) -> bool:
    """Report training status/progress to the API."""
    url = f"{API_CALLBACK_URL}/api/training/jobs/{JOB_ID}/callback/status"
    payload = {
        "status": status,
        "epochs_completed": epoch,
    }
    if loss is not None:
        payload["current_loss"] = loss
    if accuracy is not None:
        payload["current_accuracy"] = accuracy

    try:
        resp = CLIENT.post(url, json=payload, headers=CALLBACK_HEADERS)
        if resp.status_code != 200:
            print(f"WARNING: Status callback returned {resp.status_code}: {resp.text}")
            return False
        return True
    except Exception as e:
        print(f"WARNING: Status callback failed: {e}")
        return False


def callback_complete(accuracy: float, loss: float, epochs_completed: int) -> bool:
    """Report training completion to the API."""
    url = f"{API_CALLBACK_URL}/api/training/jobs/{JOB_ID}/callback/complete"
    payload = {
        "result_accuracy": accuracy,
        "result_loss": loss,
        "epochs_completed": epochs_completed,
    }
    try:
        resp = CLIENT.post(url, json=payload, headers=CALLBACK_HEADERS)
        if resp.status_code != 200:
            print(
                f"WARNING: Complete callback returned {resp.status_code}: {resp.text}"
            )
            return False
        return True
    except Exception as e:
        print(f"WARNING: Complete callback failed: {e}")
        return False


def callback_fail(error_message: str) -> bool:
    """Report training failure to the API."""
    url = f"{API_CALLBACK_URL}/api/training/jobs/{JOB_ID}/callback/fail"
    payload = {"error_message": error_message}
    try:
        resp = CLIENT.post(url, json=payload, headers=CALLBACK_HEADERS)
        if resp.status_code != 200:
            print(f"WARNING: Fail callback returned {resp.status_code}: {resp.text}")
            return False
        return True
    except Exception as e:
        print(f"WARNING: Fail callback failed: {e}")
        return False


# ── Simulated training ───────────────────────────────────────────────────────


def run_simulated_training() -> tuple[float, float, int]:
    """
    Simulate training with sleep + random metrics.
    Returns (final_accuracy, final_loss, epochs_completed).
    """
    print(
        f"[SIMULATED] Starting training: model={BASE_MODEL}, task={TASK}, "
        f"epochs={MAX_EPOCHS}, batch_size={BATCH_SIZE}, lr={LEARNING_RATE}"
    )

    loss = 2.5 + random.uniform(-0.5, 0.5)
    accuracy = 0.1 + random.uniform(0, 0.05)

    for epoch in range(1, MAX_EPOCHS + 1):
        # Simulate epoch duration (3-6 seconds per epoch for testing)
        epoch_time = random.uniform(3.0, 6.0)
        time.sleep(epoch_time)

        # Improve metrics with some noise
        loss *= random.uniform(0.75, 0.95)
        accuracy += random.uniform(0.02, 0.08)
        accuracy = min(accuracy, 0.99)  # cap at 99%

        print(
            f"  Epoch {epoch}/{MAX_EPOCHS} — loss: {loss:.4f}, accuracy: {accuracy:.4f}"
        )

        # Report progress
        callback_status(
            status="training",
            epoch=epoch,
            loss=round(loss, 4),
            accuracy=round(accuracy, 4),
        )

        # Early stopping if target accuracy reached
        if target_acc is not None and accuracy >= target_acc:
            print(
                f"  Target accuracy {target_acc} reached at epoch {epoch}. Stopping early."
            )
            return round(accuracy, 4), round(loss, 4), epoch

    return round(accuracy, 4), round(loss, 4), MAX_EPOCHS


# ── Real training (placeholder for later) ────────────────────────────────────


def run_real_training() -> tuple[float, float, int]:
    """
    Real HuggingFace training. NOT IMPLEMENTED YET.
    Will use transformers Trainer, datasets, PEFT/LoRA, etc.
    """
    raise NotImplementedError(
        "Real training not yet implemented. Use TRAINING_MODE=simulated."
    )


# ── Main ─────────────────────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("DataForAll GPU Worker")
    print("=" * 60)
    print(f"  Job ID:         {JOB_ID}")
    print(f"  API Callback:   {API_CALLBACK_URL}")
    print(f"  Base Model:     {BASE_MODEL}")
    print(f"  Task:           {TASK}")
    print(f"  Max Epochs:     {MAX_EPOCHS}")
    print(f"  Batch Size:     {BATCH_SIZE}")
    print(f"  Learning Rate:  {LEARNING_RATE}")
    print(f"  Use LoRA:       {USE_LORA}")
    print(f"  Target Acc:     {target_acc}")
    print(f"  Training Mode:  {TRAINING_MODE}")
    print("=" * 60)

    # Step 1: Report that training has started
    print("\n[1/3] Reporting status: training...")
    if not callback_status("training"):
        print("WARNING: Could not report training start, continuing anyway...")

    # Step 2: Run training
    print("\n[2/3] Running training...")
    try:
        if TRAINING_MODE == "simulated":
            accuracy, loss, epochs = run_simulated_training()
        elif TRAINING_MODE == "real":
            accuracy, loss, epochs = run_real_training()
        else:
            raise ValueError(f"Unknown TRAINING_MODE: {TRAINING_MODE}")
    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        print(f"\nFATAL: Training failed:\n{error_msg}", file=sys.stderr)
        callback_fail(error_msg[:2000])  # Truncate to 2000 chars
        sys.exit(1)

    # Step 3: Report completion
    print(
        f"\n[3/3] Training complete! accuracy={accuracy}, loss={loss}, epochs={epochs}"
    )
    print("Reporting completion to API...")
    if callback_complete(accuracy, loss, epochs):
        print("Done. Worker exiting successfully.")
    else:
        print("WARNING: Could not report completion. Worker exiting anyway.")
        sys.exit(1)


if __name__ == "__main__":
    main()
