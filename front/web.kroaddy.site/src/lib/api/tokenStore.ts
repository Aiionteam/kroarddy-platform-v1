/**
 * 순환 의존성 없는 토큰 공유 모듈
 *
 * client.ts ← tokenStore.ts ← loginSlice.ts  (단방향, 순환 없음)
 * window.__loginStore 전역변수 방식 제거 — 타이밍 문제 해결
 */

let _accessToken: string | null = null;

export function setSharedToken(token: string | null): void {
  _accessToken = token;
}

export function getSharedToken(): string | null {
  return _accessToken;
}
