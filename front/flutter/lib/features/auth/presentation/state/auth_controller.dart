import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/auth_repository.dart";
import "auth_state.dart";

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  AuthState build() => AuthState.initial();

  Future<void> signIn(String provider) async {
    state = state.copyWith(loading: true, message: "$provider 로그인 진행 중...");
    try {
      final token = await _repo.signInWithProvider(provider);
      state = state.copyWith(
        loading: false,
        accessToken: token,
        message: "$provider 로그인 성공",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "$provider 로그인 실패: $e",
      );
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = state.copyWith(
      message: "로그아웃 완료",
      clearToken: true,
    );
  }
}
