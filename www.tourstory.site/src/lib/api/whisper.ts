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

export interface WhisperResponse {
  code: number;
  message: string;
  data?: WhisperModel | WhisperModel[];
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
