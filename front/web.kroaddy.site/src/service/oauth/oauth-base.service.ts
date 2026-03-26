import { useLoginStore } from "@/store";

export type OAuthProvider = "google" | "kakao" | "naver";

export interface OAuthCallbackParams {
  /** URL 파라미터 provider (쿠키 기반 전환 후 필수) */
  provider: OAuthProvider | null;
  /** 내부 사용자 ID (sessionStorage 저장용) */
  userId: string | null;
  /** 닉네임 (sessionStorage 저장용) */
  nickname: string | null;
  /** 에러 메시지 */
  error: string | null;
  errorDescription: string | null;
}

export interface OAuthCallbackResult {
  success: boolean;
  provider?: OAuthProvider;
  error?: string;
}

export interface OAuthCallbackHandlers {
  onSuccess: (provider: OAuthProvider) => void | Promise<void>;
  onError: (error: string) => void;
  onRedirect?: (path: string) => void;
}

export const OAuthBaseHandler = (() => {
  /**
   * 팝업 완료 시 부모 창으로 메타데이터를 전송합니다.
   * 토큰은 HttpOnly 쿠키로 전달되므로 URL/postMessage에 포함하지 않습니다.
   */
  const sendSuccessToParent = (userId: string, nickname: string, provider: OAuthProvider) => {
    if (typeof window === "undefined" || !window.opener) return;
    window.opener.postMessage(
      { type: "OAUTH_LOGIN_SUCCESS", user_id: userId, nickname, provider },
      window.location.origin
    );
  };

  const sendErrorToParent = (error: string) => {
    if (typeof window === "undefined" || !window.opener) return;
    window.opener.postMessage({ type: "OAUTH_LOGIN_ERROR", error }, window.location.origin);
  };

  const closePopup = () => {
    if (typeof window === "undefined" || !window.opener) return;
    try { window.close(); } catch (_) {}
  };

  /**
   * 백엔드 리다이렉트 파라미터를 파싱합니다.
   * 새 형식: ?provider=X&user_id=N&nickname=N
   */
  const extractOAuthParams = (searchParams: URLSearchParams): OAuthCallbackParams => {
    const rawProvider = searchParams.get("provider");
    const validProviders: OAuthProvider[] = ["google", "kakao", "naver"];
    const provider: OAuthProvider | null =
      rawProvider && validProviders.includes(rawProvider as OAuthProvider)
        ? (rawProvider as OAuthProvider)
        : null;

    return {
      provider,
      userId: searchParams.get("user_id"),
      nickname: searchParams.get("nickname"),
      error: searchParams.get("error"),
      errorDescription: searchParams.get("error_description"),
    };
  };

  const handleOAuthCallbackBase = (
    params: OAuthCallbackParams,
    callbacks: OAuthCallbackHandlers,
    defaultProvider: OAuthProvider = "google"
  ): OAuthCallbackResult => {
    const { provider, userId, nickname, error, errorDescription } = params;
    const isPopup = typeof window !== "undefined" && window.opener !== null;
    const resolvedProvider: OAuthProvider = provider ?? defaultProvider;

    if (error) {
      const errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
      if (isPopup) { sendErrorToParent(errorMsg); closePopup(); return { success: false, error: errorMsg }; }
      callbacks.onError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (userId) {
      try {
        // sessionStorage에 사용자 메타데이터 저장 (토큰은 HttpOnly 쿠키에서 자동 전송)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("app_user_id", userId);
          if (nickname) sessionStorage.setItem("nickname", nickname);
        }

        if (isPopup) {
          sendSuccessToParent(userId, nickname ?? "", resolvedProvider);
          closePopup();
          return { success: true, provider: resolvedProvider };
        }

        // onSuccess가 async일 수 있으므로 라우팅은 onSuccess 내부에서 처리
        Promise.resolve(callbacks.onSuccess(resolvedProvider)).catch(() => {
          if (callbacks.onRedirect) callbacks.onRedirect("/home");
        });
        return { success: true, provider: resolvedProvider };
      } catch {
        const errorMsg = "로그인 처리 중 오류가 발생했습니다.";
        if (isPopup) { sendErrorToParent(errorMsg); closePopup(); return { success: false, error: errorMsg }; }
        callbacks.onError(errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    return { success: false, error: "인증 정보를 받지 못했습니다." };
  };

  return { extractOAuthParams, handleOAuthCallbackBase };
})();

/** Named export for convenience */
export const extractOAuthParams = OAuthBaseHandler.extractOAuthParams;
