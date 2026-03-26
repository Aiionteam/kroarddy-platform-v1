import { OAuthCallbackParams, OAuthCallbackResult, OAuthCallbackHandlers, OAuthProvider } from "./oauth-base.service";
import { handleGoogleCallback } from "./google-oauth.service";
import { handleKakaoCallback } from "./kakao-oauth.service";
import { handleNaverCallback } from "./naver-oauth.service";

export const handleOAuthCallback = (
  params: OAuthCallbackParams,
  callbacks: OAuthCallbackHandlers,
  provider?: OAuthProvider
): OAuthCallbackResult => {
  const target: OAuthProvider = provider ?? params.provider ?? "google";
  switch (target) {
    case "kakao": return handleKakaoCallback(params, callbacks);
    case "naver": return handleNaverCallback(params, callbacks);
    case "google":
    default: return handleGoogleCallback(params, callbacks);
  }
};

export { extractOAuthParams } from "./oauth-base.service";
