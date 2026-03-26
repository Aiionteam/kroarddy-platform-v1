import { create } from "zustand";
import * as authAPI from "@/lib/api/auth";

type LoadingType = "login" | "google" | "kakao" | "naver" | "guest" | "logout" | null;

interface LoginState {
  isAuthenticated: boolean;
  isLoading: boolean;
  loadingType: LoadingType;
  error: string | null;
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
};

/** OAuth 로그인 팝업을 화면 중앙에 띄우기 위한 window.open features */
function getCenteredPopupFeatures(width = 500, height = 700): string {
  if (typeof window === "undefined") return `width=${width},height=${height},resizable=yes,scrollbars=yes`;
  const left = Math.round((window.screen.width - width) / 2);
  const top = Math.round((window.screen.height - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

/** 팝업 로그인 공통 처리 (Google / Kakao / Naver 동일 패턴) */
function createPopupLoginHandler(
  getAuthUrl: () => Promise<string>,
  popupName: string,
  defaultProvider: LoadingType,
  set: (state: Partial<LoginState>) => void
) {
  return async () => {
    const state = useLoginStore.getState();
    if (state.isLoading) return;
    set({ isLoading: true, loadingType: defaultProvider, error: null });
    try {
      const url = await getAuthUrl();
      if (typeof window === "undefined") return;
      const popup = window.open(url, popupName, getCenteredPopupFeatures());
      if (!popup) {
        set({ isLoading: false, loadingType: null, error: "팝업이 차단되었습니다." });
        alert("팝업 차단을 해제해 주세요.");
        return;
      }
      let timeoutId: NodeJS.Timeout | null = null;
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "OAUTH_LOGIN_SUCCESS") {
          const { user_id, nickname, provider } = event.data;
          // sessionStorage에 사용자 메타데이터 저장 (토큰은 HttpOnly 쿠키로 이미 전달됨)
          if (user_id) sessionStorage.setItem("app_user_id", String(user_id));
          if (nickname) sessionStorage.setItem("nickname", nickname);
          set({ isAuthenticated: true, isLoading: false, loadingType: provider || defaultProvider, error: null });
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider || defaultProvider);
          // 방금 로그인 완료 — restoreAuthState가 즉시 재검증하지 않도록 타임스탬프 기록
          sessionStorage.setItem("lastSessionVerified", String(Date.now()));
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
      alert(error.message || `${defaultProvider} 로그인에 실패했습니다.`);
    }
  };
}

export const useLoginStore = create<LoginState>((set) => ({
  ...initialState,

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

    // 쿠키가 수동으로 삭제된 경우 등 세션 불일치를 감지하기 위해
    // 마지막 검증 이후 5분이 지났으면 항상 서버에 세션 유효성 확인.
    // 타임스탬프 가드로 여러 탭 동시 마운트 시 RTR 충돌을 방지합니다.
    const lastVerified = Number(sessionStorage.getItem("lastSessionVerified") || 0);
    const VERIFY_INTERVAL_MS = 5 * 60 * 1000; // 5분
    const needsVerify = Date.now() - lastVerified > VERIFY_INTERVAL_MS;

    if (needsVerify) {
      try {
        await authAPI.refreshAccessToken();
        sessionStorage.setItem("lastSessionVerified", String(Date.now()));
        // app_user_id가 없을 경우 refresh 응답에서 복원 (하위호환)
        if (!sessionStorage.getItem("app_user_id")) {
          console.warn("[LoginStore] app_user_id 없음 — 재로그인 필요");
        }
      } catch (error: any) {
        const isNetworkError =
          (error instanceof TypeError && error.message === "Failed to fetch") ||
          (error instanceof Error && /failed to fetch|network|load failed|서버에 연결/i.test(error.message));
        if (isNetworkError) {
          console.warn("[LoginStore] 서버에 연결할 수 없어 로그인 화면으로 돌아갑니다.");
        } else {
          console.warn("[LoginStore] 세션이 만료되어 로그아웃합니다:", error?.message);
        }
        sessionStorage.removeItem("isAuthenticated");
        sessionStorage.removeItem("loadingType");
        sessionStorage.removeItem("app_user_id");
        sessionStorage.removeItem("nickname");
        sessionStorage.removeItem("lastSessionVerified");
        set({ ...initialState, isAuthenticated: false });
      }
    }
  },

  handleGoogleLogin: createPopupLoginHandler(
    async () => { const { getGoogleAuthUrlService } = await import("@/service"); return getGoogleAuthUrlService(); },
    "google-login",
    "google",
    set
  ),

  handleKakaoLogin: createPopupLoginHandler(
    async () => { const { getKakaoAuthUrlService } = await import("@/service"); return getKakaoAuthUrlService(); },
    "kakao-login",
    "kakao",
    set
  ),

  handleNaverLogin: createPopupLoginHandler(
    async () => { const { getNaverAuthUrlService } = await import("@/service"); return getNaverAuthUrlService(); },
    "naver-login",
    "naver",
    set
  ),

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
    set({ ...initialState, isAuthenticated: false });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("loadingType");
      sessionStorage.removeItem("isGuest");
      sessionStorage.removeItem("app_user_id");
      sessionStorage.removeItem("nickname");
      sessionStorage.removeItem("lastSessionVerified");
      window.location.href = "/";
    }
  },
}));
