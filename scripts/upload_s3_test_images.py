#!/usr/bin/env python3
"""Upload CIFAR-10 test images to S3 for Phase 3 real training test."""

import boto3
import os
from pathlib import Path
from datasets import load_dataset

MISSION_ID = "fb3c90da-9404-4cf4-957f-7a82ac266c96"
S3_BUCKET = "dataforall-uploads"
S3_ENDPOINT = "https://ewr2.vultrobjects.com"
LOCAL_DIR = "/tmp/dfa_cifar10_images"

S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")

if not S3_ACCESS_KEY or not S3_SECRET_KEY:
    print("S3 credentials not in env, fetching from ConfigMap...")
    import subprocess

    result = subprocess.run(
        [
            "kubectl",
            "get",
            "configmap",
            "dataforall-config",
            "-n",
            "dataforall",
            "-o",
            "jsonpath={.data.S3_ACCESS_KEY}",
        ],
        capture_output=True,
        text=True,
    )
    S3_ACCESS_KEY = result.stdout.strip()
    result = subprocess.run(
        [
            "kubectl",
            "get",
            "configmap",
            "dataforall-config",
            "-n",
            "dataforall",
            "-o",
            "jsonpath={.data.S3_SECRET_KEY}",
        ],
        capture_output=True,
        text=True,
    )
    S3_SECRET_KEY = result.stdout.strip()


def download_cifar10_images():
    """Download 20 test images from CIFAR-10."""
    print("Downloading CIFAR-10 test images (20 samples)...")
    ds = load_dataset("uoft-cs/cifar10", split="train[:20]")

    LOCAL_DIR = Path(LOCAL_DIR)
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)

    for i, example in enumerate(ds):
        example["image"].save(f"{LOCAL_DIR}/img_{i}.jpg")

    print(f"Saved 20 images to {LOCAL_DIR}")
    return LOCAL_DIR


def upload_to_s3(local_dir):
    """Upload images to S3 mission contributions path."""
    print(f"Uploading to S3 bucket {S3_BUCKET}...")
    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
    )

    local_dir = Path(local_dir)
    s3_prefix = f"missions/{MISSION_ID}/contributions/"
    uploaded = 0

    for img_path in sorted(local_dir.glob("*.jpg")):
        key = f"{s3_prefix}{img_path.name}"
        s3.upload_file(str(img_path), S3_BUCKET, key)
        print(f"  Uploaded: {key}")
        uploaded += 1

    print(f"Uploaded {uploaded} images to s3://{S3_BUCKET}/{s3_prefix}")
    return uploaded


def list_s3_files():
    """Verify upload by listing S3 files."""
    print(f"\nVerifying upload...")
    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
    )

    prefix = f"missions/{MISSION_ID}/contributions/"
    response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
    files = response.get("Contents", [])
    print(f"Found {len(files)} files in S3:")
    for f in files[:10]:
        print(f"  - {f['Key']}")
    if len(files) > 10:
        print(f"  ... and {len(files) - 10} more")
    return len(files)


if __name__ == "__main__":
    local_dir = download_cifar10_images()
    upload_to_s3(local_dir)
    file_count = list_s3_files()

    print(f"\n{'=' * 60}")
    print("Upload Complete!")
    print(f"{'=' * 60}")
    print(f"Files uploaded: {file_count}")
    print(f"S3 path: s3://{S3_BUCKET}/missions/{MISSION_ID}/contributions/")
    print(f"\nNext steps:")
    print(
        "1. Approve contributions: POST /api/training/contributions/approve-all?mission_id={MISSION_ID}"
    )
    print("2. Switch to real training mode")
    print("3. Trigger training job")
