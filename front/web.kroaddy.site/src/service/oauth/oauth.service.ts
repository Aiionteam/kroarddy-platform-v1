import { OAuthCallbackParams, OAuthCallbackResult, OAuthCallbackHandlers, OAuthProvider, OAuthBaseHandler } from "./oauth-base.service";
import { handleGoogleCallback } from "./google-oauth.service";
import { handleKakaoCallback } from "./kakao-oauth.service";
import { handleNaverCallback } from "./naver-oauth.service";

export const handleOAuthCallback = (
  params: OAuthCallbackParams,
  callbacks: OAuthCallbackHandlers,
  provider?: OAuthProvider
): OAuthCallbackResult => {
  let target: OAuthProvider = provider || "google";
  if (params.token && !provider) target = OAuthBaseHandler.extractProviderFromToken(params.token);
  switch (target) {
    case "kakao": return handleKakaoCallback(params, callbacks);
    case "naver": return handleNaverCallback(params, callbacks);
    case "google":
    default: return handleGoogleCallback(params, callbacks);
  }
};

export const extractOAuthParams = (searchParams: URLSearchParams) => OAuthBaseHandler.extractOAuthParams(searchParams);
