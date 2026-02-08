"""
gpu-worker/train.py — One-shot training worker for DataForAll

This script runs INSIDE an ephemeral GPU server (Vultr GH200 bare metal).
It receives job configuration via environment variables, executes training
(simulated or real), and reports progress/results back to the API via HTTP
callbacks.

Lifecycle:
  1. Read config from env vars
  2. POST callback: status → "training"
  3. Run training loop (simulated OR real with HuggingFace)
  4. POST callback: complete (with final metrics) OR fail (with error)
  5. Exit (the API server will then destroy this GPU instance)

Environment variables:
  JOB_ID            - UUID of the TrainingJob
  API_CALLBACK_URL  - Base URL of the API (e.g. https://api.dataforall.xyz)
  CALLBACK_SECRET   - Shared secret for authenticating callbacks
  BASE_MODEL        - HuggingFace model ID
  TASK              - ML task type (e.g. image-classification, text-classification)
  MAX_EPOCHS        - Number of training epochs
  BATCH_SIZE        - Batch size
  LEARNING_RATE     - Learning rate
  USE_LORA          - "true" or "false"
  TARGET_ACCURACY   - Optional target accuracy (float or empty)
  TRAINING_MODE     - "simulated" (default) or "real"
  HF_TOKEN          - HuggingFace token for uploading model
  DATASET_PATH      - S3 path to dataset (missions/{mission_id}/contributions/)
"""

import os
import sys
import time
import random
import traceback
from pathlib import Path
from typing import Any

import httpx
import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorWithPadding,
)
from datasets import Dataset
import peft
import evaluate


JOB_ID = os.environ.get("JOB_ID", "")
API_CALLBACK_URL = os.environ.get("API_CALLBACK_URL", "").rstrip("/")
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

target_acc: float | None = None
if TARGET_ACCURACY:
    try:
        target_acc = float(TARGET_ACCURACY)
    except ValueError:
        target_acc = None

OUTPUT_DIR = f"/tmp/training-{JOB_ID}"
MODEL_DIR = f"{OUTPUT_DIR}/model"
CHECKPOINT_DIR = f"{OUTPUT_DIR}/checkpoints"


CLIENT = httpx.Client(timeout=60.0)
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
        epoch_time = random.uniform(3.0, 6.0)
        time.sleep(epoch_time)

        loss *= random.uniform(0.75, 0.95)
        accuracy += random.uniform(0.02, 0.08)
        accuracy = min(accuracy, 0.99)

        print(
            f"  Epoch {epoch}/{MAX_EPOCHS} — loss: {loss:.4f}, accuracy: {accuracy:.4f}"
        )

        callback_status(
            status="training",
            epoch=epoch,
            loss=round(loss, 4),
            accuracy=round(accuracy, 4),
        )

        if target_acc is not None and accuracy >= target_acc:
            print(
                f"  Target accuracy {target_acc} reached at epoch {epoch}. Stopping early."
            )
            return round(accuracy, 4), round(loss, 4), epoch

    return round(accuracy, 4), round(loss, 4), MAX_EPOCHS


def run_real_training() -> tuple[float, float, int]:
    """
    Real HuggingFace training with Transformers and PEFT/LoRA.
    Returns (final_accuracy, final_loss, epochs_completed).
    """
    from huggingface_hub import HfApi

    print(
        f"[REAL] Starting training: model={BASE_MODEL}, task={TASK}, "
        f"epochs={MAX_EPOCHS}, batch_size={BATCH_SIZE}, lr={LEARNING_RATE}, "
        f"use_lora={USE_LORA}"
    )

    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print("Loading model...")
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=2,
        torch_dtype=torch.float16 if torch.cuda.is_available() else "auto",
        device_map="auto" if torch.cuda.is_available() else None,
    )

    if USE_LORA:
        print("Applying LoRA configuration...")
        lora_config = peft.LoraConfig(
            task_type="SEQ_CLS",
            inference_mode=False,
            r=16,
            lora_alpha=32,
            lora_dropout=0.1,
            target_modules=["q_proj", "v_proj"],
        )
        model = peft.get_peft_model(model, lora_config)
        model.print_trainable_parameters()

    print("Loading dataset...")
    train_dataset, eval_dataset = load_dummy_dataset()

    print("Setting up metrics...")
    accuracy_metric = evaluate.load("accuracy")

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        predictions = torch.argmax(torch.tensor(logits), dim=-1)
        return accuracy_metric.compute(predictions=predictions, references=labels)

    print("Configuring training...")
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
        logging_dir=f"{OUTPUT_DIR}/logs",
        logging_steps=10,
        report_to="none",
        fp16=torch.cuda.is_available(),
        dataloader_num_workers=0,
        remove_unused_columns=False,
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
        callbacks=[TrainingCallback()],
    )

    print("Starting training...")
    trainer.train()

    print("Evaluating final model...")
    metrics = trainer.evaluate()
    final_accuracy = metrics.get("eval_accuracy", 0.0)
    final_loss = metrics.get("eval_loss", 0.0)
    epochs_completed = MAX_EPOCHS

    print(f"Final metrics: accuracy={final_accuracy:.4f}, loss={final_loss:.4f}")

    print("Saving model...")
    model.save_pretrained(MODEL_DIR)
    tokenizer.save_pretrained(MODEL_DIR)

    if HF_TOKEN:
        print("Uploading model to HuggingFace Hub...")
        model_name = f"dataforall-{JOB_ID[:8]}"
        try:
            api = HfApi(token=HF_TOKEN)
            api.create_repo(repo_id=f"dataforall/{model_name}", exist_ok=True)
            api.upload_folder(
                folder_dir=MODEL_DIR,
                repo_id=f"dataforall/{model_name}",
                repo_type="model",
            )
            print(f"Model uploaded to https://huggingface.co/dataforall/{model_name}")
        except Exception as e:
            print(f"WARNING: Failed to upload model to Hub: {e}")

    return float(final_accuracy), float(final_loss), epochs_completed


def load_dummy_dataset() -> tuple[Dataset, Dataset]:
    """
    Load a dummy dataset for demonstration.
    In production, this should load from S3 based on DATASET_PATH.
    Returns two datasets: train and eval.
    """
    text_a = [
        "The crop leaves are showing yellowing between the veins.",
        "Healthy green leaves with no discoloration observed.",
        "Spots found on the lower leaves, brown with yellow halo.",
        "Plant appears stunted with mottled leaf pattern.",
        "No signs of pest damage or disease symptoms.",
        "Wilting observed on upper branches during hot hours.",
        "Roots show rot with brown discoloration.",
        "New growth is normal color and healthy appearance.",
        "White powdery substance on leaf surfaces.",
        "Holes in leaves with irregular edges found.",
    ] * 10

    text_b = [
        "The field is clear and ready for harvest.",
        "Soil moisture levels are optimal for growth.",
        "Weather conditions favorable for planting.",
        "Irrigation system functioning properly.",
        "Fertilizer applied according to schedule.",
        "Pest population below economic threshold.",
        "Weeds controlled in row middles.",
        "Drainage channels are clean and functional.",
        "Temperature within normal range for this season.",
        "No irrigation needed for the next 48 hours.",
    ] * 10

    labels = [1, 0, 1, 1, 0, 1, 1, 0, 1, 1] * 10

    data = {
        "text_a": text_a,
        "text_b": text_b,
        "labels": labels,
    }
    dataset = Dataset.from_dict(data)

    split = dataset.train_test_split(test_size=0.1, seed=42)
    return split["train"], split["test"]


class TrainingCallback:
    """Callback to report epoch metrics to API."""

    def on_epoch_end(self, args, state, control, **kwargs):
        epoch = int(state.epoch)
        loss = state.log_history[-1].get("loss", None)
        eval_loss = state.log_history[-1].get("eval_loss", None)
        eval_accuracy = state.log_history[-1].get("eval_accuracy", None)

        current_loss = eval_loss if eval_loss is not None else loss
        current_accuracy = eval_accuracy

        print(f"  Epoch {epoch} — loss: {current_loss}, accuracy: {current_accuracy}")

        callback_status(
            status="training",
            epoch=epoch,
            loss=round(current_loss, 4) if current_loss else None,
            accuracy=round(current_accuracy, 4) if current_accuracy else None,
        )


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
    print(f"  Dataset Path:   {DATASET_PATH}")
    print("=" * 60)

    if TRAINING_MODE == "simulated":
        print("\nUsing SIMULATED training (for testing)")
    else:
        print("\nUsing REAL training with HuggingFace Transformers")

    print("\n[1/3] Reporting status: training...")
    if not callback_status("training"):
        print("WARNING: Could not report training start, continuing anyway...")

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
        callback_fail(error_msg[:2000])
        sys.exit(1)

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
