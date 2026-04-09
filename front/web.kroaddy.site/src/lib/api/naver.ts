import apiClient from "./client";
import i18n from "@/lib/i18n/config";

export const getNaverAuthUrl = async (): Promise<string> => {
  const response = await apiClient.get<{ success?: boolean; auth_url?: string; message?: string }>("/api/naver/auth-url");
  if (response.data.success === false) throw new Error(response.data.message || i18n.t("auth.api.naver_auth_url_fail", { defaultValue: "네이버 로그인 URL을 가져오는데 실패했습니다." }));
  if (!response.data.auth_url) throw new Error(i18n.t("auth.api.naver_auth_url_missing", { defaultValue: "네이버 로그인 URL을 받지 못했습니다." }));
  return response.data.auth_url;
};
