import { getGoogleAuthUrl } from "@/lib/api/google";
import { OAuthCallbackParams, OAuthCallbackResult, OAuthCallbackHandlers, OAuthBaseHandler } from "./oauth-base.service";

export const getGoogleAuthUrlService = () => getGoogleAuthUrl();
export const handleGoogleCallback = (params: OAuthCallbackParams, callbacks: OAuthCallbackHandlers): OAuthCallbackResult =>
  OAuthBaseHandler.handleOAuthCallbackBase(params, callbacks, "google");
export const extractGoogleParams = (searchParams: URLSearchParams) => OAuthBaseHandler.extractOAuthParams(searchParams);
