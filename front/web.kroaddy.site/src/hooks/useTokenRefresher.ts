"use client";
/**
 * useTokenRefresher
 *
 * 사용자가 활동 중일 때 액세스 토큰이 만료되기 전에 미리 갱신합니다.
 *
 * 동작 방식:
 *  1. 60초마다 토큰의 남은 유효 시간을 체크
 *  2. 남은 시간이 REFRESH_BEFORE_EXPIRY_MS(3분) 이하이고
 *     사용자가 INACTIVITY_LIMIT_MS(30분) 이내에 활동했다면 갱신 수행
 *  3. 갱신 성공 시 tokenStore + Zustand 양쪽 모두 업데이트
 *  4. 게스트 세션은 갱신 대상에서 제외
 */
import { useEffect, useRef, useCallback } from "react";
import { useLoginStore } from "@/store";
import { setSharedToken } from "@/lib/api/tokenStore";

const REFRESH_BEFORE_EXPIRY_MS = 3 * 60 * 1000;  // 만료 3분 전에 갱신
const INACTIVITY_LIMIT_MS      = 30 * 60 * 1000; // 30분 이상 비활성 시 갱신 스킵
const CHECK_INTERVAL_MS        = 60 * 1000;       // 1분마다 체크

/** JWT payload에서 exp(초) 추출 → 만료까지 남은 밀리초 반환. 파싱 불가 시 0 반환 */
function msUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!payload?.exp) return 0;
    return payload.exp * 1000 - Date.now();
  } catch {
    return 0;
  }
}

export function useTokenRefresher() {
  const { accessToken, isAuthenticated, loadingType, setAccessToken } = useLoginStore();
  const lastActivityRef = useRef<number>(Date.now());
  const refreshingRef   = useRef<boolean>(false);

  // 사용자 활동 시간 추적
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, update, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, update));
  }, []);

  const tryRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    const idleMs = Date.now() - lastActivityRef.current;
    if (idleMs > INACTIVITY_LIMIT_MS) return; // 오랫동안 비활성 → 스킵

    refreshingRef.current = true;
    try {
      const { refreshAccessToken } = await import("@/lib/api/auth");
      const newToken = await refreshAccessToken();
      setSharedToken(newToken);
      setAccessToken(newToken);
    } catch {
      // 갱신 실패 시 다음 API 호출에서 반응형으로 재시도
    } finally {
      refreshingRef.current = false;
    }
  }, [setAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || loadingType === "guest") return;
    if (typeof window === "undefined") return;

    const check = () => {
      const token = accessToken;
      if (!token) return;
      const remaining = msUntilExpiry(token);
      // 만료됐거나 곧 만료될 예정이면 갱신
      if (remaining <= REFRESH_BEFORE_EXPIRY_MS) {
        tryRefresh();
      }
    };

    // 마운트 직후 한 번 즉시 체크 (페이지 전환 후 토큰이 이미 만료 근접일 경우 대비)
    check();

    const timerId = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [isAuthenticated, loadingType, accessToken, tryRefresh]);
}
