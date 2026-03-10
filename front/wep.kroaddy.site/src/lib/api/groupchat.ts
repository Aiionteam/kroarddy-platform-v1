import apiClient from "./client";

export type RoomType = "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

export interface GroupChatMessage {
  id?: number;
  roomType?: string;
  userId?: number;
  username?: string;
  message: string;
  lookingForBuddy?: boolean;
  createdAt?: string;
}

export interface ChatRoomInfo {
  roomType: string;
  label: string;
  minHonor: number;
  accessible: boolean;
}

export interface GroupChatResponse {
  code: number;
  message: string;
  data?: GroupChatMessage | GroupChatMessage[] | ChatRoomInfo[];
}

/** 대화방 목록 (접근 가능 여부·필요 명예도 포함). JWT 필요 */
export const getGroupChatRooms = async (): Promise<GroupChatResponse> => {
  const { data } = await apiClient.get<GroupChatResponse>("/api/groupchat/rooms");
  return data as GroupChatResponse;
};

export const getRecentGroupChatMessages = async (
  roomType: string = "SILVER",
  limit: number = 50
): Promise<GroupChatResponse> => {
  const { data } = await apiClient.get<GroupChatResponse>(
    `/api/groupchat/recent?roomType=${encodeURIComponent(roomType)}&limit=${limit}`
  );
  return data as GroupChatResponse;
};

export const sendGroupChatMessage = async (
  message: string,
  options?: { roomType?: string; lookingForBuddy?: boolean }
): Promise<GroupChatResponse> => {
  const { data } = await apiClient.post<GroupChatResponse>("/api/groupchat", {
    message,
    roomType: options?.roomType ?? undefined,
    lookingForBuddy: options?.lookingForBuddy ?? false,
  });
  return data as GroupChatResponse;
};
