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

export interface EvaluationResult {
  job_id: string;
  requested_at: string;
  output_csv: string;
  selection_root: string;
  summary_csv: string;
  best: SelectedImage[];
  worst: SelectedImage[];
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
  styleTemplate = ""
): Promise<GeneratePostResponse> {
  const res = await fetch(toApiUrl("/v1/photo-selection/generate-post"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comment,
      style_filter: styleFilter,
      style_template: styleTemplate.trim() || undefined,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`투어스타 게시글 생성 API 오류: ${res.status}`);
  }
  return res.json();
}
