import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/auth/token_store.dart";
import "../../../core/network/api_client.dart";
import "profile_models.dart";

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return ProfileRepository(dio, tokenStore);
});

class ProfileRepository {
  ProfileRepository(this._dio, this._tokenStore);

  final Dio _dio;
  final TokenStore _tokenStore;

  Future<(int userId, int appUserId)> resolveIds() async {
    final token = await _tokenStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw Exception("로그인이 필요합니다.");
    }
    final userId = getUserIdFromToken(token);
    final appUserId = getAppUserIdFromToken(token);
    if (userId == null || appUserId == null) {
      throw Exception("토큰에서 사용자 ID를 확인할 수 없습니다.");
    }
    return (userId, appUserId);
  }

  Future<UserModel?> findUserById(int userId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/users/findById",
      data: {"id": userId},
    );
    final body = res.data ?? const <String, dynamic>{};
    final data = body["data"];
    if (data is Map) {
      return UserModel.fromJson(Map<String, dynamic>.from(data));
    }
    return null;
  }

  Future<void> updateNickname({
    required UserModel baseUser,
    required String nickname,
  }) async {
    final payload = baseUser.toJson()..["nickname"] = nickname.trim();
    await _dio.put<Map<String, dynamic>>("/users", data: payload);
  }

  Future<void> deleteUser(int userId) async {
    await _dio.delete<Map<String, dynamic>>(
      "/users",
      data: {"id": userId},
    );
  }

  Future<TravelProfile?> fetchTravelProfile(int appUserId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>("/v1/user-profile/$appUserId");
      return TravelProfile.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<TravelProfile> upsertTravelProfile({
    required int appUserId,
    required ProfileForm form,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/user-profile",
      data: {
        "user_id": appUserId,
        "gender": form.gender.isEmpty ? null : form.gender,
        "age_band": form.ageBand.isEmpty ? null : form.ageBand,
        "dietary_pref": form.dietaryPref.isEmpty ? null : form.dietaryPref,
        "religion": form.religion.isEmpty ? null : form.religion,
        "nationality": form.nationality.isEmpty ? null : form.nationality,
      },
    );
    return TravelProfile.fromJson(res.data ?? const {});
  }
}
