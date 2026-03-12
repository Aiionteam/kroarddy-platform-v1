import { useLoginStore } from "@/store";

export type OAuthProvider = "google" | "kakao" | "naver";

export interface OAuthCallbackParams {
  token: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
}

export interface OAuthCallbackResult {
  success: boolean;
  provider?: OAuthProvider;
  error?: string;
}

export interface OAuthCallbackHandlers {
  onSuccess: (provider: OAuthProvider) => void;
  onError: (error: string) => void;
  onRedirect?: (path: string) => void;
}

export const OAuthBaseHandler = (() => {
  const extractProviderFromToken = (token: string): OAuthProvider => {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return "google";
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      if (payload.provider && ["google", "kakao", "naver"].includes(payload.provider))
        return payload.provider as OAuthProvider;
    } catch (_) {}
    return "google";
  };

  const sendSuccessToParent = (token: string, refreshToken: string | null, provider: OAuthProvider) => {
    if (typeof window === "undefined" || !window.opener) return;
    window.opener.postMessage({ type: "OAUTH_LOGIN_SUCCESS", token, refresh_token: refreshToken, provider }, window.location.origin);
  };

  const sendErrorToParent = (error: string) => {
    if (typeof window === "undefined" || !window.opener) return;
    window.opener.postMessage({ type: "OAUTH_LOGIN_ERROR", error }, window.location.origin);
  };

  const closePopup = () => {
    if (typeof window === "undefined" || !window.opener) return;
    try { window.close(); } catch (_) {}
  };

  const extractOAuthParams = (searchParams: URLSearchParams): OAuthCallbackParams => ({
    token: searchParams.get("token"),
    refreshToken: searchParams.get("refresh_token"),
    error: searchParams.get("error"),
    errorDescription: searchParams.get("error_description"),
  });

  const handleOAuthCallbackBase = (
    params: OAuthCallbackParams,
    callbacks: OAuthCallbackHandlers,
    defaultProvider: OAuthProvider = "google"
  ): OAuthCallbackResult => {
    const { token, refreshToken, error, errorDescription } = params;
    const isPopup = typeof window !== "undefined" && window.opener !== null;

    if (error) {
      const errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
      if (isPopup) { sendErrorToParent(errorMsg); closePopup(); return { success: false, error: errorMsg }; }
      callbacks.onError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (token) {
      try {
        let provider: OAuthProvider;
        try { provider = extractProviderFromToken(token); } catch { provider = defaultProvider; }
        if (isPopup) {
          sendSuccessToParent(token, refreshToken, provider);
          closePopup();
          return { success: true, provider };
        }
        useLoginStore.getState().setAccessToken(token);
        callbacks.onSuccess(provider);
        if (callbacks.onRedirect) callbacks.onRedirect("/home");
        return { success: true, provider };
      } catch (e: any) {
        const errorMsg = "토큰 처리 중 오류가 발생했습니다.";
        if (isPopup) { sendErrorToParent(errorMsg); closePopup(); return { success: false, error: errorMsg }; }
        callbacks.onError(errorMsg);
        return { success: false, error: errorMsg };
      }
    }
    return { success: false, error: "인증 정보를 받지 못했습니다." };
  };

  return { extractOAuthParams, handleOAuthCallbackBase, extractProviderFromToken };
})();
