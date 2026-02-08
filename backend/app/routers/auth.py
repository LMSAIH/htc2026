"""Auth router — register, login, me."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    AuthResponse,
    UserProfileResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(u: User) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(u.id),
        name=u.name,
        email=u.email,
        avatar=u.avatar or "",
        approved_contributions=u.approved_contributions,
        total_contributions=u.total_contributions,
        annotations=u.annotations,
        reviews=u.reviews,
        rank=u.rank,
        badge=u.badge,
        joined_at=u.created_at.isoformat() if u.created_at else "",
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicates
    exists = await db.execute(select(User).where(User.email == payload.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        avatar=f"https://api.dicebear.com/7.x/initials/svg?seed={payload.name}",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return AuthResponse(token=token, user=_user_response(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return AuthResponse(token=token, user=_user_response(user))


@router.get("/me", response_model=UserProfileResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_response(user)
