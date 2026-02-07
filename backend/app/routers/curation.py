import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.contribution import Contribution, ContributionStatus
from app.models.curation import CurationAction, CurationActionType
from app.schemas.curation import (
    CurationCreate,
    CurationResponse,
    CurationListResponse,
)

router = APIRouter(prefix="/curation", tags=["curation"])

# State machine: which actions are valid from which status
_ACTION_TO_STATUS: dict[CurationActionType, ContributionStatus] = {
    CurationActionType.APPROVE: ContributionStatus.APPROVED,
    CurationActionType.REJECT: ContributionStatus.REJECTED,
    CurationActionType.FLAG: ContributionStatus.FLAGGED,
    CurationActionType.RESET: ContributionStatus.PENDING,
}


@router.post("", response_model=CurationResponse, status_code=201)
async def curate_contribution(
    payload: CurationCreate,
    db: AsyncSession = Depends(get_db),
):
    # Fetch contribution
    result = await db.execute(
        select(Contribution).where(Contribution.id == payload.contribution_id)
    )
    contribution = result.scalar_one_or_none()
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    # Transition status
    new_status = _ACTION_TO_STATUS[payload.action]
    contribution.status = new_status

    # Record the action
    action = CurationAction(
        contribution_id=payload.contribution_id,
        action=payload.action,
        reviewer=payload.reviewer,
        notes=payload.notes,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)

    return CurationResponse.model_validate(action)


@router.get("", response_model=CurationListResponse)
async def list_curation_actions(
    contribution_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(CurationAction)
    count_query = select(func.count(CurationAction.id))

    if contribution_id:
        query = query.where(CurationAction.contribution_id == contribution_id)
        count_query = count_query.where(
            CurationAction.contribution_id == contribution_id
        )

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(CurationAction.created_at.desc()).offset(skip).limit(limit)
    )
    actions = result.scalars().all()

    return CurationListResponse(
        actions=[CurationResponse.model_validate(a) for a in actions],
        total=total,
    )
