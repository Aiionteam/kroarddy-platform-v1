/**
 * Planner API – Java 게이트웨이(8080) /api/v1/planner 경유
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";


/** 응답이 에러일 때 서버 detail 메시지 또는 기본 메시지를 담은 Error를 throw */
async function throwApiError(res: Response, fallback: string): Promise<never> {
  if (res.status === 429 || res.status === 503) {
    let detail =
      res.status === 503
        ? "AI 서버가 바쁩니다. 잠시 후 다시 시도해 주세요."
        : "AI 사용량이 초과됐습니다. 잠시 후 다시 시도해 주세요.";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* ignore */ }
    throw new Error(`${res.status}: ${detail}`);
  }
  throw new Error(`${fallback}: ${res.status}`);
}

export interface PlanRoute {
  name: string;
  theme: string;
  description: string;
  highlights: string[];
}

export interface ScheduleItem {
  day: number;
  date: string;
  time: string;
  place: string;
  address?: string;
  lat?: number;
  lng?: number;
  title: string;
  description: string;
  tips?: string;
  estimated_cost?: string;
  /** 네이버 플레이스 크롤(백엔드 옵션) */
  business_hours?: string;
  naver_place_id?: string;
}

export interface CostSummary {
  per_day: { day: number; total: string }[];
  trip_total: string;
}

export interface RoutesResponse {
  location: string;
  location_name: string;
  routes: PlanRoute[];
  error?: string;
}

export interface ScheduleResponse {
  location: string;
  location_name: string;
  route_name: string;
  schedule: ScheduleItem[];
  cost_summary?: CostSummary;
  error?: string;
}

export interface SavePlanResponse {
  plan_id: number;
  location: string;
  location_name: string;
}

export interface TravelPlanRecord {
  id: number;
  user_id: number;
  location: string;
  route_name: string;
  start_date?: string;
  end_date?: string;
  schedule: ScheduleItem[];
  created_at: string;
}

export async function fetchRoutes(
  location: string,
  opts?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    existingRoutes?: string[];
    useSearch?: boolean;
    newsTop10?: object[];
    transportMode?: "car" | "transit" | "walk";
  }
): Promise<RoutesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/${location}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: opts?.startDate ?? null,
      end_date: opts?.endDate ?? null,
      user_id: opts?.userId ?? null,
      existing_routes: opts?.existingRoutes ?? null,
      use_search: opts?.useSearch ?? false,
      news_top10: opts?.newsTop10 ?? null,
      transport_mode: opts?.transportMode ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res, "루트 API 오류");
  return res.json();
}

export interface ModifyResponse {
  plan_id: number;
  schedule: ScheduleItem[];
  modified_titles: string[];
  not_possible?: boolean;
  reason?: string;
  error?: string;
}

export interface RerollResponse {
  plan_id: number;
  item_index: number;
  new_item: ScheduleItem;
  schedule: ScheduleItem[];
}

export async function rerollPlanItem(
  planId: number,
  itemIndex: number,
  userId?: number
): Promise<RerollResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans/${planId}/items/reroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_index: itemIndex, user_id: userId ?? null }),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res, "리롤 API 오류");
  return res.json();
}

export async function modifyPlan(
  planId: number,
  userId: number,
  instruction: string
): Promise<ModifyResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans/${planId}/modify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, user_id: userId }),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res, "일정 수정 API 오류");
  return res.json();
}

export async function fetchMyPlans(userId: number, signal?: AbortSignal): Promise<TravelPlanRecord[]> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans?user_id=${userId}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`플랜 목록 API 오류: ${res.status}`);
  const data = await res.json();
  return data.plans ?? [];
}

export async function deletePlan(planId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans/${planId}?user_id=${userId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`플랜 삭제 API 오류: ${res.status}`);
}

export async function savePlan(data: {
  location: string;
  routeName: string;
  startDate?: string;
  endDate?: string;
  schedule: ScheduleItem[];
  userId?: number;
}): Promise<SavePlanResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: data.location,
      route_name: data.routeName,
      start_date: data.startDate ?? null,
      end_date: data.endDate ?? null,
      schedule: data.schedule,
      user_id: data.userId ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`저장 API 오류: ${res.status}`);
  return res.json();
}

export async function fetchSchedule(
  location: string,
  routeName: string,
  opts?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    useSearch?: boolean;
    newsTop10?: object[];
    transportMode?: "car" | "transit" | "walk";
  }
): Promise<ScheduleResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/${location}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      start_date: opts?.startDate ?? null,
      end_date: opts?.endDate ?? null,
      user_id: opts?.userId ?? null,
      use_search: opts?.useSearch ?? false,
      news_top10: opts?.newsTop10 ?? null,
      transport_mode: opts?.transportMode ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res, "일정 API 오류");
  return res.json();
}

// ── SSE 스트리밍 일정 생성 ────────────────────────────────────────

export type ScheduleStreamEvent =
  | { type: "status"; message: string }
  | { type: "day"; items: ScheduleItem[]; cost: { day: number; total: string; total_krw: number } }
  | { type: "geocoded"; items: ScheduleItem[] }
  | { type: "cost_summary"; data: CostSummary }
  | { type: "cached"; schedule: ScheduleItem[]; cost_summary: CostSummary | null }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * SSE 스트리밍으로 일정 생성 – Day별 완료 즉시 이벤트 전달.
 *
 * 이벤트 순서:
 *   status → (day × N, 순서 비보장) → status → geocoded → cost_summary → done
 *   캐시 히트 시: cached → done
 */
export async function* streamSchedule(
  location: string,
  routeName: string,
  opts?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    useSearch?: boolean;
    newsTop10?: object[];
    transportMode?: "car" | "transit" | "walk";
  }
): AsyncGenerator<ScheduleStreamEvent> {
  const res = await fetch(
    `${API_BASE}/api/v1/planner/${location}/schedule/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_name: routeName,
        start_date: opts?.startDate ?? null,
        end_date: opts?.endDate ?? null,
        user_id: opts?.userId ?? null,
        use_search: opts?.useSearch ?? false,
        news_top10: opts?.newsTop10 ?? null,
        transport_mode: opts?.transportMode ?? null,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) await throwApiError(res, "스트리밍 일정 API 오류");
  if (!res.body) throw new Error("스트리밍 응답 body가 없습니다.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE는 "\n\n"으로 이벤트 구분
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        try {
          yield JSON.parse(line.slice(6)) as ScheduleStreamEvent;
        } catch {
          // 파싱 실패 이벤트 무시
        }
      }
    }
  } finally {
    reader.cancel();
  }
}
