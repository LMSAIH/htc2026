"""Auth schemas — login, signup, token, user profile."""
from pydantic import BaseModel, EmailStr
from datetime import datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserProfileResponse"


class UserProfileResponse(BaseModel):
    id: str
    name: str
    avatar: str
    email: str
    approved_contributions: int
    total_contributions: int
    annotations: int
    reviews: int
    rank: int
    badge: str
    joined_at: str

    model_config = {"from_attributes": True}
