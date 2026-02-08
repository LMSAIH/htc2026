# Vultr GPU Archive

This directory contains the original Vultr GPU provisioning code that was used before
migrating to Lambda Labs for GPU instances.

## Why the change?

Vultr GPU plans (`vcg-a100-1c-6g-4vram`) require a manual support ticket to enable
account-level access. Since HTC 2026 is time-constrained, we switched to Lambda Labs
which provides on-demand GPU instances via API without an approval process.

## What's here

- **`vultr_gpu.py`** — Original Vultr GPU service (provisions bare-metal GPU instances
  via the Vultr API, delivers startup scripts via cloud-init `user_data`).
- **`training_orchestrator.py`** — Snapshot of the orchestrator before it was updated
  to use Lambda Labs.

## What changed in production

- `backend/app/services/lambda_gpu.py` replaced `vultr_gpu.py`
- Lambda instances are provisioned via the Lambda Labs API, then configured over SSH
  (paramiko) since Lambda doesn't support cloud-init.
- Everything else (Kubernetes, container registry, object storage, database) stays on Vultr.
