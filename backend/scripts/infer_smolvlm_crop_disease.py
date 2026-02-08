"""
╔══════════════════════════════════════════════════════════════════════════╗
║  DataForAll — SmolVLM-256M Crop-Disease Inference Script               ║
║                                                                        ║
║  Run against the fine-tuned LoRA adapter or the base model.            ║
║                                                                        ║
║  Usage:                                                                ║
║    python scripts/infer_smolvlm_crop_disease.py  image.jpg             ║
║    python scripts/infer_smolvlm_crop_disease.py  image.jpg --adapter   ║
║           ./output/smolvlm-crop-disease/final                          ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
import json
import argparse
import logging
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForVision2Seq
from transformers.image_utils import load_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("smolvlm-infer")

MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

SYSTEM_PROMPT = (
    "You are an expert agricultural pathologist. "
    "Identify the crop species and its disease or health status "
    "from this image. Respond with only the class label."
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Inference with SmolVLM crop disease model")
    p.add_argument("image", help="Path or URL to the image to classify")
    p.add_argument("--model-id", default=MODEL_ID)
    p.add_argument("--adapter", default=None,
                   help="Path to LoRA adapter directory (e.g. ./output/smolvlm-crop-disease/final)")
    p.add_argument("--class-names", default=None,
                   help="Path to class_names.json for pretty-printing")
    p.add_argument("--max-tokens", type=int, default=64)
    p.add_argument("--top-k", type=int, default=3,
                   help="Show top-K most likely classes (requires class_names)")
    return p.parse_args()


def load_model(model_id: str, adapter_path: str | None):
    """Load base model + optional LoRA adapter."""
    log.info("Loading processor: %s", model_id)
    processor_path = adapter_path if adapter_path else model_id
    processor = AutoProcessor.from_pretrained(processor_path)

    attn_impl = "eager" if sys.platform == "win32" else "flash_attention_2"

    log.info("Loading model: %s → %s", model_id, DEVICE)
    model = AutoModelForVision2Seq.from_pretrained(
        model_id,
        torch_dtype=torch.bfloat16,
        _attn_implementation=attn_impl,
    ).to(DEVICE)

    if adapter_path:
        from peft import PeftModel
        log.info("Loading LoRA adapter: %s", adapter_path)
        model = PeftModel.from_pretrained(model, adapter_path)
        model = model.merge_and_unload()
        log.info("Adapter merged ✓")

    model.eval()
    return model, processor


def classify_image(
    model,
    processor,
    image: Image.Image,
    max_tokens: int = 64,
) -> str:
    """Run a single image through the model and return the predicted label."""
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": SYSTEM_PROMPT},
            ],
        },
    ]

    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[image], return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=max_tokens)

    # Decode only the newly generated tokens (skip the prompt)
    prompt_len = inputs["input_ids"].shape[-1]
    output_ids = generated_ids[0][prompt_len:]
    prediction = processor.tokenizer.decode(output_ids, skip_special_tokens=True).strip()
    return prediction


def main():
    args = parse_args()

    # ── Load class names if available ────────────────────────────────
    class_names: list[str] | None = None
    class_names_path = args.class_names
    if not class_names_path and args.adapter:
        candidate = Path(args.adapter).parent / "class_names.json"
        if candidate.exists():
            class_names_path = str(candidate)

    if class_names_path and Path(class_names_path).exists():
        class_names = json.loads(Path(class_names_path).read_text(encoding="utf-8"))
        log.info("Loaded %d class names from %s", len(class_names), class_names_path)

    # ── Load model ───────────────────────────────────────────────────
    model, processor = load_model(args.model_id, args.adapter)

    # ── Load image ───────────────────────────────────────────────────
    log.info("Classifying: %s", args.image)
    if args.image.startswith(("http://", "https://")):
        image = load_image(args.image)
    else:
        image = Image.open(args.image)
    if image.mode != "RGB":
        image = image.convert("RGB")

    # ── Predict ──────────────────────────────────────────────────────
    prediction = classify_image(model, processor, image, args.max_tokens)

    print("\n" + "=" * 60)
    print(f"  Image      : {args.image}")
    print(f"  Prediction : {prediction}")

    # Fuzzy-match against known class names
    if class_names:
        pred_lower = prediction.lower().replace(" ", "_")
        matches = [
            cn for cn in class_names
            if pred_lower in cn.lower() or cn.lower() in pred_lower
        ]
        if matches:
            print(f"  Matched    : {matches[0]}")
        else:
            print(f"  (no exact class match — showing raw model output)")

    print("=" * 60 + "\n")

    vram = torch.cuda.memory_allocated() / 1024**3 if torch.cuda.is_available() else 0
    log.info("Peak VRAM: %.2f GB", vram)


if __name__ == "__main__":
    main()
