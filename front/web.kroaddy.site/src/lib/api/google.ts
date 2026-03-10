import apiClient from "./client";

export const getGoogleAuthUrl = async (): Promise<string> => {
  const frontendUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "http://localhost:3000";
  const response = await apiClient.get<{ success?: boolean; auth_url?: string; message?: string }>(
    `/api/google/auth-url?frontend_url=${encodeURIComponent(frontendUrl)}`
  );
  if (response.data.success === false) throw new Error(response.data.message || "구글 로그인 URL을 가져오는데 실패했습니다.");
  if (!response.data.auth_url) throw new Error("구글 로그인 URL을 받지 못했습니다.");
  return response.data.auth_url;
};
