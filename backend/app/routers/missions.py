import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user
from app.models.mission import Mission, MissionStatus
from app.models.user import User
from app.models.dataset import Dataset
from app.models.data_file import DataFile, FileStatus
from app.models.file_annotation import FileAnnotation
from app.models.mission_member import MissionMember, MemberRole
from app.schemas.mission import (
    MissionCreate,
    MissionUpdate,
    MissionResponse,
    MissionListResponse,
    DatasetBrief,
    ContributorBrief,
)

router = APIRouter(prefix="/missions", tags=["missions"])


# ── helpers ──────────────────────────────────────────────────────────
def _dataset_brief(ds: Dataset) -> DatasetBrief:
    return DatasetBrief(
        id=str(ds.id),
        name=ds.name,
        description=ds.description or "",
        file_count=ds.file_count,
        total_size_mb=ds.total_size_mb,
        accepted_types=ds.accepted_types,
        created_at=ds.created_at.isoformat() if ds.created_at else "",
    )


def _contributor_brief(m: MissionMember) -> ContributorBrief:
    return ContributorBrief(
        user_id=str(m.user_id),
        user_name=m.user.name if m.user else "",
        role=m.role.value if m.role else "contributor",
        approved_count=m.approved_count,
        total_count=m.total_count,
    )


def _mission_response(m: Mission) -> MissionResponse:
    return MissionResponse(
        id=str(m.id),
        title=m.title,
        description=m.description,
        reason=m.reason or "",
        how_to_contribute=m.how_to_contribute or "",
        category=m.category or "",
        model_type=m.model_type or "vision",
        data_type=m.data_type,
        status=m.status,
        owner_id=str(m.owner_id) if m.owner_id else None,
        owner_name=m.owner_name or "",
        accepted_types=m.accepted_types,
        target_contributions=m.goal_count,
        current_contributions=m.current_contributions or 0,
        model_available=m.model_available or False,
        configured_tasks=m.configured_tasks,
        datasets=[_dataset_brief(d) for d in (m.datasets or [])],
        contributors=[_contributor_brief(c) for c in (m.members or [])],
        created_at=m.created_at.isoformat() if m.created_at else "",
        updated_at=m.updated_at.isoformat() if m.updated_at else None,
    )


# ── LIST ─────────────────────────────────────────────────────────────
@router.get("", response_model=MissionListResponse)
async def list_missions(
    status: MissionStatus | None = None,
    category: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Mission)
    count_query = select(func.count(Mission.id))

    if status:
        query = query.where(Mission.status == status)
        count_query = count_query.where(Mission.status == status)
    if category:
        query = query.where(Mission.category == category)
        count_query = count_query.where(Mission.category == category)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Mission.created_at.desc()).offset(skip).limit(limit)
    )
    missions = result.scalars().all()

    return MissionListResponse(
        missions=[_mission_response(m) for m in missions],
        total=total,
    )


# ── CREATE ───────────────────────────────────────────────────────────
@router.post("", response_model=MissionResponse, status_code=201)
async def create_mission(
    payload: MissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mission = Mission(
        title=payload.title,
        description=payload.description,
        reason=payload.reason,
        how_to_contribute=payload.how_to_contribute,
        category=payload.category,
        model_type=payload.model_type,
        data_type=payload.data_type,
        goal_count=payload.goal_count,
        accepted_types=payload.accepted_types,
        configured_tasks=payload.configured_tasks,
        owner_id=user.id,
        owner_name=user.name,
    )
    db.add(mission)
    await db.flush()
    await db.refresh(mission)

    # Create initial datasets if provided
    if payload.datasets:
        for ds_data in payload.datasets:
            ds = Dataset(
                mission_id=mission.id,
                name=ds_data.get("name", "Default"),
                description=ds_data.get("description", ""),
                accepted_types=payload.accepted_types,
            )
            db.add(ds)
        await db.flush()
        await db.refresh(mission)

    # Auto-join creator as contributor
    member = MissionMember(
        mission_id=mission.id,
        user_id=user.id,
        role=MemberRole.CONTRIBUTOR,
    )
    db.add(member)
    await db.flush()
    await db.refresh(mission)

    return _mission_response(mission)


# ── GET ONE ──────────────────────────────────────────────────────────
@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return _mission_response(mission)


# ── UPDATE ───────────────────────────────────────────────────────────
@router.patch("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: uuid.UUID,
    payload: MissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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
    return _mission_response(mission)


# ── DELETE ───────────────────────────────────────────────────────────
@router.delete("/{mission_id}", status_code=204)
async def delete_mission(
    mission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    await db.delete(mission)


# ── JOIN MISSION ─────────────────────────────────────────────────────
@router.post("/{mission_id}/join")
async def join_mission(
    mission_id: uuid.UUID,
    role: str = "contributor",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify mission exists
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    # Check not already a member
    existing = await db.execute(
        select(MissionMember).where(
            MissionMember.mission_id == mission_id,
            MissionMember.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a member")

    role_enum = MemberRole(role) if role in [r.value for r in MemberRole] else MemberRole.CONTRIBUTOR
    member = MissionMember(
        mission_id=mission_id,
        user_id=user.id,
        role=role_enum,
    )
    db.add(member)
    await db.flush()
    return {"ok": True}


# ── MY MISSIONS ──────────────────────────────────────────────────────
@router.get("/user/me", response_model=MissionListResponse)
async def my_missions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Missions where user is a member
    result = await db.execute(
        select(MissionMember.mission_id).where(MissionMember.user_id == user.id)
    )
    mission_ids = [row[0] for row in result.all()]
    if not mission_ids:
        return MissionListResponse(missions=[], total=0)

    result = await db.execute(
        select(Mission).where(Mission.id.in_(mission_ids))
        .order_by(Mission.created_at.desc())
    )
    missions = result.scalars().all()
    return MissionListResponse(
        missions=[_mission_response(m) for m in missions],
        total=len(missions),
    )


# ── UPLOAD FILES ─────────────────────────────────────────────────────
@router.post("/{mission_id}/datasets/{dataset_id}/files")
async def upload_files(
    mission_id: uuid.UUID,
    dataset_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify dataset belongs to mission
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.mission_id == mission_id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    created = []
    for f in files:
        content = await f.read()
        size_kb = len(content) // 1024

        data_file = DataFile(
            dataset_id=dataset_id,
            filename=f.filename or "unknown",
            size_kb=size_kb,
            file_type=f.content_type or "application/octet-stream",
            status=FileStatus.PENDING,
            contributor_id=user.id,
            contributor_name=user.name,
        )
        db.add(data_file)
        created.append(data_file)

    # Update dataset counts
    dataset.file_count = (dataset.file_count or 0) + len(created)
    dataset.total_size_mb = round(
        (dataset.total_size_mb or 0) + sum(df.size_kb for df in created) / 1024, 2
    )

    # Update user stats
    user.total_contributions += len(created)

    # Update mission contributions
    result2 = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result2.scalar_one_or_none()
    if mission:
        mission.current_contributions = (mission.current_contributions or 0) + len(created)

    # Update member stats
    member_r = await db.execute(
        select(MissionMember).where(
            MissionMember.mission_id == mission_id,
            MissionMember.user_id == user.id,
        )
    )
    member = member_r.scalar_one_or_none()
    if member:
        member.total_count = (member.total_count or 0) + len(created)

    await db.flush()

    return {
        "uploaded": len(created),
        "files": [
            {
                "id": str(df.id),
                "filename": df.filename,
                "size_kb": df.size_kb,
                "status": df.status.value,
            }
            for df in created
        ],
    }


# ── GET FILES ────────────────────────────────────────────────────────
@router.get("/{mission_id}/datasets/{dataset_id}/files")
async def list_files(
    mission_id: uuid.UUID,
    dataset_id: uuid.UUID,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(DataFile).where(DataFile.dataset_id == dataset_id)
    if status:
        query = query.where(DataFile.status == FileStatus(status))
    result = await db.execute(query.order_by(DataFile.created_at.desc()))
    files = result.scalars().all()
    return {
        "files": [
            {
                "id": str(f.id),
                "filename": f.filename,
                "size_kb": f.size_kb,
                "type": f.file_type,
                "status": f.status.value,
                "contributor_id": str(f.contributor_id) if f.contributor_id else None,
                "contributor_name": f.contributor_name,
                "uploaded_at": f.created_at.isoformat() if f.created_at else "",
                "annotations": [
                    {
                        "id": str(a.id),
                        "annotator_id": str(a.annotator_id) if a.annotator_id else None,
                        "annotator_name": a.annotator_name,
                        "label": a.label,
                        "notes": a.notes,
                        "created_at": a.created_at.isoformat() if a.created_at else "",
                    }
                    for a in (f.annotations or [])
                ],
            }
            for f in files
        ]
    }


# ── FILE REVIEW (approve / reject) ──────────────────────────────────
@router.post("/{mission_id}/files/{file_id}/review")
async def review_file(
    mission_id: uuid.UUID,
    file_id: uuid.UUID,
    action: str = "approve",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(DataFile).where(DataFile.id == file_id))
    data_file = result.scalar_one_or_none()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")

    if action == "approve":
        if data_file.status == FileStatus.PENDING:
            data_file.status = FileStatus.NEEDS_ANNOTATION
        elif data_file.status == FileStatus.PENDING_REVIEW:
            data_file.status = FileStatus.APPROVED
            # Increment contributor's approved count
            if data_file.contributor_id:
                contrib_r = await db.execute(
                    select(User).where(User.id == data_file.contributor_id)
                )
                contributor = contrib_r.scalar_one_or_none()
                if contributor:
                    contributor.approved_contributions += 1
            # Increment member approved count
            if data_file.contributor_id:
                member_r = await db.execute(
                    select(MissionMember).where(
                        MissionMember.mission_id == mission_id,
                        MissionMember.user_id == data_file.contributor_id,
                    )
                )
                member = member_r.scalar_one_or_none()
                if member:
                    member.approved_count = (member.approved_count or 0) + 1
    elif action == "reject":
        data_file.status = FileStatus.REJECTED

    # Update reviewer stats
    user.reviews += 1

    await db.flush()
    return {"status": data_file.status.value}


# ── ANNOTATE FILE ────────────────────────────────────────────────────
@router.post("/{mission_id}/files/{file_id}/annotate")
async def annotate_file(
    mission_id: uuid.UUID,
    file_id: uuid.UUID,
    label: str = "",
    notes: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(DataFile).where(DataFile.id == file_id))
    data_file = result.scalar_one_or_none()
    if not data_file:
        raise HTTPException(status_code=404, detail="File not found")

    annotation = FileAnnotation(
        data_file_id=file_id,
        annotator_id=user.id,
        annotator_name=user.name,
        label=label,
        notes=notes,
    )
    db.add(annotation)

    # Move file to pending_review after annotation
    if data_file.status == FileStatus.NEEDS_ANNOTATION:
        data_file.status = FileStatus.PENDING_REVIEW

    # Update user annotation count
    user.annotations += 1

    await db.flush()
    return {"ok": True, "status": data_file.status.value}


# ── UPDATE CONFIGURED TASKS ─────────────────────────────────────────
@router.put("/{mission_id}/tasks")
async def update_tasks(
    mission_id: uuid.UUID,
    tasks: list[dict],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission.configured_tasks = tasks
    await db.flush()
    return {"ok": True}
