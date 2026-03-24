import "package:image_picker/image_picker.dart";

import "../../data/tourstar_models.dart";

class TourstarState {
  const TourstarState({
    required this.loading,
    required this.statusMessage,
    required this.styleFilter,
    required this.comment,
    required this.pickedFiles,
    required this.filteredPickedFiles,
    required this.filterStartDate,
    required this.filterEndDate,
    required this.rankedImages,
    required this.selectedImagePaths,
    required this.generatedPost,
    required this.serverPosts,
    required this.postsLoading,
    this.openPostId,
  });

  factory TourstarState.initial() {
    return const TourstarState(
      loading: false,
      statusMessage: "사진을 선택하고 업로드를 시작하세요.",
      styleFilter: "AUTO",
      comment: "",
      pickedFiles: <XFile>[],
      filteredPickedFiles: <XFile>[],
      filterStartDate: null,
      filterEndDate: null,
      rankedImages: <RankedImage>[],
      selectedImagePaths: <String>{},
      generatedPost: null,
      serverPosts: <TourstarPostRecord>[],
      postsLoading: false,
      openPostId: null,
    );
  }

  final bool loading;
  final String statusMessage;
  final String styleFilter;
  final String comment;
  final List<XFile> pickedFiles;
  final List<XFile> filteredPickedFiles;
  final DateTime? filterStartDate;
  final DateTime? filterEndDate;
  final List<RankedImage> rankedImages;
  final Set<String> selectedImagePaths;
  final GeneratePostResponse? generatedPost;

  // ── 서버 게시글 ───────────────────────────────────────────────
  final List<TourstarPostRecord> serverPosts;
  final bool postsLoading;

  /// 딥링크로 바로 열어야 할 post ID
  final String? openPostId;

  TourstarState copyWith({
    bool? loading,
    String? statusMessage,
    String? styleFilter,
    String? comment,
    List<XFile>? pickedFiles,
    List<XFile>? filteredPickedFiles,
    DateTime? filterStartDate,
    DateTime? filterEndDate,
    List<RankedImage>? rankedImages,
    Set<String>? selectedImagePaths,
    GeneratePostResponse? generatedPost,
    bool clearGeneratedPost = false,
    bool clearDateFilter = false,
    List<TourstarPostRecord>? serverPosts,
    bool? postsLoading,
    String? openPostId,
    bool clearOpenPostId = false,
  }) {
    return TourstarState(
      loading: loading ?? this.loading,
      statusMessage: statusMessage ?? this.statusMessage,
      styleFilter: styleFilter ?? this.styleFilter,
      comment: comment ?? this.comment,
      pickedFiles: pickedFiles ?? this.pickedFiles,
      filteredPickedFiles: filteredPickedFiles ?? this.filteredPickedFiles,
      filterStartDate: clearDateFilter ? null : (filterStartDate ?? this.filterStartDate),
      filterEndDate: clearDateFilter ? null : (filterEndDate ?? this.filterEndDate),
      rankedImages: rankedImages ?? this.rankedImages,
      selectedImagePaths: selectedImagePaths ?? this.selectedImagePaths,
      generatedPost: clearGeneratedPost ? null : (generatedPost ?? this.generatedPost),
      serverPosts: serverPosts ?? this.serverPosts,
      postsLoading: postsLoading ?? this.postsLoading,
      openPostId: clearOpenPostId ? null : (openPostId ?? this.openPostId),
    );
  }
}
