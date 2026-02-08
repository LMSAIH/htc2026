"""Leaderboard schemas."""
from pydantic import BaseModel


class LeaderboardEntryResponse(BaseModel):
    user_id: str
    user_name: str
    approved_contributions: int
    annotations: int
    reviews: int
    score: int
    rank: int
    badge: str

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntryResponse]
    total: int
