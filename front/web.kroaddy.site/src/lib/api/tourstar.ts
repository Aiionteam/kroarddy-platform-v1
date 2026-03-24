declare const process: {
  env: Record<string, string | undefined>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const TOURSTAR_DIRECT_BASE = process.env.NEXT_PUBLIC_TOURSTAR_URL || "";

export interface UploadedPhoto {
  name: string;
  url: string;
  size: number;
}

export interface UploadPipelineJob {
  job_id: string;
  status: "queued";
}

export interface UploadPhotosResponse {
  uploaded: UploadedPhoto[];
  batch_dir: string;
  pipeline_job?: UploadPipelineJob | null;
}

export interface SelectedImage {
  rank: number;
  source_image: string;
  saved_image: string;
  final_score: number;
  is_candidate: boolean;
  reject_reason: string;
}

export interface RankedImage {
  rank: number;
  source_image: string;
  final_score: number;
  is_candidate: boolean;
  reject_reason: string;
}

export interface EvaluationResult {
  job_id: string;
  requested_at: string;
  output_csv: string;
  selection_root: string;
  summary_csv: string;
  best: SelectedImage[];
  worst: SelectedImage[];
  ranked?: RankedImage[];
}

export interface TourstarJobStatus {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  requested_at: string;
  attempts: number;
  max_retries: number;
  completed_at?: string | null;
  result?: EvaluationResult | null;
  error?: string | null;
}

export interface GeneratePostResponse {
  title: string;
  location: string;
  comment: string;
  tags: string[];
}

export interface AutoCommentResponse {
  comment: string;
  location_hint: string;
  mood: string;
  time_of_day: string;
  gps_candidates?: Array<{
    path: string;
    lat: number;
    lon: number;
    place: string;
    confidence: number;
  }>;
}

export interface TourstarComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface TourstarPostRecord {
  id: string;
  user_id?: number | null;
  author_nickname?: string | null;
  title: string;
  location: string;
  comment: string;
  visibility: "public" | "private";
  tags: string[];
  photo_urls: string[];
  selected_scores?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  comments: TourstarComment[];
}

export interface TourstarSharePreview {
  id: string;
  title: string;
  location: string;
  thumbnail_url: string;
  visibility: "public" | "private";
  created_at: string;
}

export type TourstarStyleFilter =
  | "AUTO"
  | "INTJ"
  | "INTP"
  | "ENTJ"
  | "ENTP"
  | "INFJ"
  | "INFP"
  | "ENFJ"
  | "ENFP"
  | "ISTJ"
  | "ISFJ"
  | "ESTJ"
  | "ESFJ"
  | "ISTP"
  | "ISFP"
  | "ESTP"
  | "ESFP";

function toApiUrl(path: string): string {
  if (TOURSTAR_DIRECT_BASE) {
    const base = TOURSTAR_DIRECT_BASE.replace(/\/+$/, "");
    return `${base}${path}`;
  }
  return `${API_BASE}/api${path}`;
}

export function buildTourstarImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return toApiUrl(normalized);
  return toApiUrl(`/${normalized}`);
}

export function localArtifactPathToUrl(localPath: string): string {
  if (!localPath) return "";
  const normalized = localPath.replace(/\\/g, "/");
  if (normalized.startsWith("/tourstar-files/")) {
    return buildTourstarImageUrl(normalized);
  }

  const marker = "/artifacts/";
  const markerIdx = normalized.toLowerCase().indexOf(marker);
  if (markerIdx >= 0) {
    const tail = normalized.slice(markerIdx + marker.length);
    return buildTourstarImageUrl(`/tourstar-files/${tail}`);
  }

  return buildTourstarImageUrl(`/tourstar-files/${normalized.replace(/^\/+/, "")}`);
}

export async function uploadTourstarPhotos(files: File[]): Promise<UploadPhotosResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(toApiUrl("/v1/photo-selection/uploads"), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`투어스타 업로드 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function getTourstarJobStatus(jobId: string): Promise<TourstarJobStatus> {
  const res = await fetch(toApiUrl(`/v1/photo-selection/jobs/${jobId}`), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 작업 조회 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function generateTourstarPost(
  comment: string,
  styleFilter: TourstarStyleFilter = "AUTO",
  styleTemplate = "",
  imagePaths: string[] = [],
): Promise<GeneratePostResponse> {
  const res = await fetch(toApiUrl("/v1/photo-selection/generate-post"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comment,
      style_filter: styleFilter,
      style_template: styleTemplate.trim() || undefined,
      image_paths: imagePaths,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 게시글 생성 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function generateTourstarAutoComment(
  imagePaths: string[],
  maxImages = 3
): Promise<AutoCommentResponse> {
  const res = await fetch(toApiUrl("/v1/photo-selection/auto-comment"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_paths: imagePaths,
      max_images: maxImages,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 자동 코멘트 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function listTourstarPosts(): Promise<TourstarPostRecord[]> {
  const res = await fetch(toApiUrl("/v1/photo-selection/posts"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`투어스타 게시물 조회 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function createTourstarPost(payload: {
  user_id?: number;
  author_nickname?: string;
  title: string;
  location: string;
  comment: string;
  visibility: "public" | "private";
  tags: string[];
  image_paths: string[];
  selected_scores?: Record<string, unknown>;
}): Promise<TourstarPostRecord> {
  const res = await fetch(toApiUrl("/v1/photo-selection/posts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 게시물 저장 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function createTourstarComment(
  postId: string,
  payload: { author?: string; content: string },
): Promise<TourstarComment> {
  const res = await fetch(toApiUrl(`/v1/photo-selection/posts/${postId}/comments`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 댓글 저장 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function getTourstarSharePreview(postId: string): Promise<TourstarSharePreview> {
  const res = await fetch(toApiUrl(`/v1/photo-selection/posts/${postId}/share-preview`), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 공유 미리보기 API 오류: ${res.status}`);
  }
  return res.json();
}

export async function updateTourstarPost(
  postId: string,
  payload: {
    title?: string;
    location?: string;
    comment?: string;
    tags?: string[];
    keep_photo_urls?: string[];
    image_paths?: string[];
  },
): Promise<TourstarPostRecord> {
  const res = await fetch(toApiUrl(`/v1/photo-selection/posts/${postId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (res.ok) {
    return res.json();
  }
  // 응답 body 를 읽어 에러 메시지 포함
  let patchErrBody = "";
  try { patchErrBody = await res.text(); } catch { /* ignore */ }
  // 게이트웨이/프록시에서 PATCH·메서드 제한 시 POST 로 재시도 (422 는 본문 검증 실패이므로 동일)
  const tryPostFallback =
    res.status !== 422 &&
    (res.status === 403 ||
      res.status === 404 ||
      res.status === 405 ||
      res.status === 501 ||
      res.status === 500 ||
      (res.status >= 502 && res.status <= 504));
  if (tryPostFallback) {
    const fallbackRes = await fetch(toApiUrl(`/v1/photo-selection/posts/${postId}/update`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (fallbackRes.ok) {
      return fallbackRes.json();
    }
    let postErrBody = "";
    try { postErrBody = await fallbackRes.text(); } catch { /* ignore */ }
    throw new Error(
      `투어스타 게시물 수정 API 오류: PATCH ${res.status}${patchErrBody ? ` (${patchErrBody.slice(0, 200)})` : ""} / POST ${fallbackRes.status}${postErrBody ? ` (${postErrBody.slice(0, 200)})` : ""}`,
    );
  }
  throw new Error(
    `투어스타 게시물 수정 API 오류: ${res.status}${patchErrBody ? ` — ${patchErrBody.slice(0, 200)}` : ""}`,
  );
}

export async function deleteTourstarPost(postId: string, userId: number): Promise<void> {
  const q = new URLSearchParams({ user_id: String(userId) });
  const res = await fetch(`${toApiUrl(`/v1/photo-selection/posts/${postId}`)}?${q.toString()}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (res.ok || res.status === 204) {
    return;
  }
  if (res.status === 404 || res.status === 405) {
    const fallbackRes = await fetch(toApiUrl(`/v1/photo-selection/posts/${postId}/delete`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
      cache: "no-store",
    });
    if (fallbackRes.ok || fallbackRes.status === 204) {
      return;
    }
    throw new Error(`투어스타 게시물 삭제 API 오류: ${fallbackRes.status}`);
  }
  throw new Error(`투어스타 게시물 삭제 API 오류: ${res.status}`);
}

export function buildTourstarShareUrl(postId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/tourstar?postId=${encodeURIComponent(postId)}`;
  }
  return `https://web.kroaddy.site/tourstar?postId=${encodeURIComponent(postId)}`;
}
