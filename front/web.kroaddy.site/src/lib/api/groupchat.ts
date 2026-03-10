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

/** 채팅 메시지 API 응답 (send / recent) */
export interface GroupChatMessageResponse {
  code: number;
  message: string;
  data?: GroupChatMessage | GroupChatMessage[];
}

/** 대화방 목록 API 응답 */
export interface GroupChatRoomResponse {
  code: number;
  message: string;
  data?: ChatRoomInfo[];
}

/** @deprecated GroupChatMessageResponse 또는 GroupChatRoomResponse 를 사용하세요 */
export type GroupChatResponse = GroupChatMessageResponse | GroupChatRoomResponse;

/** 대화방 목록 (접근 가능 여부·필요 명예도 포함). JWT 필요 */
export const getGroupChatRooms = async (): Promise<GroupChatRoomResponse> => {
  const { data } = await apiClient.get<GroupChatRoomResponse>("/api/groupchat/rooms");
  return data as GroupChatRoomResponse;
};

export const getRecentGroupChatMessages = async (
  roomType: string = "SILVER",
  limit: number = 50
): Promise<GroupChatMessageResponse> => {
  const { data } = await apiClient.get<GroupChatMessageResponse>(
    `/api/groupchat/recent?roomType=${encodeURIComponent(roomType)}&limit=${limit}`
  );
  return data as GroupChatMessageResponse;
};

export const sendGroupChatMessage = async (
  message: string,
  options?: { roomType?: string; lookingForBuddy?: boolean }
): Promise<GroupChatMessageResponse> => {
  const { data } = await apiClient.post<GroupChatMessageResponse>("/api/groupchat", {
    message,
    roomType: options?.roomType ?? undefined,
    lookingForBuddy: options?.lookingForBuddy ?? false,
  });
  return data as GroupChatMessageResponse;
};
