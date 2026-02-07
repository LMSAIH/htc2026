from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_missions: int
    active_missions: int
    total_contributions: int
    pending_contributions: int
    approved_contributions: int
    rejected_contributions: int
    flagged_contributions: int
    total_models: int
    models_training: int
    models_completed: int
    top_contributors: list[dict]


class MissionStats(BaseModel):
    mission_id: str
    mission_title: str
    total_contributions: int
    approved: int
    pending: int
    rejected: int
    flagged: int
    progress_pct: float
