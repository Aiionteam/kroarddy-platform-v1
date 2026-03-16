class AuthState {
  const AuthState({
    required this.loading,
    required this.message,
    required this.accessToken,
  });

  factory AuthState.initial() {
    return const AuthState(
      loading: false,
      message: "소셜 로그인을 진행해 주세요.",
      accessToken: null,
    );
  }

  final bool loading;
  final String message;
  final String? accessToken;

  AuthState copyWith({
    bool? loading,
    String? message,
    String? accessToken,
    bool clearToken = false,
  }) {
    return AuthState(
      loading: loading ?? this.loading,
      message: message ?? this.message,
      accessToken: clearToken ? null : (accessToken ?? this.accessToken),
    );
  }
}
