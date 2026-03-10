/**
 * api.tourstory.site gateway 사용자 서비스 연동
 * (gateway/src/main/java/site/aiion/api/services/user)
 * - 설정 페이지(/settings)에서 사용자 정보 조회·닉네임 CRUD에 사용
 * - findUserById: POST /api/users/findById (Read)
 * - updateUser: PUT /api/users (Update, 닉네임 포함)
 */
import apiClient from "./client";

export interface UserModel {
  id?: number;
  name?: string;
  email?: string;
  nickname?: string;
  provider?: string;
  providerId?: string;
  /** 명예도 포인트 */
  honor?: number;
  /** 등급: SILVER | GOLD | PLATINUM | DIAMOND */
  tier?: string;
}

export interface UserResponse {
  code: number;
  message: string;
  data?: UserModel;
}

export const findUserById = async (id: number): Promise<UserResponse> => {
  const { data } = await apiClient.post<UserResponse>("/api/users/findById", { id });
  return data as UserResponse;
};

export const updateUser = async (user: UserModel): Promise<UserResponse> => {
  const { data } = await apiClient.put<UserResponse>("/api/users", user);
  return data as UserResponse;
};

/** 계정 탈퇴 (DELETE /api/users). body에 id 필수 */
export const deleteUser = async (user: UserModel): Promise<UserResponse> => {
  const { data } = await apiClient.delete<UserResponse>("/api/users", user);
  return data as UserResponse;
};

/** 명예도 올리기/내리기 (POST /api/users/honor/vote). 하루에 한 번만 동일 액션 가능 */
export const voteHonor = async (
  targetUserId: number,
  action: "UP" | "DOWN"
): Promise<UserResponse> => {
  const { data } = await apiClient.post<UserResponse>("/api/users/honor/vote", {
    targetUserId,
    action,
  });
  return data as UserResponse;
};
