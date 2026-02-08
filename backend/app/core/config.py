from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://dataforall:dataforall@localhost:5432/dataforall"
    )

    # S3 / Vultr Object Storage
    S3_ENDPOINT_URL: str = "https://ewr1.vultrobjects.com"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = "dataforall-uploads"
    S3_REGION: str = "ewr1"

    # Database SSL
    DB_CA_CERT_PATH: str = ""  # Path to CA cert for SSL connections to managed Postgres

    # Vultr GPU Cloud
    VULTR_API_KEY: str = ""
    VULTR_DEFAULT_REGION: str = "ewr"
    VULTR_SSH_KEY_ID: str = ""

    # Lambda Labs GPU
    LAMBDA_API_KEY: str = ""
    LAMBDA_DEFAULT_REGION: str = "us-west-1"
    LAMBDA_SSH_KEY_NAME: str = "Arch Laptop"
    LAMBDA_DEFAULT_INSTANCE_TYPE: str = "gpu_1x_a10"
    LAMBDA_SSH_PRIVATE_KEY_PATH: str = "/etc/secrets/lambda-ssh-key"

    # Training mode: "local" (4060 Mobile), "vultr" (Cloud GPU), or "lambda" (Lambda Labs)
    TRAINING_MODE: str = "local"

    # HuggingFace Hub
    HF_TOKEN: str = ""

    # GPU Worker Callbacks
    CALLBACK_SECRET: str = ""  # Shared secret for GPU worker → API auth
    API_BASE_URL: str = ""  # e.g. https://api.dataforall.xyz — passed to GPU workers

    # Container Registry
    VULTR_REGISTRY_URL: str = "ewr.vultrcr.com"
    VULTR_REGISTRY_USERNAME: str = ""
    VULTR_REGISTRY_PASSWORD: str = ""  # API key for the registry
    GPU_WORKER_IMAGE: str = "ewr.vultrcr.com/dataforall/gpu-worker:latest"

    # App
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
