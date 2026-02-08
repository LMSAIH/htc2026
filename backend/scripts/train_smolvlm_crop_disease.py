"""
╔══════════════════════════════════════════════════════════════════════════╗
║  DataForAll — SmolVLM-256M Crop-Disease Fine-Tuning Script             ║
║                                                                        ║
║  Model : HuggingFaceTB/SmolVLM-256M-Instruct  (SigLIP + SmolLM2)      ║
║  Dataset: Saon110/bd-crop-vegetable-plant-disease-dataset               ║
║  GPU   : NVIDIA RTX 4060 Mobile (8 GB GDDR6) — local testing          ║
║                                                                        ║
║  Run:   python scripts/train_smolvlm_crop_disease.py                   ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime

import torch
from PIL import Image
from datasets import load_dataset, Dataset
from transformers import (
    AutoProcessor,
    AutoModelForVision2Seq,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("smolvlm-crop")

# ── Constants ────────────────────────────────────────────────────────────
MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct"
DATASET_ID = "Saon110/bd-crop-vegetable-plant-disease-dataset"

# RTX 4060 Mobile-safe defaults (8 GB VRAM)
DEFAULT_BATCH_SIZE = 2
DEFAULT_GRAD_ACCUM = 8       # effective batch = 2 × 8 = 16
DEFAULT_EPOCHS = 3
DEFAULT_LR = 2e-4
DEFAULT_MAX_TRAIN = 5_000    # subset size for quick test
DEFAULT_MAX_EVAL = 1_000
DEFAULT_LORA_R = 8
DEFAULT_LORA_ALPHA = 16

# LoRA target modules (SmolVLM / Idefics3 architecture)
LORA_TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# ── Argument parser ──────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fine-tune SmolVLM-256M on Bangladesh crop disease dataset"
    )
    p.add_argument("--model-id", default=MODEL_ID)
    p.add_argument("--dataset-id", default=DATASET_ID)
    p.add_argument("--output-dir", default="./output/smolvlm-crop-disease")
    p.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    p.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    p.add_argument("--grad-accum", type=int, default=DEFAULT_GRAD_ACCUM)
    p.add_argument("--lr", type=float, default=DEFAULT_LR)
    p.add_argument("--max-train", type=int, default=DEFAULT_MAX_TRAIN,
                   help="Max training samples (0 = use full dataset)")
    p.add_argument("--max-eval", type=int, default=DEFAULT_MAX_EVAL,
                   help="Max eval samples (0 = use full split)")
    p.add_argument("--lora-r", type=int, default=DEFAULT_LORA_R)
    p.add_argument("--lora-alpha", type=int, default=DEFAULT_LORA_ALPHA)
    p.add_argument("--use-qlora", action="store_true",
                   help="Use 4-bit QLoRA (saves ~2 GB extra VRAM)")
    p.add_argument("--bf16", action="store_true", default=True,
                   help="Use bfloat16 mixed precision")
    p.add_argument("--push-to-hub", action="store_true",
                   help="Push final adapter to HuggingFace Hub")
    p.add_argument("--hub-repo", type=str, default=None,
                   help="Hub repo name (default: smolvlm-256m-crop-disease)")
    p.add_argument("--hf-token", type=str, default=None,
                   help="HuggingFace token (or set HF_TOKEN env var)")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--logging-steps", type=int, default=25)
    p.add_argument("--save-steps", type=int, default=250)
    p.add_argument("--eval-steps", type=int, default=250)
    return p.parse_args()


# ── Dataset loading ──────────────────────────────────────────────────────
def load_crop_dataset(
    dataset_id: str,
    max_train: int,
    max_eval: int,
    hf_token: str | None,
) -> tuple[Dataset, Dataset, list[str]]:
    """Load the Bangladesh crop disease dataset from HF Hub."""
    log.info("Loading dataset  : %s", dataset_id)

    ds = load_dataset(dataset_id, token=hf_token, trust_remote_code=True)

    train_ds: Dataset = ds["train"]
    eval_ds: Dataset = ds["valid"] if "valid" in ds else ds["test"]

    # Retrieve class names
    class_names: list[str] = train_ds.features["label"].names
    log.info("  classes         : %d", len(class_names))
    log.info("  train (full)    : %d", len(train_ds))
    log.info("  eval  (full)    : %d", len(eval_ds))

    # Subsample for quick testing
    if max_train and max_train < len(train_ds):
        train_ds = train_ds.shuffle(seed=42).select(range(max_train))
        log.info("  train (subset)  : %d", len(train_ds))
    if max_eval and max_eval < len(eval_ds):
        eval_ds = eval_ds.shuffle(seed=42).select(range(max_eval))
        log.info("  eval  (subset)  : %d", len(eval_ds))

    return train_ds, eval_ds, class_names


# ── Model + Processor ────────────────────────────────────────────────────
def load_model_and_processor(
    model_id: str,
    use_qlora: bool,
    lora_r: int,
    lora_alpha: int,
) -> tuple:
    """Load SmolVLM-256M with LoRA / QLoRA adapter."""
    log.info("Loading processor : %s", model_id)
    processor = AutoProcessor.from_pretrained(model_id)

    # ── Quantisation config (optional) ───────────────────────────────
    quant_config = None
    if use_qlora:
        from transformers import BitsAndBytesConfig
        log.info("Using 4-bit QLoRA quantisation")
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        )

    # ── Load base model ──────────────────────────────────────────────
    log.info("Loading model     : %s  →  %s", model_id, DEVICE)
    # flash_attention_2 is Linux-only; use "eager" on Windows
    attn_impl = "eager" if sys.platform == "win32" else "flash_attention_2"

    model = AutoModelForVision2Seq.from_pretrained(
        model_id,
        torch_dtype=torch.bfloat16,
        quantization_config=quant_config,
        _attn_implementation=attn_impl,
        device_map="auto" if use_qlora else None,
    )
    if not use_qlora:
        model = model.to(DEVICE)

    # ── LoRA adapter ─────────────────────────────────────────────────
    log.info("Attaching LoRA adapter (r=%d, α=%d)", lora_r, lora_alpha)
    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=0.05,
        target_modules=LORA_TARGET_MODULES,
        init_lora_weights="gaussian",
        use_dora=not use_qlora,   # DoRA for LoRA, plain for QLoRA
    )

    if use_qlora:
        model = prepare_model_for_kbit_training(model)

    model = get_peft_model(model, lora_config)

    # Freeze vision encoder — only train language model LoRA
    for param in model.base_model.model.model.vision_model.parameters():
        param.requires_grad = False

    trainable, total = model.get_nb_trainable_parameters()
    log.info("  total params    : %s", f"{total:,}")
    log.info("  trainable       : %s  (%.2f%%)", f"{trainable:,}", 100 * trainable / total)

    vram = torch.cuda.memory_allocated() / 1024**3 if torch.cuda.is_available() else 0
    log.info("  VRAM after load : %.2f GB", vram)

    return model, processor


# ── Data collator ────────────────────────────────────────────────────────
def make_collate_fn(processor, class_names: list[str]):
    """
    Build a collate function that formats each sample as a VQA conversation:
        User: <image> Identify the disease or health status of this crop.
        Assistant: {class_label_name}
    """
    image_token_id = processor.tokenizer.additional_special_tokens_ids[
        processor.tokenizer.additional_special_tokens.index("<image>")
    ]

    def collate_fn(examples: list[dict]) -> dict:
        texts = []
        images = []

        for ex in examples:
            image: Image.Image = ex["image"]
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Resolve the label name
            label_idx = ex["label"]
            label_name = class_names[label_idx]

            # Build the chat conversation
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image"},
                        {
                            "type": "text",
                            "text": (
                                "You are an expert agricultural pathologist. "
                                "Identify the crop species and its disease or health status "
                                "from this image. Respond with only the class label."
                            ),
                        },
                    ],
                },
                {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": label_name},
                    ],
                },
            ]

            text = processor.apply_chat_template(messages, add_generation_prompt=False)
            texts.append(text.strip())
            images.append([image])

        # Process batch through the multimodal processor
        batch = processor(text=texts, images=images, return_tensors="pt", padding=True)

        # Build labels: mask padding + image tokens so they don't contribute to loss
        labels = batch["input_ids"].clone()
        labels[labels == processor.tokenizer.pad_token_id] = -100
        labels[labels == image_token_id] = -100
        batch["labels"] = labels

        return batch

    return collate_fn


# ── Evaluation metrics ───────────────────────────────────────────────────
def compute_metrics_factory(processor):
    """Return a compute_metrics fn for the Trainer (token-level accuracy)."""
    def compute_metrics(eval_preds):
        preds, labels = eval_preds
        # preds are logits of shape (batch, seq_len, vocab)
        if isinstance(preds, tuple):
            preds = preds[0]
        pred_ids = preds.argmax(axis=-1)

        # Mask out -100 labels
        mask = labels != -100
        correct = (pred_ids[mask] == labels[mask]).sum()
        total = mask.sum()
        accuracy = correct / total if total > 0 else 0.0

        return {"token_accuracy": float(accuracy)}

    return compute_metrics


# ── Main ─────────────────────────────────────────────────────────────────
def main():
    args = parse_args()
    hf_token = args.hf_token or os.environ.get("HF_TOKEN")
    run_name = f"smolvlm-crop-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    log.info("=" * 70)
    log.info("  SmolVLM-256M × Bangladesh Crop Disease — Training Run")
    log.info("=" * 70)
    log.info("  Device          : %s", DEVICE)
    if torch.cuda.is_available():
        log.info("  GPU             : %s", torch.cuda.get_device_name())
        log.info("  VRAM            : %.1f GB", torch.cuda.get_device_properties(0).total_mem / 1024**3)
    log.info("  Model           : %s", args.model_id)
    log.info("  Dataset         : %s", args.dataset_id)
    log.info("  LoRA            : r=%d α=%d  (QLoRA=%s)", args.lora_r, args.lora_alpha, args.use_qlora)
    log.info("  Batch           : %d × %d accum = %d effective", args.batch_size, args.grad_accum, args.batch_size * args.grad_accum)
    log.info("  Epochs          : %d", args.epochs)
    log.info("  LR              : %s", args.lr)
    log.info("  Output          : %s", args.output_dir)
    log.info("=" * 70)

    # ── 1. Load dataset ──────────────────────────────────────────────
    train_ds, eval_ds, class_names = load_crop_dataset(
        args.dataset_id, args.max_train, args.max_eval, hf_token,
    )

    # Save class names mapping for inference later
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "class_names.json").write_text(
        json.dumps(class_names, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log.info("Saved %d class names → %s", len(class_names), output_dir / "class_names.json")

    # ── 2. Load model + adapter ──────────────────────────────────────
    model, processor = load_model_and_processor(
        args.model_id, args.use_qlora, args.lora_r, args.lora_alpha,
    )

    # ── 3. Collate function ──────────────────────────────────────────
    collate_fn = make_collate_fn(processor, class_names)

    # ── 4. Training arguments ────────────────────────────────────────
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        run_name=run_name,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_ratio=0.05,
        learning_rate=args.lr,
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        logging_steps=args.logging_steps,
        save_strategy="steps",
        save_steps=args.save_steps,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        bf16=args.bf16 and torch.cuda.is_bf16_supported(),
        fp16=not args.bf16 and torch.cuda.is_available(),
        optim="paged_adamw_8bit" if args.use_qlora else "adamw_torch",
        report_to="tensorboard",
        remove_unused_columns=False,
        gradient_checkpointing=True,
        dataloader_pin_memory=True,
        dataloader_num_workers=2,
        seed=args.seed,
    )

    # ── 5. Trainer ───────────────────────────────────────────────────
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=collate_fn,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )

    # ── 6. Train! ────────────────────────────────────────────────────
    log.info("Starting training …")
    t0 = time.perf_counter()
    train_result = trainer.train()
    elapsed = time.perf_counter() - t0

    log.info("Training complete in %.1f min", elapsed / 60)
    log.info("  train_loss      : %.4f", train_result.training_loss)

    # ── 7. Save adapter + processor ──────────────────────────────────
    final_dir = output_dir / "final"
    trainer.save_model(str(final_dir))
    processor.save_pretrained(str(final_dir))
    log.info("Saved final model → %s", final_dir)

    # ── 8. Evaluate ──────────────────────────────────────────────────
    log.info("Running evaluation …")
    eval_result = trainer.evaluate()
    log.info("  eval_loss       : %.4f", eval_result.get("eval_loss", -1))

    # Save training summary
    summary = {
        "model_id": args.model_id,
        "dataset_id": args.dataset_id,
        "num_classes": len(class_names),
        "train_samples": len(train_ds),
        "eval_samples": len(eval_ds),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "grad_accum": args.grad_accum,
        "effective_batch": args.batch_size * args.grad_accum,
        "lr": args.lr,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "use_qlora": args.use_qlora,
        "training_loss": train_result.training_loss,
        "eval_loss": eval_result.get("eval_loss"),
        "training_time_min": round(elapsed / 60, 2),
        "device": DEVICE,
        "gpu": torch.cuda.get_device_name() if torch.cuda.is_available() else "cpu",
    }
    (output_dir / "training_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    log.info("Saved summary     → %s", output_dir / "training_summary.json")

    # ── 9. Push to Hub (optional) ────────────────────────────────────
    if args.push_to_hub:
        hub_repo = args.hub_repo or "smolvlm-256m-crop-disease"
        log.info("Pushing to Hub    → %s", hub_repo)
        trainer.push_to_hub(hub_repo)

    log.info("✓ Done!")


if __name__ == "__main__":
    main()
