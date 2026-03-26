"use client";
/**
 * useTokenRefresher
 *
 * access_token은 HttpOnly 쿠키에 저장되므로 JS에서 만료 시각을 직접 읽을 수 없습니다.
 * 대신 TTL(15분)보다 짧은 주기(12분)로 사용자가 활동 중일 때 /auth/refresh를 선제 호출합니다.
 *
 * 동작 방식:
 *  1. 12분마다 갱신 여부를 체크
 *  2. 사용자가 INACTIVITY_LIMIT_MS(30분) 이내에 활동했을 때만 갱신 수행
 *  3. 게스트 세션은 갱신 대상에서 제외
 *  4. 서버가 Set-Cookie로 새 access_token / refresh_token 쿠키를 응답 → 클라이언트 코드 변경 없음
 */
import { useEffect, useRef, useCallback } from "react";
import { useLoginStore } from "@/store";

const PROACTIVE_REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12분마다 선제 갱신
const INACTIVITY_LIMIT_MS           = 30 * 60 * 1000; // 30분 이상 비활성 시 갱신 스킵

export function useTokenRefresher() {
  const { isAuthenticated, loadingType } = useLoginStore();
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
    if (idleMs > INACTIVITY_LIMIT_MS) return;

    refreshingRef.current = true;
    try {
      const { refreshAccessToken } = await import("@/lib/api/auth");
      // 서버가 새 access_token + refresh_token 쿠키를 Set-Cookie로 응답
      await refreshAccessToken();
    } catch {
      // 갱신 실패 시 다음 API 호출에서 401 핸들러가 재시도
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || loadingType === "guest") return;
    if (typeof window === "undefined") return;

    // 마운트 직후 한 번 즉시 갱신 (이전 세션에서 토큰이 만료 근접일 수 있음)
    tryRefresh();

    const timerId = setInterval(tryRefresh, PROACTIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [isAuthenticated, loadingType, tryRefresh]);
}
