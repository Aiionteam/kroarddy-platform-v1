import apiClient from "./client";

export interface WhisperModel {
  id?: number;
  fromUserId?: number;
  toUserId?: number;
  fromUsername?: string;
  toUsername?: string;
  message: string;
  createdAt?: string;
  readAt?: string;
}

export interface WhisperConversationSummary {
  partnerId: number;
  partnerName: string;
  lastMessage: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface WhisperResponse {
  code: number;
  message: string;
  data?: WhisperModel | WhisperModel[];
}

export interface WhisperConvListResponse {
  code: number;
  message: string;
  data?: WhisperConversationSummary | WhisperConversationSummary[];
}

export const sendWhisper = async (toUserId: number, message: string): Promise<WhisperResponse> => {
  const { data } = await apiClient.post<WhisperResponse>("/api/whisper", { toUserId, message });
  return data as WhisperResponse;
};

export const getWhisperInbox = async (size: number = 50): Promise<WhisperResponse> => {
  const { data } = await apiClient.get<WhisperResponse>(`/api/whisper/inbox?size=${size}`);
  return data as WhisperResponse;
};

export const getWhisperSent = async (size: number = 50): Promise<WhisperResponse> => {
  const { data } = await apiClient.get<WhisperResponse>(`/api/whisper/sent?size=${size}`);
  return data as WhisperResponse;
};

/** 대화 목록 (상대방별 최신 메시지 요약) */
export const getConversationList = async (): Promise<WhisperConvListResponse> => {
  const { data } = await apiClient.get<WhisperConvListResponse>("/api/whisper/conversations");
  return data as WhisperConvListResponse;
};

/** 특정 상대방과의 대화 스레드 */
export const getConversation = async (partnerId: number, size: number = 100): Promise<WhisperResponse> => {
  const { data } = await apiClient.get<WhisperResponse>(`/api/whisper/conversation/${partnerId}?size=${size}`);
  return data as WhisperResponse;
};

/** 읽음 처리 */
export const markConversationRead = async (partnerId: number): Promise<WhisperResponse> => {
  const { data } = await apiClient.patch<WhisperResponse>(`/api/whisper/conversation/${partnerId}/read`);
  return data as WhisperResponse;
};

/** 특정 상대방과의 대화 전체 삭제 (내 쪽만) */
export const deleteConversation = async (partnerId: number): Promise<WhisperResponse> => {
  const { data } = await apiClient.delete<WhisperResponse>(`/api/whisper/conversation/${partnerId}`);
  return data as WhisperResponse;
};
