/**
 * 가이드 API / 채팅 디버그 로그
 * - 개발: 기본 켜짐
 * - 프로덕션: NEXT_PUBLIC_GUIDE_DEBUG=true 일 때만
 */
export const GUIDE_DEBUG_ENABLED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_GUIDE_DEBUG === "true";

export function guideDebug(tag: string, payload?: Record<string, unknown>): void {
  if (!GUIDE_DEBUG_ENABLED) return;
  if (payload !== undefined) {
    console.log(`[Guide:${tag}]`, payload);
  } else {
    console.log(`[Guide:${tag}]`);
  }
}

/** 403·5xx 등 HTTP 실패 시 — 서버 JSON·헤더 힌트를 최대한 노출 */
export function guideDebugHttpError(
  tag: string,
  payload: {
    status: number;
    statusText?: string;
    url: string;
    rawBody: string;
    parsedJson?: unknown;
    responseHeaders?: Record<string, string>;
  }
): void {
  if (!GUIDE_DEBUG_ENABLED) return;
  console.warn(`[Guide:${tag}] HTTP ${payload.status}`, {
    url: payload.url,
    statusText: payload.statusText,
    parsedJson: payload.parsedJson,
    rawBodyPreview: payload.rawBody.slice(0, 2000),
    responseHeaders: payload.responseHeaders,
  });
}
