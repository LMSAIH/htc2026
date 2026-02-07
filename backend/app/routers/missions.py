import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.mission import Mission, MissionStatus
from app.schemas.mission import (
    MissionCreate,
    MissionUpdate,
    MissionResponse,
    MissionListResponse,
)

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=MissionListResponse)
async def list_missions(
    status: MissionStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Mission)
    count_query = select(func.count(Mission.id))

    if status:
        query = query.where(Mission.status == status)
        count_query = count_query.where(Mission.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Mission.created_at.desc()).offset(skip).limit(limit)
    )
    missions = result.scalars().all()

    return MissionListResponse(
        missions=[
            MissionResponse(
                **{c.key: getattr(m, c.key) for c in Mission.__table__.columns},
                contribution_count=len(m.contributions) if m.contributions else 0,
            )
            for m in missions
        ],
        total=total,
    )


@router.post("", response_model=MissionResponse, status_code=201)
async def create_mission(
    payload: MissionCreate,
    db: AsyncSession = Depends(get_db),
):
    mission = Mission(**payload.model_dump())
    db.add(mission)
    await db.flush()
    await db.refresh(mission)
    return MissionResponse(
        **{c.key: getattr(mission, c.key) for c in Mission.__table__.columns},
        contribution_count=0,
    )


@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return MissionResponse(
        **{c.key: getattr(mission, c.key) for c in Mission.__table__.columns},
        contribution_count=len(mission.contributions) if mission.contributions else 0,
    )


@router.patch("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: uuid.UUID,
    payload: MissionUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mission, key, value)

    await db.flush()
    await db.refresh(mission)
    return MissionResponse(
        **{c.key: getattr(mission, c.key) for c in Mission.__table__.columns},
        contribution_count=len(mission.contributions) if mission.contributions else 0,
    )


@router.delete("/{mission_id}", status_code=204)
async def delete_mission(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    await db.delete(mission)
