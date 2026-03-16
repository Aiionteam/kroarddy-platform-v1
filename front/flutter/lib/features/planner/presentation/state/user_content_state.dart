import "../../data/user_content_models.dart";

class UserContentState {
  const UserContentState({
    required this.loading,
    required this.loadingMore,
    required this.message,
    required this.feed,
    required this.nextOffset,
    required this.hasMoreFeed,
    required this.polished,
    required this.draftTitle,
    required this.draftLocation,
    required this.draftDescription,
    required this.draftRouteItemsText,
    required this.selectedImagePath,
    required this.uploadedImageUrl,
    required this.uploadProgress,
    required this.saveSuccessCount,
  });

  factory UserContentState.initial() {
    return const UserContentState(
      loading: false,
      loadingMore: false,
      message: "유저 컨텐츠 피드를 불러올 수 있습니다.",
      feed: <UserRoute>[],
      nextOffset: 0,
      hasMoreFeed: true,
      polished: null,
      draftTitle: "부산 당일 감성 코스",
      draftLocation: "부산",
      draftDescription: "바다와 야경 중심의 가벼운 코스",
      draftRouteItemsText: "해운대 - 오후 산책\n광안리 - 야경\n국제시장 - 먹거리",
      selectedImagePath: null,
      uploadedImageUrl: null,
      uploadProgress: null,
      saveSuccessCount: 0,
    );
  }

  final bool loading;
  final bool loadingMore;
  final String message;
  final List<UserRoute> feed;
  final int nextOffset;
  final bool hasMoreFeed;
  final PolishResponse? polished;
  final String draftTitle;
  final String draftLocation;
  final String draftDescription;
  final String draftRouteItemsText;
  final String? selectedImagePath;
  final String? uploadedImageUrl;
  final double? uploadProgress;
  final int saveSuccessCount;

  UserContentState copyWith({
    bool? loading,
    bool? loadingMore,
    String? message,
    List<UserRoute>? feed,
    int? nextOffset,
    bool? hasMoreFeed,
    PolishResponse? polished,
    String? draftTitle,
    String? draftLocation,
    String? draftDescription,
    String? draftRouteItemsText,
    String? selectedImagePath,
    String? uploadedImageUrl,
    double? uploadProgress,
    int? saveSuccessCount,
    bool clearSelectedImagePath = false,
    bool clearUploadedImageUrl = false,
    bool clearUploadProgress = false,
    bool clearPolished = false,
  }) {
    return UserContentState(
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      message: message ?? this.message,
      feed: feed ?? this.feed,
      nextOffset: nextOffset ?? this.nextOffset,
      hasMoreFeed: hasMoreFeed ?? this.hasMoreFeed,
      polished: clearPolished ? null : (polished ?? this.polished),
      draftTitle: draftTitle ?? this.draftTitle,
      draftLocation: draftLocation ?? this.draftLocation,
      draftDescription: draftDescription ?? this.draftDescription,
      draftRouteItemsText: draftRouteItemsText ?? this.draftRouteItemsText,
      selectedImagePath:
          clearSelectedImagePath ? null : (selectedImagePath ?? this.selectedImagePath),
      uploadedImageUrl:
          clearUploadedImageUrl ? null : (uploadedImageUrl ?? this.uploadedImageUrl),
      uploadProgress: clearUploadProgress ? null : (uploadProgress ?? this.uploadProgress),
      saveSuccessCount: saveSuccessCount ?? this.saveSuccessCount,
    );
  }
}
