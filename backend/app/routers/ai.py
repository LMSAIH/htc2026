import uuid
import asyncio
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.mission import Mission
from app.models.contribution import Contribution, ContributionStatus
from app.models.ai_model import AIModel, ModelStatus
from app.schemas.ai_model import (
    AIModelCreate,
    AIModelResponse,
    AIModelListResponse,
    TrainRequest,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/models", response_model=AIModelListResponse)
async def list_models(
    mission_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(AIModel)
    if mission_id:
        query = query.where(AIModel.mission_id == mission_id)
    result = await db.execute(query.order_by(AIModel.created_at.desc()))
    models = result.scalars().all()
    return AIModelListResponse(
        models=[AIModelResponse.model_validate(m) for m in models],
        total=len(models),
    )


@router.post("/train", response_model=AIModelResponse, status_code=201)
async def start_training(
    payload: TrainRequest,
    db: AsyncSession = Depends(get_db),
):
    # Verify mission exists and has approved contributions
    mission = (
        await db.execute(select(Mission).where(Mission.id == payload.mission_id))
    ).scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    approved_count = sum(
        1
        for c in (mission.contributions or [])
        if c.status == ContributionStatus.APPROVED
    )
    if approved_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Mission has no approved contributions to train on",
        )

    # Create model record
    model = AIModel(
        mission_id=payload.mission_id,
        name=payload.model_name,
        status=ModelStatus.QUEUED,
        total_epochs=payload.epochs,
    )
    db.add(model)
    await db.flush()
    await db.refresh(model)

    return AIModelResponse.model_validate(model)


@router.post("/models/{model_id}/simulate", response_model=AIModelResponse)
async def simulate_training(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Mock endpoint: instantly advance training by a few epochs."""
    result = await db.execute(select(AIModel).where(AIModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if model.status == ModelStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Training already completed")

    # Simulate progress
    model.status = ModelStatus.TRAINING
    advance = random.randint(1, 3)
    model.epochs_completed = min(model.epochs_completed + advance, model.total_epochs)

    if model.epochs_completed >= model.total_epochs:
        model.status = ModelStatus.COMPLETED
        model.accuracy = round(random.uniform(0.78, 0.96), 4)

    await db.flush()
    await db.refresh(model)
    return AIModelResponse.model_validate(model)


@router.get("/models/{model_id}", response_model=AIModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AIModel).where(AIModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return AIModelResponse.model_validate(model)
