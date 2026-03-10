import { getKakaoAuthUrl } from "@/lib/api/kakao";
import { OAuthCallbackParams, OAuthCallbackResult, OAuthCallbackHandlers, OAuthBaseHandler } from "./oauth-base.service";

export const getKakaoAuthUrlService = () => getKakaoAuthUrl();
export const handleKakaoCallback = (params: OAuthCallbackParams, callbacks: OAuthCallbackHandlers): OAuthCallbackResult =>
  OAuthBaseHandler.handleOAuthCallbackBase(params, callbacks, "kakao");
export const extractKakaoParams = (searchParams: URLSearchParams) => OAuthBaseHandler.extractOAuthParams(searchParams);
