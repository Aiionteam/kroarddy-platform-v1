import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../../core/auth/jwt_claims.dart";
import "../../../auth/presentation/state/auth_controller.dart";
import "../../data/user_content_models.dart";
import "../../data/user_content_repository.dart";
import "user_content_state.dart";

final userContentControllerProvider =
    NotifierProvider<UserContentController, UserContentState>(
  UserContentController.new,
);

class UserContentController extends Notifier<UserContentState> {
  UserContentRepository get _repo => ref.read(userContentRepositoryProvider);
  final ImagePicker _picker = ImagePicker();
  static const int _pageSize = 20;

  int? _currentAppUserId() {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return null;
    return getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
  }

  String? _currentNickname() {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return null;
    return getNicknameFromToken(token);
  }

  @override
  UserContentState build() => UserContentState.initial();

  void setViewMode(UserContentViewMode mode) {
    state = state.copyWith(
      viewMode: mode,
      appliedSearchNickname: "",
    );
  }

  void setAppliedSearchNickname(String value) {
    state = state.copyWith(appliedSearchNickname: value.trim());
  }

  void setDraftTitle(String value) {
    state = state.copyWith(draftTitle: value);
  }

  void setDraftLocation(String value) {
    state = state.copyWith(draftLocation: value);
  }

  void setDraftDescription(String value) {
    state = state.copyWith(draftDescription: value);
  }

  void setDraftRouteItemsText(String value) {
    state = state.copyWith(draftRouteItemsText: value);
  }

  Future<void> loadFeed() async {
    state = state.copyWith(loading: true, message: "");
    try {
      final uid = _currentAppUserId();
      final ownerId = state.viewMode == UserContentViewMode.mine ? uid : null;
      final nick = state.viewMode == UserContentViewMode.all
          ? (state.appliedSearchNickname.trim().isNotEmpty ? state.appliedSearchNickname.trim() : null)
          : null;
      final routes = await _repo.fetchRoutes(
        limit: _pageSize,
        offset: 0,
        userId: uid,
        ownerId: ownerId,
        nickname: nick,
      );
      state = state.copyWith(
        loading: false,
        feed: routes,
        nextOffset: routes.length,
        hasMoreFeed: routes.length >= _pageSize,
        message: "",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "피드 로드 실패: $e",
      );
    }
  }

  Future<void> loadMoreFeed() async {
    if (state.loading || state.loadingMore || !state.hasMoreFeed) return;
    state = state.copyWith(loadingMore: true, message: "");
    try {
      final uid = _currentAppUserId();
      final ownerId = state.viewMode == UserContentViewMode.mine ? uid : null;
      final nick = state.viewMode == UserContentViewMode.all
          ? (state.appliedSearchNickname.trim().isNotEmpty ? state.appliedSearchNickname.trim() : null)
          : null;
      final more = await _repo.fetchRoutes(
        limit: _pageSize,
        offset: state.nextOffset,
        userId: uid,
        ownerId: ownerId,
        nickname: nick,
      );
      final merged = <UserRoute>[...state.feed, ...more];
      final dedup = <int, UserRoute>{};
      for (final route in merged) {
        dedup[route.id] = route;
      }
      final feed = dedup.values.toList();
      state = state.copyWith(
        loadingMore: false,
        feed: feed,
        nextOffset: state.nextOffset + more.length,
        hasMoreFeed: more.length >= _pageSize,
        message: "",
      );
    } catch (e) {
      state = state.copyWith(
        loadingMore: false,
        message: "추가 로드 실패: $e",
      );
    }
  }

  Future<void> likeRoute(int routeId) async {
    final uid = _currentAppUserId();
    if (uid == null) {
      state = state.copyWith(message: "로그인 후 좋아요할 수 있습니다.");
      return;
    }
    try {
      final result = await _repo.likeRoute(routeId, userId: uid);
      final updated = state.feed.map((route) {
        if (route.id == routeId) {
          return UserRoute(
            id: route.id,
            userId: route.userId,
            nickname: route.nickname,
            likedByMe: true,
            title: route.title,
            location: route.location,
            description: route.description,
            routeItems: route.routeItems,
            tags: route.tags,
            imageUrl: route.imageUrl,
            likes: result.likes,
            createdAt: route.createdAt,
          );
        }
        return route;
      }).toList();
      state = state.copyWith(feed: updated, message: "");
    } catch (e) {
      state = state.copyWith(message: "좋아요 실패: $e");
    }
  }

  Future<void> deleteRoute(int routeId) async {
    final uid = _currentAppUserId();
    if (uid == null) return;
    try {
      await _repo.deleteRoute(routeId, userId: uid);
      state = state.copyWith(
        feed: state.feed.where((r) => r.id != routeId).toList(),
        message: "",
      );
    } catch (e) {
      state = state.copyWith(message: "삭제 실패: $e");
    }
  }

  /// 웹 `polishRoute` — [items]는 모든 일차 장소를 순서대로 합친 목록
  Future<void> polishDraftFromItems(List<RouteItemInput> items) async {
    state = state.copyWith(loading: true, message: "", clearPolished: true);
    try {
      final filtered = items.where((s) => s.place.trim().isNotEmpty).toList();
      if (filtered.isEmpty) {
        throw Exception("루트 장소를 1개 이상 입력해 주세요.");
      }
      if (state.draftTitle.trim().isEmpty || state.draftLocation.trim().isEmpty) {
        throw Exception("루트 제목과 여행지를 입력해 주세요.");
      }

      final polished = await _repo.polishRoute(
        title: state.draftTitle.trim(),
        location: state.draftLocation.trim(),
        description: state.draftDescription.trim(),
        routeItems: filtered,
      );
      state = state.copyWith(
        loading: false,
        polished: polished,
        message: "",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "AI 폴리시 실패: $e",
      );
    }
  }

  Future<void> polishDraft() async {
    final items = _parseRouteItems(state.draftRouteItemsText);
    await polishDraftFromItems(items);
  }

  Future<void> pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    state = state.copyWith(
      selectedImagePath: file.path,
      clearValidatedImage: true,
      clearUploadedImageUrl: true,
      message: "",
    );
  }

  /// 사진 단계 → 폼 단계 진입 시 (웹 `handleNextFromPhoto`)
  Future<void> validateImageForNextStep() async {
    final path = state.selectedImagePath;
    if (path == null || path.isEmpty) return;
    if (state.validatedImage != null) return;

    state = state.copyWith(loading: true, message: "");
    try {
      final file = XFile(path);
      final validated = await _repo.validateImageAndGetUploadUrl(file);
      state = state.copyWith(
        loading: false,
        validatedImage: validated,
        message: "",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        clearValidatedImage: true,
        message: "이미지 검증 실패: $e",
      );
      rethrow;
    }
  }

  Future<void> savePolishedRoute() async {
    final polished = state.polished;
    if (polished == null) {
      state = state.copyWith(message: "먼저 AI 폴리시를 실행해 주세요.");
      return;
    }

    state = state.copyWith(loading: true, message: "");
    try {
      String? imageUrl = state.uploadedImageUrl;
      final path = state.selectedImagePath;
      if (imageUrl == null && path != null && path.isNotEmpty) {
        var validated = state.validatedImage;
        if (validated == null) {
          final file = XFile(path);
          validated = await _repo.validateImageAndGetUploadUrl(file);
        }
        final file = XFile(path);
        await _repo.uploadImageToS3(uploadUrl: validated.uploadUrl, file: file);
        imageUrl = validated.imageUrl;
      }

      final saved = await _repo.saveRoute(
        userId: _currentAppUserId(),
        nickname: _currentNickname(),
        title: polished.title,
        location: polished.location,
        description: polished.description,
        routeItems: polished.routeItems,
        tags: polished.tags,
        imageUrl: imageUrl,
      );
      state = state.copyWith(
        loading: false,
        feed: [saved, ...state.feed],
        nextOffset: state.nextOffset + 1,
        draftTitle: "",
        draftLocation: "",
        draftDescription: "",
        draftRouteItemsText: "",
        clearPolished: true,
        clearSelectedImagePath: true,
        clearValidatedImage: true,
        clearUploadedImageUrl: true,
        clearUploadProgress: true,
        saveSuccessCount: state.saveSuccessCount + 1,
        message: "",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "루트 저장 실패: $e",
      );
    }
  }

  List<RouteItemInput> _parseRouteItems(String text) {
    final lines = text
        .split("\n")
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    final out = <RouteItemInput>[];
    for (final line in lines) {
      final parts = line.split(" - ");
      final place = parts.first.trim();
      if (place.isEmpty) continue;
      final note = parts.length > 1 ? parts.sublist(1).join(" - ").trim() : null;
      out.add(RouteItemInput(place: place, note: note?.isEmpty == true ? null : note));
    }
    return out;
  }

  void clearPolishResult() {
    state = state.copyWith(clearPolished: true, message: "");
  }

  /// 업로드 시트 닫을 때 초기화
  void resetUploadDraft() {
    state = state.copyWith(
      draftTitle: "",
      draftLocation: "",
      draftDescription: "",
      draftRouteItemsText: "",
      clearPolished: true,
      clearSelectedImagePath: true,
      clearValidatedImage: true,
      clearUploadedImageUrl: true,
      clearUploadProgress: true,
      message: "",
    );
  }
}
