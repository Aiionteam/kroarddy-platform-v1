import apiClient from "./client";
import type { UserModel } from "./user";

export interface FriendsResponse {
  code: number;
  message: string;
  data?: UserModel | UserModel[];
}

export const sendFriendRequest = async (toUserId: number): Promise<FriendsResponse> => {
  const { data } = await apiClient.post<FriendsResponse>("/api/friends/request", { toUserId });
  return data as FriendsResponse;
};

export const listPendingFriendRequests = async (): Promise<FriendsResponse> => {
  const { data } = await apiClient.get<FriendsResponse>("/api/friends/requests");
  return data as FriendsResponse;
};

export const acceptFriendRequest = async (fromUserId: number): Promise<FriendsResponse> => {
  const { data } = await apiClient.post<FriendsResponse>("/api/friends/accept", { fromUserId });
  return data as FriendsResponse;
};

export const listFriends = async (): Promise<FriendsResponse> => {
  const { data } = await apiClient.get<FriendsResponse>("/api/friends");
  return data as FriendsResponse;
};
