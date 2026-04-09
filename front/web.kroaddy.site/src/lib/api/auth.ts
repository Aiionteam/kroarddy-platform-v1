import apiClient from "./client";
import i18n from "@/lib/i18n/config";

export const logout = async (): Promise<void> => {
  await apiClient.post("/api/auth/logout");
};

/**
 * 싱글턴 Refresh 패턴
 *
 * 여러 컴포넌트/훅이 동시에 refreshAccessToken()을 호출해도
 * 실제 HTTP 요청은 딱 1번만 나갑니다.
 * 진행 중인 요청이 있으면 모든 호출자가 같은 Promise를 공유하고
 * 완료 후 동일한 새 토큰을 받습니다.
 *
 * 이 패턴이 없으면:
 *  - restoreAuthState, groupchat SSE, useTokenRefresher 등이 동시에 refresh 요청
 *  - RTR로 인해 첫 번째만 성공하고 나머지는 "이미 폐기된 토큰" 401
 *  - groupchat의 logout() 호출 → REVOKED 마커 → 재로그인 차단 악순환
 */
let _refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  if (_refreshPromise) {
    return _refreshPromise;
  }

  _refreshPromise = apiClient
    .post<{ access_token: string }>("/api/auth/refresh")
    .then(({ data }) => {
      if (!data?.access_token?.trim())
        throw new Error(i18n.t("auth.api.refresh_token_invalid", { defaultValue: "Refresh Token이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요." }));
      return data.access_token;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
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

/** JWT 의 nickname / name / preferred_username 클레임 → 문자열 반환. */
export const getNicknameFromToken = (token?: string): string | null => {
  if (!token) return null;
  const p = _decodeJwtPayload(token);
  return (
    (p?.nickname as string) ??
    (p?.name as string) ??
    (p?.preferred_username as string) ??
    null
  );
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
