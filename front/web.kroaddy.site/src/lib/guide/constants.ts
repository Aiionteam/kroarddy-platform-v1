/**
 * Guide API 베이스 — 플래너·user-profile 등과 동일하게 `NEXT_PUBLIC_API_URL` + `/api/v1`
 * (게이트웨이 Spring Security CSRF 예외는 `/api/**` 만 해당 → `/guide/...` 가 아닌 `/api/v1/guide/...` 사용)
 *
 * - Ask: `{BASE}/guide/ask` → `POST /api/v1/guide/ask`
 * - Festivals: `{BASE}/festivals`
 * - (선택) NEXT_PUBLIC_GUIDE_API_BASE 로 베이스만 덮어쓰기 — 끝에 `/api/v1` 포함하지 않은 API 오리진만
 */
const API_ORIGIN = (
  process.env.NEXT_PUBLIC_GUIDE_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

export const GUIDE_API_BASE_URL = `${API_ORIGIN}/api/v1`;

/** 백엔드 `POST /api/v1/guide/ask` */
export const GUIDE_ASK_RELATIVE_PATH =
  process.env.NEXT_PUBLIC_GUIDE_ASK_PATH || "/guide/ask";

/** 백엔드 `POST /api/v1/guide/directions` — 네이버 Directions 5 자동차 경로 */
export const GUIDE_DIRECTIONS_RELATIVE_PATH = "/guide/directions";

/** 백엔드 `GET /api/v1/guide/place/details` — 게이트웨이에 `/api/v1/place` 없어도 동작 */
export const GUIDE_PLACE_DETAILS_RELATIVE_PATH = "/guide/place/details";

/** 백엔드 `GET /api/v1/guide/place/nearby` (= `/api/v1/place/nearby` 별칭) */
export const GUIDE_PLACE_NEARBY_RELATIVE_PATH = "/guide/place/nearby";
