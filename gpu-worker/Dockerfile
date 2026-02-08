# gpu-worker/Dockerfile
# Heavy image: CUDA + PyTorch + HuggingFace for ML training
# Used on ephemeral Vultr GH200 bare metal servers (one-shot per job)

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

# Avoid interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Symlink python
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /worker

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY train.py .

# Entry point: run the training script and exit
# The container is meant to be one-shot — run, report results, exit.
ENTRYPOINT ["python", "train.py"]
