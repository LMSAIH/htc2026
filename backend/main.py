from contextlib import asynccontextmanager

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.models.base import Base

# Import all models so Base.metadata knows about them
from app.models import (
    Mission,
    Contribution,
    CurationAction,
    AIModel,
    TrainingJob,
    PersistentWorker,
)  # noqa: F401

from app.routers import (
    health,
    missions,
    contributions,
    curation,
    dashboard,
    ai,
    training,
)
from app.services import training_orchestrator

settings = get_settings()

logger = logging.getLogger(__name__)

# Ensure app logs (logger.info/...) are visible in k8s
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)

# Keep references so we can cancel on shutdown
_background_tasks: list[asyncio.Task] = []

ORPHAN_CLEANUP_INTERVAL = 300  # 5 minutes


async def _orphan_cleanup_loop() -> None:
    """Periodically call cleanup_orphaned_jobs() every ORPHAN_CLEANUP_INTERVAL seconds."""
    logger.info(
        "Orphaned-job cleanup loop started (interval=%ds)", ORPHAN_CLEANUP_INTERVAL
    )
    while True:
        try:
            await training_orchestrator.cleanup_orphaned_jobs()
        except Exception as exc:
            logger.error("Orphaned-job cleanup failed: %s", exc)
        await asyncio.sleep(ORPHAN_CLEANUP_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist (dev convenience; use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start safety background tasks
    _background_tasks.append(
        asyncio.create_task(training_orchestrator.monitor_heartbeats())
    )
    _background_tasks.append(asyncio.create_task(_orphan_cleanup_loop()))
    logger.info("Background safety monitors started (%d tasks)", len(_background_tasks))

    yield

    # Shutdown: cancel background tasks, then dispose engine
    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)
    _background_tasks.clear()
    logger.info("Background tasks stopped")
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
