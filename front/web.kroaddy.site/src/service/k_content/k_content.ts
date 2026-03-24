const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type KContentUserProfile = Record<string, unknown>;

export interface KContentResponse {
    success: boolean;
    package_meta?: Record<string, unknown> | null;
    schedule?: Record<string, unknown>[] | null;
    places?: Record<string, unknown>[] | null;
    external_places?: Record<string, unknown>[] | null;
    cost_summary?: Record<string, unknown> | null;
}

export interface KContentSaveResponse {
    success: boolean;
    plan_id: number;
    location: string;
    location_name: string;
    route_name: string;
}

export interface KContentPackageListItem {
    id: number;
    package_id: string;
    category: "KPOP" | "KDRAMA" | "KMOVIE" | string;
    title_en: string;
    title_ko?: string | null;
    description_en?: string | null;
    image_url?: string | null;
    tags?: string | null;
}

interface KContentPackagesResponse {
    items: KContentPackageListItem[];
    total: number;
}

interface KContentPackageDetailResponse extends KContentPackageListItem {
    places?: Record<string, unknown>[];
}

interface KContentGenerateRequest {
    package_id: string;
  start_date?: string | null;
  end_date?: string | null;
  location_name?: string | null;
    user_profile?: KContentUserProfile;
  news_top10?: object[] | null;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
    let detail = "";
    try {
        const body = await res.json();
        detail = body?.detail ?? body?.message ?? "";
    } catch {
        // ignore parse failure
    }

    if (detail) {
        throw new Error(`${fallback}: ${res.status} (${detail})`);
    }
    throw new Error(`${fallback}: ${res.status}`);
}

export async function fetchKContentPackages(category?: "KPOP" | "KDRAMA" | "KMOVIE"): Promise<KContentPackageListItem[]> {
    const url = category
        ? `${API_BASE}/api/v1/k-content/packages?category=${encodeURIComponent(category)}`
        : `${API_BASE}/api/v1/k-content/packages`;

    let res: Response;
    try {
        res = await fetch(url, { cache: "no-store" });
    } catch {
        throw new Error("K-Content 목록 API 호출 실패: 네트워크 오류");
    }

    if (!res.ok) {
        await throwApiError(res, "K-Content 목록 API 오류");
    }

    try {
        const data = (await res.json()) as KContentPackagesResponse;
        return Array.isArray(data.items) ? data.items : [];
    } catch {
        throw new Error("K-Content 목록 API 오류: 응답 파싱 실패");
    }
}

export async function fetchKContentPackage(packageRef: string): Promise<KContentPackageListItem | null> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/v1/k-content/packages/${encodeURIComponent(packageRef)}`, {
            cache: "no-store",
        });
    } catch {
        throw new Error("K-Content 상세 API 호출 실패: 네트워크 오류");
    }

    if (res.status === 404) return null;
    if (!res.ok) {
        await throwApiError(res, "K-Content 상세 API 오류");
    }

    try {
        const data = (await res.json()) as KContentPackageDetailResponse;
        return data ?? null;
    } catch {
        throw new Error("K-Content 상세 API 오류: 응답 파싱 실패");
    }
}

/**
 * K-Content 생성 API 호출
 * POST /api/v1/k-content/generate
 */
export async function generateKContent(
    package_id: string,
  user_profile?: KContentUserProfile,
  options?: {
    startDate?: string;
    endDate?: string;
    locationName?: string;
    newsTop10?: object[];
  }
): Promise<KContentResponse> {
    const payload: KContentGenerateRequest = {
        package_id,
    start_date: options?.startDate ?? null,
    end_date: options?.endDate ?? null,
    location_name: options?.locationName ?? null,
        user_profile,
    news_top10: options?.newsTop10 ?? null,
    };

    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/v1/k-content/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
        });
    } catch {
        throw new Error("K-Content API 호출 실패: 네트워크 오류");
    }

    if (!res.ok) {
        await throwApiError(res, "K-Content API 오류");
    }

    try {
        return (await res.json()) as KContentResponse;
    } catch {
        throw new Error("K-Content API 오류: 응답 파싱 실패");
    }
}

export async function saveKContent(data: {
    packageMeta: Record<string, unknown>;
    schedule: Record<string, unknown>[];
    places?: Record<string, unknown>[];
    costSummary?: Record<string, unknown> | null;
    userId?: number;
    location?: string;
    startDate?: string;
    endDate?: string;
}): Promise<KContentSaveResponse> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/v1/k-content/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                package_meta: data.packageMeta,
                schedule: data.schedule,
                places: data.places ?? [],
                cost_summary: data.costSummary ?? null,
                user_id: data.userId ?? null,
                location: data.location ?? "K-Content",
                start_date: data.startDate ?? null,
                end_date: data.endDate ?? null,
            }),
            cache: "no-store",
        });
    } catch {
        throw new Error("K-Content 저장 API 호출 실패: 네트워크 오류");
    }

    if (!res.ok) {
        await throwApiError(res, "K-Content 저장 API 오류");
    }

    try {
        return (await res.json()) as KContentSaveResponse;
    } catch {
        throw new Error("K-Content 저장 API 오류: 응답 파싱 실패");
    }
}
