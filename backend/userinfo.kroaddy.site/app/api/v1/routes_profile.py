"""유저 프로필 API – 생성/조회/수정."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.models.user_profile import UserProfile
from .schemas_profile import UserProfileUpsert, UserProfileResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/user-profile", tags=["user-profile"])


def _to_response(profile: UserProfile) -> UserProfileResponse:
    is_complete = all([
        profile.gender,
        profile.age_band,
        profile.dietary_pref,
        profile.religion,
    ])
    return UserProfileResponse(
        user_id=profile.user_id,
        gender=profile.gender,
        age_band=profile.age_band,
        dietary_pref=profile.dietary_pref,
        religion=profile.religion,
        nationality=profile.nationality,
        is_complete=is_complete,
    )


@router.get("/{user_id}", summary="유저 프로필 조회")
async def get_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="프로필 없음")
    return _to_response(profile)


@router.post("", summary="유저 프로필 저장 (upsert)")
async def upsert_profile(req: UserProfileUpsert, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == req.user_id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        # 기존 프로필 업데이트 (null 값은 유지)
        if req.gender is not None:
            profile.gender = req.gender
        if req.age_band is not None:
            profile.age_band = req.age_band
        if req.dietary_pref is not None:
            profile.dietary_pref = req.dietary_pref
        if req.religion is not None:
            profile.religion = req.religion
        if req.nationality is not None:
            profile.nationality = req.nationality
        logger.info("프로필 업데이트: user_id=%s", req.user_id)
    else:
        profile = UserProfile(
            user_id=req.user_id,
            gender=req.gender,
            age_band=req.age_band,
            dietary_pref=req.dietary_pref,
            religion=req.religion,
            nationality=req.nationality,
        )
        db.add(profile)
        logger.info("프로필 신규 생성: user_id=%s", req.user_id)

    await db.flush()
    return _to_response(profile)
