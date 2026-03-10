import apiClient from "./client";

export const getKakaoAuthUrl = async (): Promise<string> => {
  const response = await apiClient.get<{ success?: boolean; auth_url?: string; message?: string }>("/api/kakao/auth-url");
  if (response.data.success === false) throw new Error(response.data.message || "카카오 로그인 URL을 가져오는데 실패했습니다.");
  if (!response.data.auth_url) throw new Error("카카오 로그인 URL을 받지 못했습니다.");
  return response.data.auth_url;
};
