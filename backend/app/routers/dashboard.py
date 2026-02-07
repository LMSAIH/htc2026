from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.mission import Mission, MissionStatus
from app.models.contribution import Contribution, ContributionStatus
from app.models.ai_model import AIModel, ModelStatus
from app.schemas.dashboard import DashboardStats, MissionStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Mission counts
    total_missions = (await db.execute(select(func.count(Mission.id)))).scalar() or 0
    active_missions = (
        await db.execute(
            select(func.count(Mission.id)).where(Mission.status == MissionStatus.ACTIVE)
        )
    ).scalar() or 0

    # Contribution counts by status
    contrib_counts = (
        await db.execute(
            select(
                func.count(Contribution.id).label("total"),
                func.count(
                    case((Contribution.status == ContributionStatus.PENDING, 1))
                ).label("pending"),
                func.count(
                    case((Contribution.status == ContributionStatus.APPROVED, 1))
                ).label("approved"),
                func.count(
                    case((Contribution.status == ContributionStatus.REJECTED, 1))
                ).label("rejected"),
                func.count(
                    case((Contribution.status == ContributionStatus.FLAGGED, 1))
                ).label("flagged"),
            )
        )
    ).one()

    # AI model counts
    total_models = (await db.execute(select(func.count(AIModel.id)))).scalar() or 0
    models_training = (
        await db.execute(
            select(func.count(AIModel.id)).where(AIModel.status == ModelStatus.TRAINING)
        )
    ).scalar() or 0
    models_completed = (
        await db.execute(
            select(func.count(AIModel.id)).where(
                AIModel.status == ModelStatus.COMPLETED
            )
        )
    ).scalar() or 0

    # Top contributors
    top_q = (
        await db.execute(
            select(
                Contribution.contributor_name,
                func.count(Contribution.id).label("count"),
            )
            .group_by(Contribution.contributor_name)
            .order_by(func.count(Contribution.id).desc())
            .limit(10)
        )
    ).all()
    top_contributors = [
        {"name": row.contributor_name, "contributions": row.count} for row in top_q
    ]

    return DashboardStats(
        total_missions=total_missions,
        active_missions=active_missions,
        total_contributions=contrib_counts.total,
        pending_contributions=contrib_counts.pending,
        approved_contributions=contrib_counts.approved,
        rejected_contributions=contrib_counts.rejected,
        flagged_contributions=contrib_counts.flagged,
        total_models=total_models,
        models_training=models_training,
        models_completed=models_completed,
        top_contributors=top_contributors,
    )


@router.get("/missions", response_model=list[MissionStats])
async def get_mission_stats(db: AsyncSession = Depends(get_db)):
    missions = (
        (await db.execute(select(Mission).order_by(Mission.created_at.desc())))
        .scalars()
        .all()
    )

    stats = []
    for m in missions:
        contribs = m.contributions or []
        approved = sum(1 for c in contribs if c.status == ContributionStatus.APPROVED)
        stats.append(
            MissionStats(
                mission_id=str(m.id),
                mission_title=m.title,
                total_contributions=len(contribs),
                approved=approved,
                pending=sum(
                    1 for c in contribs if c.status == ContributionStatus.PENDING
                ),
                rejected=sum(
                    1 for c in contribs if c.status == ContributionStatus.REJECTED
                ),
                flagged=sum(
                    1 for c in contribs if c.status == ContributionStatus.FLAGGED
                ),
                progress_pct=round((approved / m.goal_count) * 100, 1)
                if m.goal_count > 0
                else 0.0,
            )
        )
    return stats
