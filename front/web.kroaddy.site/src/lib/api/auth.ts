import apiClient from "./client";

export const logout = async (): Promise<void> => {
  await apiClient.post("/api/auth/logout");
};

export const refreshAccessToken = async (): Promise<string> => {
  const { data } = await apiClient.post<{ access_token: string }>("/api/auth/refresh");
  if (!data?.access_token?.trim())
    throw new Error("Refresh Token이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.");
  return data.access_token;
};

function _decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const getUserIdFromToken = (token?: string): string | null => {
  if (!token) return null;
  const p = _decodeJwtPayload(token);
  return (p?.sub as string) ?? (p?.userId as string) ?? (p?.id as string) ?? null;
};

/** JWT 의 app_user_id 클레임 → 숫자 반환 (DB 저장용). */
export const getAppUserIdFromToken = (token?: string): number | null => {
  if (!token) return null;
  const p = _decodeJwtPayload(token);
  const v = p?.app_user_id ?? p?.appUserId ?? p?.userId;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** JWT 액세스 토큰이 만료됐는지 확인 (여유 30초 포함). */
export const isTokenExpired = (token?: string | null): boolean => {
  if (!token) return true;
  const p = _decodeJwtPayload(token);
  if (!p?.exp) return true;
  return Date.now() / 1000 >= (p.exp as number) - 30; // 30초 여유
};

/**
 * 현재 액세스 토큰이 만료됐으면 리프레시 후 새 토큰을 반환.
 * 유효하면 기존 토큰 그대로 반환.
 */
export const getEnsuredAccessToken = async (currentToken: string | null): Promise<string | null> => {
  if (!isTokenExpired(currentToken)) return currentToken;
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
};
