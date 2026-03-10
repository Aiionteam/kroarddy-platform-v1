import { getNaverAuthUrl } from "@/lib/api/naver";
import { OAuthCallbackParams, OAuthCallbackResult, OAuthCallbackHandlers, OAuthBaseHandler } from "./oauth-base.service";

export const getNaverAuthUrlService = () => getNaverAuthUrl();
export const handleNaverCallback = (params: OAuthCallbackParams, callbacks: OAuthCallbackHandlers): OAuthCallbackResult =>
  OAuthBaseHandler.handleOAuthCallbackBase(params, callbacks, "naver");
export const extractNaverParams = (searchParams: URLSearchParams) => OAuthBaseHandler.extractOAuthParams(searchParams);
