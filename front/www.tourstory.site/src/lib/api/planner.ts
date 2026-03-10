/**
 * Planner API – Java 게이트웨이(8080) /api/v1/planner 경유
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** 응답이 에러일 때 서버 detail 메시지 또는 기본 메시지를 담은 Error를 throw */
async function throwApiError(res: Response, fallback: string): Promise<never> {
  if (res.status === 429) {
    let detail = "AI 사용량이 초과됐습니다. 잠시 후 다시 시도해 주세요.";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* ignore */ }
    throw new Error(`429: ${detail}`);
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
  title: string;
  description: string;
  tips?: string;
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
  opts?: { startDate?: string; endDate?: string; userId?: number; existingRoutes?: string[] }
): Promise<RoutesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/${location}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: opts?.startDate ?? null,
      end_date: opts?.endDate ?? null,
      user_id: opts?.userId ?? null,
      existing_routes: opts?.existingRoutes ?? null,
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

export async function fetchMyPlans(userId: number): Promise<TravelPlanRecord[]> {
  const res = await fetch(`${API_BASE}/api/v1/planner/plans?user_id=${userId}`, {
    cache: "no-store",
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
  opts?: { startDate?: string; endDate?: string }
): Promise<ScheduleResponse> {
  const res = await fetch(`${API_BASE}/api/v1/planner/${location}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      start_date: opts?.startDate ?? null,
      end_date: opts?.endDate ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res, "일정 API 오류");
  return res.json();
}
