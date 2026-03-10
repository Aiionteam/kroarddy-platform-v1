import { create } from "zustand";
import * as authAPI from "@/lib/api/auth";

type LoadingType = "login" | "google" | "kakao" | "naver" | "guest" | "logout" | null;

interface LoginState {
  isAuthenticated: boolean;
  isLoading: boolean;
  loadingType: LoadingType;
  error: string | null;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  setAuthenticated: (v: boolean) => void;
  setLoadingType: (v: LoadingType) => void;
  restoreAuthState: () => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleKakaoLogin: () => Promise<void>;
  handleNaverLogin: () => Promise<void>;
  handleGuestLogin: () => void;
  logout: () => Promise<void>;
}

const initialState = {
  isAuthenticated: false,
  isLoading: false,
  loadingType: null as LoadingType,
  error: null,
  accessToken: null as string | null,
};

/** OAuth 로그인 팝업을 화면 중앙에 띄우기 위한 window.open features */
function getCenteredPopupFeatures(width = 500, height = 700): string {
  if (typeof window === "undefined") return `width=${width},height=${height},resizable=yes,scrollbars=yes`;
  const left = Math.round((window.screen.width - width) / 2);
  const top = Math.round((window.screen.height - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

export const useLoginStore = create<LoginState>((set, get) => ({
  ...initialState,
  setAccessToken: (accessToken) => set({ accessToken }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoadingType: (loadingType) => set({ loadingType }),

  restoreAuthState: async () => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("isGuest") === "true") {
      set({ isAuthenticated: true, loadingType: "guest" });
      return;
    }
    if (sessionStorage.getItem("isAuthenticated") !== "true") return;

    const loadingType = (sessionStorage.getItem("loadingType") as LoadingType) || null;
    set({ isAuthenticated: true, loadingType });

    if (!get().accessToken) {
      try {
        const newToken = await authAPI.refreshAccessToken();
        set({ accessToken: newToken });
      } catch (error: any) {
        const isNetworkError =
          (error instanceof TypeError && error.message === "Failed to fetch") ||
          (error instanceof Error && /failed to fetch|network|load failed|서버에 연결/i.test(error.message));
        if (isNetworkError) {
          console.warn("[LoginStore] 서버에 연결할 수 없어 로그인 화면으로 돌아갑니다.");
        }
        if (
          (error instanceof Error && error.message.includes("Refresh Token이 만료")) ||
          isNetworkError
        ) {
          sessionStorage.removeItem("isAuthenticated");
          sessionStorage.removeItem("loadingType");
          set({ ...initialState, isAuthenticated: false, accessToken: null });
        }
      }
    }
  },

  handleGoogleLogin: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, loadingType: "google", error: null });
    try {
      const { getGoogleAuthUrlService } = await import("@/service");
      const url = await getGoogleAuthUrlService();
      if (typeof window === "undefined") return;
      const popup = window.open(url, "google-login", getCenteredPopupFeatures());
      if (!popup) {
        set({ isLoading: false, loadingType: null, error: "팝업이 차단되었습니다." });
        alert("팝업 차단을 해제해 주세요.");
        return;
      }
      let timeoutId: NodeJS.Timeout | null = null;
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "OAUTH_LOGIN_SUCCESS") {
          const { token, provider } = event.data;
          if (token) set({ accessToken: token });
          set({ isAuthenticated: true, isLoading: false, loadingType: provider || "google", error: null });
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider || "google");
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
          window.location.href = "/home";
        }
        if (event.data?.type === "OAUTH_LOGIN_ERROR") {
          set({ isLoading: false, loadingType: null, error: event.data.error });
          alert("로그인 실패: " + (event.data.error || "알 수 없는 오류"));
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
        }
      };
      window.addEventListener("message", messageListener);
      timeoutId = setTimeout(() => {
        window.removeEventListener("message", messageListener);
        set({ isLoading: false, loadingType: null });
      }, 5 * 60 * 1000);
    } catch (error: any) {
      set({ isLoading: false, loadingType: null, error: error.message });
      alert(error.message || "구글 로그인에 실패했습니다.");
    }
  },

  handleKakaoLogin: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, loadingType: "kakao", error: null });
    try {
      const { getKakaoAuthUrlService } = await import("@/service");
      const url = await getKakaoAuthUrlService();
      if (typeof window === "undefined") return;
      const popup = window.open(url, "kakao-login", getCenteredPopupFeatures());
      if (!popup) {
        set({ isLoading: false, loadingType: null, error: "팝업이 차단되었습니다." });
        alert("팝업 차단을 해제해 주세요.");
        return;
      }
      let timeoutId: NodeJS.Timeout | null = null;
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "OAUTH_LOGIN_SUCCESS") {
          const { token, provider } = event.data;
          if (token) set({ accessToken: token });
          set({ isAuthenticated: true, isLoading: false, loadingType: provider || "kakao", error: null });
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider || "kakao");
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
          window.location.href = "/home";
        }
        if (event.data?.type === "OAUTH_LOGIN_ERROR") {
          set({ isLoading: false, loadingType: null, error: event.data.error });
          alert("로그인 실패: " + (event.data.error || "알 수 없는 오류"));
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
        }
      };
      window.addEventListener("message", messageListener);
      timeoutId = setTimeout(() => {
        window.removeEventListener("message", messageListener);
        set({ isLoading: false, loadingType: null });
      }, 5 * 60 * 1000);
    } catch (error: any) {
      set({ isLoading: false, loadingType: null, error: error.message });
      alert(error.message || "카카오 로그인에 실패했습니다.");
    }
  },

  handleNaverLogin: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, loadingType: "naver", error: null });
    try {
      const { getNaverAuthUrlService } = await import("@/service");
      const url = await getNaverAuthUrlService();
      if (typeof window === "undefined") return;
      const popup = window.open(url, "naver-login", getCenteredPopupFeatures());
      if (!popup) {
        set({ isLoading: false, loadingType: null, error: "팝업이 차단되었습니다." });
        alert("팝업 차단을 해제해 주세요.");
        return;
      }
      let timeoutId: NodeJS.Timeout | null = null;
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "OAUTH_LOGIN_SUCCESS") {
          const { token, provider } = event.data;
          if (token) set({ accessToken: token });
          set({ isAuthenticated: true, isLoading: false, loadingType: provider || "naver", error: null });
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider || "naver");
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
          window.location.href = "/home";
        }
        if (event.data?.type === "OAUTH_LOGIN_ERROR") {
          set({ isLoading: false, loadingType: null, error: event.data.error });
          alert("로그인 실패: " + (event.data.error || "알 수 없는 오류"));
          window.removeEventListener("message", messageListener);
          if (timeoutId) clearTimeout(timeoutId);
        }
      };
      window.addEventListener("message", messageListener);
      timeoutId = setTimeout(() => {
        window.removeEventListener("message", messageListener);
        set({ isLoading: false, loadingType: null });
      }, 5 * 60 * 1000);
    } catch (error: any) {
      set({ isLoading: false, loadingType: null, error: error.message });
      alert(error.message || "네이버 로그인에 실패했습니다.");
    }
  },

  handleGuestLogin: () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("isGuest", "true");
    set({ isAuthenticated: true, loadingType: "guest" });
    window.location.href = "/home";
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (_) {}
    set({ ...initialState, isAuthenticated: false, accessToken: null });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("loadingType");
      sessionStorage.removeItem("isGuest");
      window.location.href = "/";
    }
  },
}));
