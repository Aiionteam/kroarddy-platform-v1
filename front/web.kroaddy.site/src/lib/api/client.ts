/**
 * API Client - 로컬: http://localhost:8080 / 배포: NEXT_PUBLIC_API_URL 필수
 * Vercel 배포 시 환경 변수에 NEXT_PUBLIC_API_URL 을 게이트웨이 URL 로 설정하세요.
 *
 * 쿠키 기반 인증 전환 후 변경사항:
 * - Authorization: Bearer 헤더 제거 (access_token은 HttpOnly 쿠키로 자동 전송)
 * - credentials: "include" 는 유지 (쿠키 전송 필수)
 * - 401 자동 갱신 시 tokenStore 동기화 코드 제거 (서버가 쿠키를 갱신함)
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

if (typeof window !== "undefined") {
  if (process.env.NODE_ENV === "development") {
    console.log("[API Client] Base URL:", API_BASE_URL);
  }
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

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      // access_token은 HttpOnly 쿠키로 자동 전송 (credentials: "include")
    };
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
  private refreshPromise: Promise<void> | null = null;

  private resetRefreshState() {
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  private async handleErrorResponse(
    response: Response,
    requestedUrl?: string,
    retry?: () => Promise<Response>
  ): Promise<never> {
    if (response.status === 401 && retry && !requestedUrl?.includes("/auth/refresh")) {
      // 이미 refresh 중이면 완료까지 기다린 뒤 재시도
      if (this.isRefreshing && this.refreshPromise) {
        try {
          await this.refreshPromise;
          const retried = await retry();
          if (retried.ok) {
            this.resetRefreshState();
            return retried as never;
          }
        } catch (e) {
          this.resetRefreshState();
          this.doLogout();
          throw e;
        }
        this.resetRefreshState();
      }

      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.refreshPromise = (async () => {
          try {
            const { refreshAccessToken } = await import("./auth");
            // refreshAccessToken은 서버가 새 access_token 쿠키를 Set-Cookie로 응답
            // — 클라이언트에서 토큰 값을 저장할 필요 없음
            await refreshAccessToken();
          } catch (error) {
            this.resetRefreshState();
            this.doLogout();
            throw error;
          }
        })();
      }

      try {
        await this.refreshPromise;
        const retried = await retry();
        if (retried.ok) {
          this.resetRefreshState();
          return retried as never;
        }
        this.resetRefreshState();
      } catch (e) {
        this.resetRefreshState();
        throw e;
      }
    }

    const data = await response.json().catch(() => null);
    const err: any = new Error(data?.message || `HTTP ${response.status}`);
    err.response = { status: response.status, data };
    throw err;
  }

  /**
   * 게이트웨이가 HTTP 200 + body { code: 401 } 형태로 인증 오류를 주는 레거시 케이스 대응.
   * (Spring Security는 permitAll이고, 실제 인증은 컨트롤러에서 Messenger.code로 판단)
   */
  private async retryIfBodyCode401<T>(
    data: any,
    requestedUrl: string,
    makeRequest: () => Promise<Response>
  ): Promise<T | null> {
    if (!data || data.code !== 401) return null;
    if (requestedUrl.includes("/api/auth/refresh")) return null;

    // refresh 후 1회 재시도
    const { refreshAccessToken } = await import("./auth");
    await refreshAccessToken();

    const retried = await makeRequest();
    if (!retried.ok) await this.handleErrorResponse(retried, requestedUrl, makeRequest);
    const ct = retried.headers.get("content-type");
    return (ct?.includes("application/json") ? await retried.json() : await retried.text()) as T;
  }

  private isLoggingOut = false;

  private doLogout() {
    if (typeof window !== "undefined" && !this.isLoggingOut) {
      this.isLoggingOut = true;
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("loadingType");
      sessionStorage.removeItem("isGuest");
      sessionStorage.removeItem("app_user_id");
      sessionStorage.removeItem("nickname");
      window.location.href = "/";
    }
  }

  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        { method: "GET", headers: this.getHeaders(), credentials: "include", ...options },
        options.timeout || 10000
      );
    const response = await makeRequest();
    if (!response.ok) await this.handleErrorResponse(response, url, makeRequest);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    if (contentType?.includes("application/json")) {
      const retried = await this.retryIfBodyCode401<T>(data, url, makeRequest);
      if (retried != null) return { data: retried as T };
    }
    return { data: data as T };
  }

  async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.getHeaders(),
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
    if (contentType?.includes("application/json")) {
      const retried = await this.retryIfBodyCode401<T>(data, url, makeRequest);
      if (retried != null) return { data: retried as T };
    }
    return { data: (data ?? null) as T };
  }

  async put<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await this.fetchWithTimeout(
      url,
      {
        method: "PUT",
        headers: this.getHeaders(),
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

  async patch<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        {
          method: "PATCH",
          headers: this.getHeaders(),
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        },
        options.timeout || 10000
      );
    const response = await makeRequest();
    if (!response.ok) await this.handleErrorResponse(response, url, makeRequest);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    if (contentType?.includes("application/json")) {
      const retried = await this.retryIfBodyCode401<T>(data, url, makeRequest);
      if (retried != null) return { data: retried as T };
    }
    return { data: (data ?? null) as T };
  }

  async delete<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<{ data: T }> {
    const url = `${this.baseURL}${endpoint}`;
    const makeRequest = () =>
      this.fetchWithTimeout(
        url,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        },
        options.timeout || 10000
      );
    const response = await makeRequest();
    if (!response.ok) await this.handleErrorResponse(response, url, makeRequest);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await response.json() : await response.text();
    if (contentType?.includes("application/json")) {
      const retried = await this.retryIfBodyCode401<T>(data, url, makeRequest);
      if (retried != null) return { data: retried as T };
    }
    return { data: (data ?? null) as T };
  }
}

const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
