/**
 * User Profile API – Java 게이트웨이(8080) /api/v1/user-profile 경유
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface UserProfile {
  user_id: number;
  gender: string | null;
  age_band: string | null;
  dietary_pref: string | null;
  religion: string | null;
  nationality: string | null;
  is_complete: boolean;
}

export const GENDER_OPTIONS = ["남성", "여성", "기타", "무응답"] as const;
export const AGE_BAND_OPTIONS = ["10대", "20대", "30대", "40대", "50대", "60대이상"] as const;
export const DIETARY_OPTIONS = ["일반", "채식", "비건", "할랄", "알레르기있음"] as const;
export const RELIGION_OPTIONS = ["없음", "기독교", "불교", "천주교", "이슬람", "기타"] as const;
export const NATIONALITY_OPTIONS = [
  "한국",           // Korea
  "USA",            // United States
  "日本",            // Japan
  "中国",            // China
  "United Kingdom",
  "France",
  "Deutschland",    // Germany
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
] as const;

export async function fetchUserProfile(userId: number): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/user-profile/${userId}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`프로필 조회 오류: ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function upsertUserProfile(data: {
  userId: number;
  gender?: string;
  ageBand?: string;
  dietaryPref?: string;
  religion?: string;
  nationality?: string;
}): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/v1/user-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: data.userId,
      gender: data.gender ?? null,
      age_band: data.ageBand ?? null,
      dietary_pref: data.dietaryPref ?? null,
      religion: data.religion ?? null,
      nationality: data.nationality ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`프로필 저장 오류: ${res.status}`);
  return res.json();
}
