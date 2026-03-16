import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

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

  @override
  UserContentState build() => UserContentState.initial();

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
    state = state.copyWith(loading: true, message: "유저 루트 피드 불러오는 중...");
    try {
      final routes = await _repo.fetchRoutes(limit: _pageSize, offset: 0);
      state = state.copyWith(
        loading: false,
        feed: routes,
        nextOffset: routes.length,
        hasMoreFeed: routes.length >= _pageSize,
        message: "피드 ${routes.length}건 로드 완료",
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
    state = state.copyWith(loadingMore: true, message: "피드 추가 로드 중...");
    try {
      final more = await _repo.fetchRoutes(limit: _pageSize, offset: state.nextOffset);
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
        message: "피드 ${feed.length}건 로드 완료",
      );
    } catch (e) {
      state = state.copyWith(
        loadingMore: false,
        message: "추가 로드 실패: $e",
      );
    }
  }

  Future<void> likeRoute(int routeId) async {
    try {
      final likes = await _repo.likeRoute(routeId);
      final updated = state.feed.map((route) {
        if (route.id == routeId) {
          return UserRoute(
            id: route.id,
            userId: route.userId,
            title: route.title,
            location: route.location,
            description: route.description,
            routeItems: route.routeItems,
            tags: route.tags,
            imageUrl: route.imageUrl,
            likes: likes,
            createdAt: route.createdAt,
          );
        }
        return route;
      }).toList();
      state = state.copyWith(feed: updated, message: "좋아요 반영 완료");
    } catch (e) {
      state = state.copyWith(message: "좋아요 실패: $e");
    }
  }

  Future<void> polishDraft() async {
    state = state.copyWith(loading: true, message: "AI 폴리시 실행 중...", clearPolished: true);
    try {
      final routeItems = _parseRouteItems(state.draftRouteItemsText);
      if (routeItems.isEmpty) {
        throw Exception("루트 장소를 1개 이상 입력해 주세요.");
      }

      final polished = await _repo.polishRoute(
        title: state.draftTitle.trim(),
        location: state.draftLocation.trim(),
        description: state.draftDescription.trim(),
        routeItems: routeItems,
      );
      state = state.copyWith(
        loading: false,
        polished: polished,
        message: "AI 폴리시 완료",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "AI 폴리시 실패: $e",
      );
    }
  }

  Future<void> pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    state = state.copyWith(
      selectedImagePath: file.path,
      clearUploadedImageUrl: true,
      message: "이미지 선택 완료",
    );
  }

  Future<void> validateAndUploadImage() async {
    final path = state.selectedImagePath;
    if (path == null || path.isEmpty) {
      state = state.copyWith(message: "먼저 이미지를 선택해 주세요.");
      return;
    }

    state = state.copyWith(
      loading: true,
      message: "이미지 검증/업로드 중...",
      uploadProgress: 0,
    );
    try {
      final file = XFile(path);
      final validated = await _repo.validateImageAndGetUploadUrl(file);
      await _repo.uploadImageToS3(
        uploadUrl: validated.uploadUrl,
        file: file,
        onSendProgress: (sent, total) {
          if (total <= 0) return;
          state = state.copyWith(uploadProgress: sent / total);
        },
      );
      state = state.copyWith(
        loading: false,
        uploadedImageUrl: validated.imageUrl,
        uploadProgress: 1,
        message: "이미지 업로드 완료",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        clearUploadProgress: true,
        message: "이미지 업로드 실패: $e",
      );
    }
  }

  Future<void> savePolishedRoute() async {
    final polished = state.polished;
    if (polished == null) {
      state = state.copyWith(message: "먼저 AI 폴리시를 실행해 주세요.");
      return;
    }

    state = state.copyWith(loading: true, message: "유저 루트 저장 중...");
    try {
      final saved = await _repo.saveRoute(
        userId: null,
        title: polished.title,
        location: polished.location,
        description: polished.description,
        routeItems: polished.routeItems,
        tags: polished.tags,
        imageUrl: state.uploadedImageUrl,
      );
      state = state.copyWith(
        loading: false,
        feed: [saved, ...state.feed],
        nextOffset: state.nextOffset + 1,
        draftTitle: "부산 당일 감성 코스",
        draftLocation: "부산",
        draftDescription: "바다와 야경 중심의 가벼운 코스",
        draftRouteItemsText: "해운대 - 오후 산책\n광안리 - 야경\n국제시장 - 먹거리",
        clearPolished: true,
        clearSelectedImagePath: true,
        clearUploadedImageUrl: true,
        clearUploadProgress: true,
        saveSuccessCount: state.saveSuccessCount + 1,
        message: "유저 루트 저장 완료",
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
}
