/**
 * User Content API – 유저 공유 루트 CRUD + AI 폴리시
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface RouteItemInput {
  place: string;
  note?: string;
}

export interface PolishedRouteItem {
  order: number;
  place: string;
  description: string;
  tip: string;
}

export interface PolishResponse {
  title: string;
  location: string;
  description: string;
  route_items: PolishedRouteItem[];
  tags: string[];
}

export interface UserRoute {
  id: number;
  user_id: number | null;
  title: string;
  location: string;
  description: string;
  route_items: PolishedRouteItem[];
  tags: string[];
  image_data: string | null;
  image_mime: string | null;
  likes: number;
  created_at: string;
}

export async function polishRoute(params: {
  title: string;
  location: string;
  description?: string;
  route_items: RouteItemInput[];
}): Promise<PolishResponse> {
  const res = await fetch(`${API_BASE}/api/v1/user-content/routes/polish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI 폴리시 오류: ${res.status}`);
  }
  return res.json();
}

export async function saveUserRoute(params: {
  user_id?: number | null;
  title: string;
  location: string;
  description: string;
  route_items: PolishedRouteItem[];
  tags: string[];
  image_data?: string | null;
  image_mime?: string | null;
}): Promise<UserRoute> {
  const res = await fetch(`${API_BASE}/api/v1/user-content/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `저장 오류: ${res.status}`);
  }
  return res.json();
}

export async function fetchUserRoutes(limit = 20, offset = 0): Promise<UserRoute[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/user-content/routes?limit=${limit}&offset=${offset}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`피드 로드 오류: ${res.status}`);
  const data = await res.json();
  return data.routes ?? [];
}

export async function likeUserRoute(routeId: number): Promise<{ id: number; likes: number }> {
  const res = await fetch(`${API_BASE}/api/v1/user-content/routes/${routeId}/like`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`좋아요 오류: ${res.status}`);
  return res.json();
}
