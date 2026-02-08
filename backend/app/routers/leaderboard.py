"""Leaderboard router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.leaderboard import LeaderboardEntryResponse, LeaderboardResponse

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _compute_score(u: User) -> int:
    return (u.approved_contributions * 3) + (u.annotations * 2) + (u.reviews * 1)


def _get_badge(approved: int) -> str:
    if approved >= 500:
        return "🏆 Legend"
    if approved >= 200:
        return "💎 Diamond"
    if approved >= 100:
        return "🥇 Gold"
    if approved >= 50:
        return "🥈 Silver"
    if approved >= 20:
        return "🥉 Bronze"
    if approved >= 5:
        return "⭐ Starter"
    return "🌱 New"


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).order_by(desc(User.approved_contributions)).limit(limit)
    )
    users = result.scalars().all()

    entries = []
    for rank, u in enumerate(users, start=1):
        entries.append(
            LeaderboardEntryResponse(
                user_id=str(u.id),
                user_name=u.name,
                approved_contributions=u.approved_contributions,
                annotations=u.annotations,
                reviews=u.reviews,
                score=_compute_score(u),
                rank=rank,
                badge=_get_badge(u.approved_contributions),
            )
        )

    return LeaderboardResponse(entries=entries, total=len(entries))
