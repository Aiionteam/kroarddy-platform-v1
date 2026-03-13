import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/k_content_repository.dart";
import "k_content_state.dart";

final kContentControllerProvider = NotifierProvider<KContentController, KContentState>(
  KContentController.new,
);

class KContentController extends Notifier<KContentState> {
  KContentRepository get _repo => ref.read(kContentRepositoryProvider);

  @override
  KContentState build() => KContentState.initial();

  Future<void> checkHealth() async {
    state = state.copyWith(loading: true, message: "K-Content 상태 확인 중...");
    try {
      final data = await _repo.health();
      final status = data["status"]?.toString() ?? "unknown";
      final message = data["message"]?.toString() ?? "";
      state = state.copyWith(
        loading: false,
        message: "status=$status ${message.isNotEmpty ? "· $message" : ""}",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "K-Content 상태 확인 실패: $e",
      );
    }
  }
}
