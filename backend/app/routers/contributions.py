import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.mission import Mission
from app.models.contribution import Contribution, ContributionStatus
from app.schemas.contribution import (
    ContributionCreate,
    ContributionResponse,
    ContributionListResponse,
    PresignedUploadResponse,
)
from app.services.s3 import generate_s3_key, generate_presigned_upload_url

router = APIRouter(prefix="/contributions", tags=["contributions"])


@router.get("", response_model=ContributionListResponse)
async def list_contributions(
    mission_id: uuid.UUID | None = None,
    status: ContributionStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Contribution)
    count_query = select(func.count(Contribution.id))

    if mission_id:
        query = query.where(Contribution.mission_id == mission_id)
        count_query = count_query.where(Contribution.mission_id == mission_id)
    if status:
        query = query.where(Contribution.status == status)
        count_query = count_query.where(Contribution.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Contribution.created_at.desc()).offset(skip).limit(limit)
    )
    contributions = result.scalars().all()

    return ContributionListResponse(
        contributions=[ContributionResponse.model_validate(c) for c in contributions],
        total=total,
    )


@router.post("/upload", response_model=PresignedUploadResponse, status_code=201)
async def request_upload(
    payload: ContributionCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify mission exists
    mission = await db.execute(select(Mission).where(Mission.id == payload.mission_id))
    if not mission.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Mission not found")

    # Generate S3 key and presigned URL
    s3_key = generate_s3_key(payload.mission_id, payload.filename)
    upload_url = generate_presigned_upload_url(s3_key, payload.content_type)

    # Create contribution record
    contribution = Contribution(
        mission_id=payload.mission_id,
        filename=payload.filename,
        s3_key=s3_key,
        content_type=payload.content_type,
        contributor_name=payload.contributor_name,
        status=ContributionStatus.PENDING,
    )
    db.add(contribution)
    await db.flush()
    await db.refresh(contribution)

    return PresignedUploadResponse(
        contribution_id=contribution.id,
        upload_url=upload_url,
        s3_key=s3_key,
    )


@router.get("/{contribution_id}", response_model=ContributionResponse)
async def get_contribution(
    contribution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contribution).where(Contribution.id == contribution_id)
    )
    contribution = result.scalar_one_or_none()
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")
    return ContributionResponse.model_validate(contribution)


@router.post("/{contribution_id}/approve", response_model=ContributionResponse)
async def approve_contribution(
    contribution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Approve a contribution for training."""
    result = await db.execute(
        select(Contribution).where(Contribution.id == contribution_id)
    )
    contribution = result.scalar_one_or_none()
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    contribution.status = ContributionStatus.APPROVED
    await db.commit()
    await db.refresh(contribution)

    return ContributionResponse.model_validate(contribution)


@router.post("/approve-all", response_model=dict)
async def approve_all_contributions(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Approve all contributions for a mission."""
    result = await db.execute(
        select(Contribution).where(
            Contribution.mission_id == mission_id,
            Contribution.status == ContributionStatus.PENDING,
        )
    )
    contributions = result.scalars().all()

    if not contributions:
        return {
            "approved": 0,
            "message": "No pending contributions found for this mission",
        }

    for contribution in contributions:
        contribution.status = ContributionStatus.APPROVED

    await db.commit()
    return {
        "approved": len(contributions),
        "message": f"Approved {len(contributions)} contributions for mission {mission_id}",
    }
