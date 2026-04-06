import { refreshAccessToken } from "@/lib/api/auth";
import {
  GUIDE_API_BASE_URL,
  GUIDE_ASK_RELATIVE_PATH,
  GUIDE_DIRECTIONS_RELATIVE_PATH,
  GUIDE_PLACE_DETAILS_RELATIVE_PATH,
  GUIDE_PLACE_NEARBY_RELATIVE_PATH,
} from "./constants";
import { guideDebug, guideDebugHttpError } from "./guideDebug";
import type {
  GuideAskRequestBody,
  GuideAskResponse,
  GuideDirectionsRequestBody,
  GuideDirectionsResponse,
  GuideNearbyPlacesResponse,
  GuidePlaceDetailsResponse,
} from "./types";

/** 게이트웨이/Guide 응답 대기 상한 (ms) — 무한 로딩 방지 */
const GUIDE_ASK_FETCH_MS = 120_000;

function createAskAbortSignal(): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(GUIDE_ASK_FETCH_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), GUIDE_ASK_FETCH_MS);
  return c.signal;
}

/** 디버그·검수용: 실제 요청 URL */
export function getGuideAskUrl(): string {
  return `${GUIDE_API_BASE_URL}${GUIDE_ASK_RELATIVE_PATH}`;
}

function collectResponseHeaderHints(res: Response): Record<string, string> {
  const keys = [
    "www-authenticate",
    "x-request-id",
    "x-spring-error",
    "content-type",
    "x-content-type-options",
  ];
  const out: Record<string, string> = {};
  keys.forEach((k) => {
    const v = res.headers.get(k);
    if (v) out[k] = v;
  });
  return out;
}

async function parseErrorBody(raw: string): Promise<{ parsed: unknown | undefined; display: string }> {
  const t = raw.trim();
  if (!t) return { parsed: undefined, display: "(빈 본문)" };
  try {
    const parsed = JSON.parse(t) as unknown;
    return { parsed, display: JSON.stringify(parsed, null, 2).slice(0, 4000) };
  } catch {
    return { parsed: undefined, display: t.slice(0, 4000) };
  }
}

/**
 * 게이트웨이 가이드 경로용 헤더.
 * - credentials 로 HttpOnly 쿠키 전송 (refresh·세션)
 * - 세션 사용자: refresh 로 받은 JWT 를 Authorization: Bearer 에 포함 (크로스 오리진 대응)
 */
export async function getGuideAuthHeaders(): Promise<HeadersInit> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    /** 일부 프록시/보안 스택에서 XHR 로 인식되도록 (Spring CSRF 와 무관할 수 있음) */
    "X-Requested-With": "XMLHttpRequest",
  };
  if (typeof window === "undefined") return base;
  if (sessionStorage.getItem("isGuest") === "true") {
    guideDebug("auth.headers", { mode: "guest", hasAuthorization: false });
    return base;
  }
  if (sessionStorage.getItem("isAuthenticated") !== "true") {
    guideDebug("auth.headers", { mode: "not_authenticated", hasAuthorization: false });
    return base;
  }
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const token = await refreshAccessToken();
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
    const tok = token?.trim();
    guideDebug("auth.headers", {
      mode: "session",
      refreshMs: ms,
      hasAuthorization: Boolean(tok),
      tokenLength: tok?.length ?? 0,
    });
    if (tok) base.Authorization = `Bearer ${tok}`;
  } catch (e) {
    guideDebug("auth.headers", {
      mode: "session",
      refreshError: e instanceof Error ? e.message : String(e),
      hasAuthorization: false,
      note: "쿠키(credentials:include)만으로 갱신 실패 시에도 요청은 진행",
    });
  }
  return base;
}

export async function postGuideAsk(body: GuideAskRequestBody): Promise<GuideAskResponse> {
  const url = getGuideAskUrl();
  const tAuth = typeof performance !== "undefined" ? performance.now() : 0;
  const headers = await getGuideAuthHeaders();
  const authMs = typeof performance !== "undefined" ? Math.round(performance.now() - tAuth) : 0;

  const bodyStr = JSON.stringify(body);
  guideDebug("fetch.ask.start", {
    url,
    pathSuffix: GUIDE_ASK_RELATIVE_PATH,
    method: "POST",
    credentials: "include",
    authHeaderMs: authMs,
    hasAuthorizationHeader: Object.keys(headers as Record<string, string>).includes("Authorization"),
    bodyChars: bodyStr.length,
    questionPreview: (body.question || "").slice(0, 80),
    hasContext: body.context != null,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: bodyStr,
      mode: "cors",
      signal: createAskAbortSignal(),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    guideDebug("fetch.ask.error", {
      name,
      message: e instanceof Error ? e.message : String(e),
      isTimeout: name === "TimeoutError" || name === "AbortError",
    });
    throw new Error(
      name === "TimeoutError" || name === "AbortError"
        ? `가이드 요청 시간 초과 (${GUIDE_ASK_FETCH_MS / 1000}s)`
        : e instanceof Error
          ? e.message
          : String(e)
    );
  }

  guideDebug("fetch.ask.response", {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type"),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const { parsed, display } = await parseErrorBody(errText);
    const headerHints = collectResponseHeaderHints(res);

    guideDebugHttpError("fetch.ask.errorResponse", {
      status: res.status,
      statusText: res.statusText,
      url,
      rawBody: errText,
      parsedJson: parsed,
      responseHeaders: headerHints,
    });

    const hint =
      res.status === 403
        ? "403 Forbidden — 게이트웨이 CSRF(/guide/** 예외)·CORS Origin·JWT 권한을 확인하세요."
        : res.status === 401
          ? "401 Unauthorized — 로그인·토큰 갱신을 확인하세요."
          : "";

    const msg =
      typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail)
        : typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as { message?: unknown }).message)
          : display;

    throw new Error(
      [msg || `가이드 요청 실패 (${res.status})`, hint].filter(Boolean).join("\n")
    );
  }
  const data = (await res.json()) as GuideAskResponse;
  guideDebug("fetch.ask.json", {
    source: data.source,
    answerChars: data.answer?.length ?? 0,
    placesCount: data.places?.length ?? 0,
  });
  return data;
}

const GUIDE_DIRECTIONS_FETCH_MS = 45_000;

function createDirectionsAbortSignal(): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(GUIDE_DIRECTIONS_FETCH_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), GUIDE_DIRECTIONS_FETCH_MS);
  return c.signal;
}

/** 네이버 Directions 5 자동차 경로(서버 프록시) */
export async function postGuideDirections(
  body: GuideDirectionsRequestBody,
): Promise<GuideDirectionsResponse> {
  const url = `${GUIDE_API_BASE_URL}${GUIDE_DIRECTIONS_RELATIVE_PATH}`;
  const headers = await getGuideAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
    mode: "cors",
    signal: createDirectionsAbortSignal(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    guideDebug("fetch.directions.error", { status: res.status, body: t.slice(0, 200) });
    return {
      ok: false,
      path: [],
      bbox: null,
      distance_m: 0,
      duration_ms: 0,
      toll_fare: 0,
      fuel_price: 0,
      taxi_fare: 0,
      naver_code: 0,
      message: `경로 API 오류 (${res.status})`,
    };
  }
  return (await res.json()) as GuideDirectionsResponse;
}

/** GET /api/v1/guide/place/details?name= — 네이버 지역·이미지 검색 */
export async function fetchGuidePlaceDetails(
  name: string,
  signal?: AbortSignal,
): Promise<GuidePlaceDetailsResponse> {
  const q = name.trim();
  if (!q) {
    return {
      title: "",
      category: "정보 없음",
      address: "정보 없음",
      telephone: "정보 없음",
      link: "정보 없음",
      imageUrl: null,
      naverMatched: false,
    };
  }
  const params = new URLSearchParams({ name: q });
  const url = `${GUIDE_API_BASE_URL}${GUIDE_PLACE_DETAILS_RELATIVE_PATH}?${params.toString()}`;
  const headers = await getGuideAuthHeaders();
  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    mode: "cors",
    signal,
  });
  if (!res.ok) {
    guideDebug("fetch.placeDetails.error", { status: res.status });
    throw new Error(`장소 정보 요청 실패 (${res.status})`);
  }
  return (await res.json()) as GuidePlaceDetailsResponse;
}

export type GuideNearbyCategory = "restaurant" | "cafe" | "all";

/** GET /api/v1/place/nearby — x=경도, y=위도 (WGS84) */
export async function fetchGuideNearbyPlaces(
  params: {
    x: number;
    y: number;
    name: string;
    category?: GuideNearbyCategory;
  },
  signal?: AbortSignal,
): Promise<GuideNearbyPlacesResponse> {
  const name = params.name.trim();
  if (!name || !Number.isFinite(params.x) || !Number.isFinite(params.y)) {
    return { items: [] };
  }
  const q = new URLSearchParams({
    x: String(params.x),
    y: String(params.y),
    name,
    category: params.category ?? "all",
  });
  const url = `${GUIDE_API_BASE_URL}${GUIDE_PLACE_NEARBY_RELATIVE_PATH}?${q.toString()}`;
  const headers = await getGuideAuthHeaders();
  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    mode: "cors",
    signal,
  });
  if (!res.ok) {
    guideDebug("fetch.placeNearby.error", { status: res.status });
    throw new Error(`주변 장소 요청 실패 (${res.status})`);
  }
  return (await res.json()) as GuideNearbyPlacesResponse;
}
