import apiClient from "./client";

export interface BlockedUser {
  id: number;
  name?: string;
  nickname?: string;
}

export interface BlockResponse {
  code: number;
  message: string;
  data?: BlockedUser | BlockedUser[] | boolean;
}

export const blockUser = async (targetId: number): Promise<BlockResponse> => {
  const { data } = await apiClient.post<BlockResponse>(`/api/users/block/${targetId}`);
  return data as BlockResponse;
};

export const unblockUser = async (targetId: number): Promise<BlockResponse> => {
  const { data } = await apiClient.delete<BlockResponse>(`/api/users/block/${targetId}`);
  return data as BlockResponse;
};

export const getBlockList = async (): Promise<BlockResponse> => {
  const { data } = await apiClient.get<BlockResponse>("/api/users/block");
  return data as BlockResponse;
};

export const isBlocked = async (targetId: number): Promise<boolean> => {
  try {
    const { data } = await apiClient.get<BlockResponse>(`/api/users/block/${targetId}`);
    return (data as BlockResponse).data === true;
  } catch {
    return false;
  }
};
