import "../../data/user_content_models.dart";

/// 웹 `viewMode`: `all` | `mine`
enum UserContentViewMode { all, mine }

class UserContentState {
  const UserContentState({
    required this.loading,
    required this.loadingMore,
    required this.message,
    required this.feed,
    required this.nextOffset,
    required this.hasMoreFeed,
    required this.viewMode,
    required this.appliedSearchNickname,
    required this.polished,
    required this.draftTitle,
    required this.draftLocation,
    required this.draftDescription,
    required this.draftRouteItemsText,
    required this.selectedImagePath,
    required this.validatedImage,
    required this.uploadedImageUrl,
    required this.uploadProgress,
    required this.saveSuccessCount,
  });

  factory UserContentState.initial() {
    return const UserContentState(
      loading: false,
      loadingMore: false,
      message: "",
      feed: <UserRoute>[],
      nextOffset: 0,
      hasMoreFeed: true,
      viewMode: UserContentViewMode.all,
      appliedSearchNickname: "",
      polished: null,
      draftTitle: "",
      draftLocation: "",
      draftDescription: "",
      draftRouteItemsText: "",
      selectedImagePath: null,
      validatedImage: null,
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
  final UserContentViewMode viewMode;
  /// 서버에 전달 중인 닉네임 검색어 (전체 탭)
  final String appliedSearchNickname;
  final PolishResponse? polished;
  final String draftTitle;
  final String draftLocation;
  final String draftDescription;
  final String draftRouteItemsText;
  final String? selectedImagePath;
  /// NSFW 검증 완료 — 저장 직전 S3 업로드에 사용 (웹과 동일)
  final ValidateImageResult? validatedImage;
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
    UserContentViewMode? viewMode,
    String? appliedSearchNickname,
    PolishResponse? polished,
    String? draftTitle,
    String? draftLocation,
    String? draftDescription,
    String? draftRouteItemsText,
    String? selectedImagePath,
    ValidateImageResult? validatedImage,
    String? uploadedImageUrl,
    double? uploadProgress,
    int? saveSuccessCount,
    bool clearSelectedImagePath = false,
    bool clearValidatedImage = false,
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
      viewMode: viewMode ?? this.viewMode,
      appliedSearchNickname: appliedSearchNickname ?? this.appliedSearchNickname,
      polished: clearPolished ? null : (polished ?? this.polished),
      draftTitle: draftTitle ?? this.draftTitle,
      draftLocation: draftLocation ?? this.draftLocation,
      draftDescription: draftDescription ?? this.draftDescription,
      draftRouteItemsText: draftRouteItemsText ?? this.draftRouteItemsText,
      selectedImagePath:
          clearSelectedImagePath ? null : (selectedImagePath ?? this.selectedImagePath),
      validatedImage: clearValidatedImage ? null : (validatedImage ?? this.validatedImage),
      uploadedImageUrl:
          clearUploadedImageUrl ? null : (uploadedImageUrl ?? this.uploadedImageUrl),
      uploadProgress: clearUploadProgress ? null : (uploadProgress ?? this.uploadProgress),
      saveSuccessCount: saveSuccessCount ?? this.saveSuccessCount,
    );
  }
}
