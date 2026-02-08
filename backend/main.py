from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.models.base import Base

# Import all models so Base.metadata knows about them
from app.models import Mission, Contribution, CurationAction, AIModel, TrainingJob  # noqa: F401

from app.routers import health, missions, contributions, curation, dashboard, ai, training

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist (dev convenience; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="DataForAll API",
    description="Community-driven AI-for-good data platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)  # /health — no /api prefix
app.include_router(missions.router, prefix="/api")
app.include_router(contributions.router, prefix="/api")
app.include_router(curation.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(training.router, prefix="/api")
