/**
 * API Client - 로컬: http://localhost:8080 / 배포: NEXT_PUBLIC_API_URL 필수
 * Vercel 배포 시 환경 변수에 NEXT_PUBLIC_API_URL 을 게이트웨이 URL 로 설정하세요.
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

if (typeof window !== "undefined") {
  if (process.env.NODE_ENV === "development") {
    console.log("[API Client] Base URL:", API_BASE_URL);
  }
  // 백엔드 없이 배포해도 됨: 페이지는 정상 동작하고, API 호출만 실패 시 위 메시지로 안내
  if (
    process.env.NODE_ENV === "production" &&
    (API_BASE_URL === "http://localhost:8080" || !process.env.NEXT_PUBLIC_API_URL)
  ) {
    console.info(
      "[API Client] 백엔드 미연결 모드. 페이지는 동작하며, API 사용 시 NEXT_PUBLIC_API_URL 을 설정하세요."
    );
  }
}

interface RequestOptions extends RequestInit {
  timeout?: number;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private static readonly PUBLIC_PATHS = [
    "/api/google/auth-url",
    "/api/kakao/auth-url",
    "/api/naver/auth-url",
  ];

  private isPublicPath(endpoint: string): boolean {
    return ApiClient.PUBLIC_PATHS.some((p) => endpoint.startsWith(p) || endpoint.includes(p));
  }

  private getHeaders(endpoint: string = ""): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (typeof window !== "undefined") {
      try {
        const store = (window as any).__loginStore;
        if (store) {
          const token = store.getState().accessToken;
          if (token) headers["Authorization"] = `Bearer ${token}`;
        }
      } catch (_) {}
    }
    return headers;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions,
    timeout: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") throw new Error("요청 시간이 초과되었습니다.");
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        const msg =
          typeof window !== "undefined" &&
          process.env.NODE_ENV === "production" &&
          (API_BASE_URL === "http://localhost:8080" || !process.env.NEXT_PUBLIC_API_URL)
            ? "백엔드가 연결되지 않았습니다. 배포 후에는 Vercel 환경 변수에 NEXT_PUBLIC_API_URL 을 설정하세요."
            : "서버에 연결할 수 없습니다. 네트워크와 백엔드 실행 여부를 확인해 주세요.";
        throw new Error(msg);
      }
      throw error;
    }
  }

  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  private async handleErrorResponse(
    response: Response,
    requestedUrl?: string,
    retry?: () => Promise<Response>
  ): Promise<never> {
    if (response.status === 401 && retry && !requestedUrl?.includes("/auth/refresh")) {
      if (this.isRefreshing && this.refreshPromise) {
        try {
          await this.refreshPromise;
          const retried = await retry();
          if (retried.ok) return retried as never;
        } catch (e) {
          if (typeof window !== "undefined") {
            const store = (window as any).__loginStore;
            if (store) store.getState().logout();
          }
          throw e;
        }
      }
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.refreshPromise = (async () => {
          try {
            const { refreshAccessToken } = await import("./auth");
            const newToken = await refreshAccessToken();
            if (typeof window !== "undefined") {
              const store = (window as any).__loginStore;
              if (store) store.getState().setAccessToken(newToken);
            }
            return newToken;
          } catch (error) {
            this.isRefreshing = false;
            this.refreshPromise = null;
            if (typeof window !== "undefined") {
              const store = (window as any).__loginStore;
              if (store) store.getState().logout();
            }
            throw error;
          }
        })();
      }
      try {
        await this.refreshPromise;
        const retried = await retry();
        if (retried.ok) {
          this.isRefreshing = false;
          this.refreshPromise = null;
          return retried as never;
        }
      } catch (e) {
        this.isRefreshing = false;
        this.refreshPromise = null;
        throw e;
      }
    }
    const data = await response.json().catch(() => null);
    const err: any = new Error(data?.message || `HTTP ${response.status}`);
    err.response = { status: response.status, data };
    throw err;
  }

  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        { method: "GET", headers: this.getHeaders(endpoint), credentials: "include", ...options },
        options.timeout || 10000
      );
    const response = await makeRequest();
    if (!response.ok) await this.handleErrorResponse(response, url, makeRequest);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    return { data: data as T };
  }

  async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.getHeaders(endpoint),
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        },
        options.timeout || 20000
      );
    const response = await makeRequest();
    if (!response.ok) await this.handleErrorResponse(response, url, makeRequest);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    return { data: (data ?? null) as T };
  }

  async put<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await this.fetchWithTimeout(
      url,
      {
        method: "PUT",
        headers: this.getHeaders(endpoint),
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      },
      options.timeout || 10000
    );
    if (!response.ok) await this.handleErrorResponse(response, url);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    return { data: (data ?? null) as T };
  }

  async delete<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await this.fetchWithTimeout(
      url,
      {
        method: "DELETE",
        headers: this.getHeaders(endpoint),
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      },
      options.timeout || 10000
    );
    if (!response.ok) await this.handleErrorResponse(response, url);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    return { data: (data ?? null) as T };
  }
}

const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
