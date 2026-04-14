import "package:image_picker/image_picker.dart";

import "../../data/tourstar_models.dart";

class TourstarState {
  const TourstarState({
    required this.loading,
    required this.statusMessage,
    this.statusMessageParams = const {},
    required this.styleFilter,
    required this.comment,
    required this.pickedFiles,
    required this.filteredPickedFiles,
    required this.filterStartDate,
    required this.filterEndDate,
    required this.includeUnknownShotDate,
    required this.rankedImages,
    required this.selectedImagePaths,
    required this.generatedPost,
    required this.serverPosts,
    required this.postsLoading,
    required this.friendNicknames,
    required this.likedPostIds,
    this.openPostId,
    this.myUserId,
    this.myNickname,
    this.profileImageUrl,
    this.attachedScheduleSnapshot,
  });

  factory TourstarState.initial() {
    return const TourstarState(
      loading: false,
      statusMessage: "screens.tourstar.status_hint_select_upload",
      statusMessageParams: {},
      styleFilter: "AUTO",
      comment: "",
      pickedFiles: <XFile>[],
      filteredPickedFiles: <XFile>[],
      filterStartDate: null,
      filterEndDate: null,
      includeUnknownShotDate: false,
      rankedImages: <RankedImage>[],
      selectedImagePaths: <String>{},
      generatedPost: null,
      serverPosts: <TourstarPostRecord>[],
      postsLoading: false,
      openPostId: null,
      myUserId: null,
      myNickname: null,
      profileImageUrl: null,
      friendNicknames: <String>{},
      likedPostIds: <String>{},
    );
  }

  final bool loading;
  final String statusMessage;
  final Map<String, String> statusMessageParams;
  final String styleFilter;
  final String comment;
  final List<XFile> pickedFiles;
  final List<XFile> filteredPickedFiles;
  final DateTime? filterStartDate;
  final DateTime? filterEndDate;
  final bool includeUnknownShotDate;
  final List<RankedImage> rankedImages;
  final Set<String> selectedImagePaths;
  final GeneratePostResponse? generatedPost;

  // ── 서버 게시글 ───────────────────────────────────────────────
  final List<TourstarPostRecord> serverPosts;
  final bool postsLoading;

  /// 딥링크로 바로 열어야 할 post ID
  final String? openPostId;

  /// 현재 로그인 사용자 ID (JWT sub)
  final int? myUserId;

  /// 현재 로그인 사용자 닉네임
  final String? myNickname;

  /// 현재 로그인 사용자 프로필 이미지 URL (presigned)
  final String? profileImageUrl;

  /// 친구 닉네임 Set (친구 게시물 필터링 & 배지 표시용)
  final Set<String> friendNicknames;

  /// 로컬에서 좋아요 누른 게시물 ID Set
  final Set<String> likedPostIds;

  /// 새 게시 작성 시 서버로 보낼 플래너 일정 스냅샷 (게시 후에는 null로 비움)
  final Map<String, dynamic>? attachedScheduleSnapshot;

  TourstarState copyWith({
    bool? loading,
    String? statusMessage,
    Map<String, String>? statusMessageParams,
    bool clearStatusParams = false,
    String? styleFilter,
    String? comment,
    List<XFile>? pickedFiles,
    List<XFile>? filteredPickedFiles,
    DateTime? filterStartDate,
    DateTime? filterEndDate,
    bool? includeUnknownShotDate,
    List<RankedImage>? rankedImages,
    Set<String>? selectedImagePaths,
    GeneratePostResponse? generatedPost,
    bool clearGeneratedPost = false,
    bool clearDateFilter = false,
    List<TourstarPostRecord>? serverPosts,
    bool? postsLoading,
    String? openPostId,
    bool clearOpenPostId = false,
    int? myUserId,
    String? myNickname,
    String? profileImageUrl,
    bool clearProfileImageUrl = false,
    Set<String>? friendNicknames,
    Set<String>? likedPostIds,
    Map<String, dynamic>? attachedScheduleSnapshot,
    bool clearAttachedSchedule = false,
  }) {
    return TourstarState(
      loading: loading ?? this.loading,
      statusMessage: statusMessage ?? this.statusMessage,
      statusMessageParams: clearStatusParams ? const {} : (statusMessageParams ?? this.statusMessageParams),
      styleFilter: styleFilter ?? this.styleFilter,
      comment: comment ?? this.comment,
      pickedFiles: pickedFiles ?? this.pickedFiles,
      filteredPickedFiles: filteredPickedFiles ?? this.filteredPickedFiles,
      filterStartDate: clearDateFilter ? null : (filterStartDate ?? this.filterStartDate),
      filterEndDate: clearDateFilter ? null : (filterEndDate ?? this.filterEndDate),
      includeUnknownShotDate: clearDateFilter ? false : (includeUnknownShotDate ?? this.includeUnknownShotDate),
      rankedImages: rankedImages ?? this.rankedImages,
      selectedImagePaths: selectedImagePaths ?? this.selectedImagePaths,
      generatedPost: clearGeneratedPost ? null : (generatedPost ?? this.generatedPost),
      serverPosts: serverPosts ?? this.serverPosts,
      postsLoading: postsLoading ?? this.postsLoading,
      openPostId: clearOpenPostId ? null : (openPostId ?? this.openPostId),
      myUserId: myUserId ?? this.myUserId,
      myNickname: myNickname ?? this.myNickname,
      profileImageUrl: clearProfileImageUrl ? null : (profileImageUrl ?? this.profileImageUrl),
      friendNicknames: friendNicknames ?? this.friendNicknames,
      likedPostIds: likedPostIds ?? this.likedPostIds,
      attachedScheduleSnapshot: clearAttachedSchedule
          ? null
          : (attachedScheduleSnapshot ?? this.attachedScheduleSnapshot),
    );
  }
}
