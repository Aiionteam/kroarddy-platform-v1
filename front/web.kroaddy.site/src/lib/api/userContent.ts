/**
 * User Content API – 유저 공유 루트 CRUD + AI 폴리시 + S3 이미지 업로드
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
  image_url: string | null;
  likes: number;
  created_at: string;
}

// ── S3 이미지 업로드 + NSFW 검증 파이프라인 ───────────────────────

export interface ValidateImageResult {
  is_safe: boolean;
  nsfw_score: number;
  upload_url: string;   // S3 presigned PUT URL
  image_url: string;    // DB 저장용 공개 URL
}

/**
 * [권장] 이미지를 백엔드 NSFW 필터(NudeNet)에 통과시키고
 * 안전한 경우에만 S3 presigned PUT URL을 반환합니다.
 *
 * 선정적 콘텐츠 감지 시 백엔드가 400을 반환하고
 * 이 함수는 Error를 throw합니다.
 */
export async function validateImageAndGetUploadUrl(
  file: File
): Promise<ValidateImageResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/v1/user-content/validate-image`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `이미지 검증 오류: ${res.status}`);
  }
  return res.json();
}

/**
 * presigned URL로 S3에 직접 PUT 업로드합니다.
 */
export async function uploadImageToS3(
  uploadUrl: string,
  file: File
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`S3 업로드 실패: ${res.status}`);
  }
}

/**
 * NSFW 검증 → S3 업로드를 순서대로 수행하고 최종 image_url을 반환합니다.
 * (save 시점에 호출)
 */
export async function uploadImage(
  file: File,
  preValidated?: ValidateImageResult
): Promise<string> {
  // 이미 검증된 결과가 있으면 재사용 (presigned URL 재사용 가능 시간 내)
  const validated = preValidated ?? (await validateImageAndGetUploadUrl(file));
  await uploadImageToS3(validated.upload_url, file);
  return validated.image_url;
}

// ── AI 폴리시 ────────────────────────────────────────────────────

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

// ── 루트 CRUD ────────────────────────────────────────────────────

export async function saveUserRoute(params: {
  user_id?: number | null;
  title: string;
  location: string;
  description: string;
  route_items: PolishedRouteItem[];
  tags: string[];
  image_url?: string | null;
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
