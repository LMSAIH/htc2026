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
