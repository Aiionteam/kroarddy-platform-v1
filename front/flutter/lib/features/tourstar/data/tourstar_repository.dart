import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/config/app_env.dart";
import "../../../core/network/api_client.dart";
import "tourstar_models.dart";

final tourstarRepositoryProvider = Provider<TourstarRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return TourstarRepository(dio);
});

class TourstarRepository {
  TourstarRepository(this._dio);

  final Dio _dio;

  static String _trimTrailingSlash(String v) => v.replaceAll(RegExp(r"/+$"), "");

  /// 웹의 `localArtifactPathToUrl`와 같은 역할.
  /// 백엔드가 주는 로컬/상대 경로를 게이트웨이 URL로 변환한다.
  static String toDisplayImageUrl(String pathOrUrl) {
    if (pathOrUrl.trim().isEmpty) return "";
    if (RegExp(r"^https?://", caseSensitive: false).hasMatch(pathOrUrl)) {
      return pathOrUrl;
    }

    final base = _trimTrailingSlash(AppEnv.apiBaseUrl); // e.g. https://api.../api
    final normalized = pathOrUrl.replaceAll("\\", "/");

    if (normalized.startsWith("/tourstar-files/")) {
      return "$base$normalized";
    }

    const marker = "/artifacts/";
    final lower = normalized.toLowerCase();
    final markerIdx = lower.indexOf(marker);
    if (markerIdx >= 0) {
      final tail = normalized.substring(markerIdx + marker.length);
      return "$base/tourstar-files/$tail";
    }

    final trimmed = normalized.replaceFirst(RegExp(r"^/+"), "");
    return "$base/tourstar-files/$trimmed";
  }

  String _fileNameFromPath(String path) {
    final normalized = path.replaceAll("\\", "/");
    final parts = normalized.split("/");
    return parts.isEmpty ? "upload.jpg" : parts.last;
  }

  Future<UploadPhotosResponse> uploadPhotos(List<XFile> files) async {
    final formData = FormData();
    for (final file in files) {
      formData.files.add(
        MapEntry(
          "files",
          await MultipartFile.fromFile(
            file.path,
            filename: _fileNameFromPath(file.path),
          ),
        ),
      );
    }

    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/uploads",
      data: formData,
      options: Options(
        contentType: "multipart/form-data",
        sendTimeout: const Duration(minutes: 3),
        receiveTimeout: const Duration(minutes: 3),
      ),
    );

    return UploadPhotosResponse.fromJson(res.data ?? const {});
  }

  Future<TourstarJobStatus> getJobStatus(String jobId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/photo-selection/jobs/$jobId",
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return TourstarJobStatus.fromJson(res.data ?? const {});
  }

  Future<AutoCommentResponse> autoComment({
    required List<String> imagePaths,
    int maxImages = 3,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/auto-comment",
      data: {
        "image_paths": imagePaths,
        "max_images": maxImages,
      },
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return AutoCommentResponse.fromJson(res.data ?? const {});
  }

  Future<GeneratePostResponse> generatePost({
    required String comment,
    required String styleFilter,
    String styleTemplate = "",
    required List<String> imagePaths,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/generate-post",
      data: {
        "comment": comment,
        "style_filter": styleFilter,
        "style_template": styleTemplate.trim().isEmpty ? null : styleTemplate.trim(),
        "image_paths": imagePaths,
      },
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return GeneratePostResponse.fromJson(res.data ?? const {});
  }

  // ── 게시글 목록 조회 ────────────────────────────────────────
  Future<List<TourstarPostRecord>> listPosts() async {
    final res = await _dio.get<List<dynamic>>(
      "/v1/photo-selection/posts",
      options: Options(receiveTimeout: const Duration(minutes: 1)),
    );
    final raw = res.data ?? const [];
    return raw
        .whereType<Map>()
        .map((e) => TourstarPostRecord.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  // ── 게시글 생성 (S3 업로드 + Neon 저장은 백엔드 처리) ──────
  Future<TourstarPostRecord> createPost({
    required String title,
    required String location,
    required String comment,
    required String visibility,
    required List<String> tags,
    required List<String> imagePaths,
    int? userId,
    Map<String, dynamic>? selectedScores,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/posts",
      data: {
        "title": title,
        "location": location,
        "comment": comment,
        "visibility": visibility,
        "tags": tags,
        "image_paths": imagePaths,
        if (userId != null) "user_id": userId,
        if (selectedScores != null) "selected_scores": selectedScores,
      },
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return TourstarPostRecord.fromJson(res.data ?? const {});
  }

  // ── 댓글 등록 ─────────────────────────────────────────────
  Future<TourstarComment> createComment({
    required String postId,
    required String content,
    String author = "me",
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/posts/$postId/comments",
      data: {"author": author, "content": content},
      options: Options(receiveTimeout: const Duration(minutes: 1)),
    );
    return TourstarComment.fromJson(res.data ?? const {});
  }

  // ── 공유 미리보기 ──────────────────────────────────────────
  Future<TourstarSharePreview> getSharePreview(String postId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/photo-selection/posts/$postId/share-preview",
      options: Options(receiveTimeout: const Duration(minutes: 1)),
    );
    return TourstarSharePreview.fromJson(res.data ?? const {});
  }

  // ── 공유 URL 생성 ──────────────────────────────────────────
  static String buildShareUrl(String postId) {
    return "https://web.kroaddy.site/tourstar?postId=${Uri.encodeComponent(postId)}";
  }
}
