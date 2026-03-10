"""유저 프로필 Pydantic 스키마."""
from typing import Optional
from pydantic import BaseModel


GENDER_OPTIONS = ["남성", "여성", "기타", "무응답"]
AGE_BAND_OPTIONS = ["10대", "20대", "30대", "40대", "50대", "60대이상"]
DIETARY_OPTIONS = ["일반", "채식", "비건", "할랄", "알레르기있음"]
RELIGION_OPTIONS = ["없음", "기독교", "불교", "천주교", "이슬람", "기타"]
NATIONALITY_OPTIONS = [
    "한국",       # Korea
    "USA",        # United States
    "日本",        # Japan
    "中国",        # China
    "United Kingdom",
    "France",
    "Deutschland",  # Germany
    "Canada",
    "Australia",
    "Việt Nam",
    "Thailand",
    "Philippines",
    "Indonesia",
    "Singapore",
    "Malaysia",
    "India",
    "Other",
]


class UserProfileUpsert(BaseModel):
    user_id: int
    gender: Optional[str] = None
    age_band: Optional[str] = None
    dietary_pref: Optional[str] = None
    religion: Optional[str] = None
    nationality: Optional[str] = None


class UserProfileResponse(BaseModel):
    user_id: int
    gender: Optional[str] = None
    age_band: Optional[str] = None
    dietary_pref: Optional[str] = None
    religion: Optional[str] = None
    nationality: Optional[str] = None
    is_complete: bool = False   # 주요 항목 모두 입력 완료 여부

    model_config = {"from_attributes": True}
