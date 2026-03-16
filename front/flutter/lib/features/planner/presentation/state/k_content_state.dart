class KContentState {
  const KContentState({
    required this.loading,
    required this.message,
  });

  factory KContentState.initial() {
    return const KContentState(
      loading: false,
      message: "K-Content 상태를 확인해 보세요.",
    );
  }

  final bool loading;
  final String message;

  KContentState copyWith({
    bool? loading,
    String? message,
  }) {
    return KContentState(
      loading: loading ?? this.loading,
      message: message ?? this.message,
    );
  }
}
