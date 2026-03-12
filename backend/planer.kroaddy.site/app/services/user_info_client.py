"""user_info 서비스에서 사용자 여행 프로필 조회."""
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def fetch_user_profile(user_id: Optional[int]) -> Optional[dict]:
    """user_info 서비스에서 사용자 프로필을 조회한다.

    프로필이 없거나 조회 실패 시 None을 반환 (에러 미전파).
    """
    if not user_id:
        return None

    url = f"{settings.user_info_service_url}/api/v1/user-profile/{user_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                profile = resp.json()
                logger.info("유저 프로필 조회 성공: user_id=%s", user_id)
                return profile
            elif resp.status_code == 404:
                logger.info("유저 프로필 없음: user_id=%s", user_id)
                return None
            else:
                logger.warning("유저 프로필 조회 실패: status=%s user_id=%s", resp.status_code, user_id)
                return None
    except Exception as e:
        logger.warning("유저 프로필 서비스 연결 실패: %s", e)
        return None
