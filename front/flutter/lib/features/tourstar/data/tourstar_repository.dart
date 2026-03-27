import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/config/app_env.dart";
import "../../../core/network/api_client.dart";
import "tourstar_models.dart";

/// Tourstar FastAPI base URL (게이트웨이가 아닌 tourstar 서비스 직접 호출)
const _kTourstarBaseUrl = "https://tourstar.kroaddy.site";

final tourstarRepositoryProvider = Provider<TourstarRepository>((ref) {
  final dio = ref.watch(dioProvider);
  // Tourstar 전용 Dio (presigned URL / S3 등 tourstar 서비스 직접 호출용)
  final tourstarDio = Dio(
    BaseOptions(
      baseUrl: _kTourstarBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(minutes: 2),
      sendTimeout: const Duration(minutes: 3),
    ),
  );
  return TourstarRepository(dio, tourstarDio);
});

class TourstarRepository {
  TourstarRepository(this._dio, this._tourstarDio);

  final Dio _dio;

  /// tourstar.kroaddy.site 직접 호출용 (프로필 이미지 업로드 등)
  final Dio _tourstarDio;

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

  // ── 게시글 수정 ────────────────────────────────────────────
  Future<TourstarPostRecord> updatePost({
    required String postId,
    String? title,
    String? location,
    String? comment,
    String? visibility,
    List<String>? tags,
    List<String>? keepPhotoUrls,
    List<String>? newImagePaths,
  }) async {
    final data = <String, dynamic>{};
    if (title != null) data["title"] = title;
    if (location != null) data["location"] = location;
    if (comment != null) data["comment"] = comment;
    if (visibility != null) data["visibility"] = visibility;
    if (tags != null) data["tags"] = tags;
    if (keepPhotoUrls != null) data["keep_photo_urls"] = keepPhotoUrls;
    if (newImagePaths != null) data["image_paths"] = newImagePaths;

    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        "/v1/photo-selection/posts/$postId",
        data: data,
        options: Options(receiveTimeout: const Duration(minutes: 2)),
      );
      return TourstarPostRecord.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      if (e.response?.statusCode == 405) {
        // PATCH 미지원 폴백 → POST /update
        final res = await _dio.post<Map<String, dynamic>>(
          "/v1/photo-selection/posts/$postId/update",
          data: data,
          options: Options(receiveTimeout: const Duration(minutes: 2)),
        );
        return TourstarPostRecord.fromJson(res.data ?? const {});
      }
      rethrow;
    }
  }

  // ── 게시글 삭제 ────────────────────────────────────────────
  Future<void> deletePost({required String postId, required int userId}) async {
    try {
      await _dio.delete<void>(
        "/v1/photo-selection/posts/$postId",
        queryParameters: {"user_id": userId},
        options: Options(receiveTimeout: const Duration(minutes: 1)),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 405) {
        // DELETE 미지원 폴백 → POST /delete
        await _dio.post<void>(
          "/v1/photo-selection/posts/$postId/delete",
          data: {"user_id": userId},
          options: Options(receiveTimeout: const Duration(minutes: 1)),
        );
        return;
      }
      rethrow;
    }
  }

  // ── S3 finalize (임시 경로 → S3 URL 변환) ──────────────────
  Future<List<String>> finalizeUploads(List<String> imagePaths) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/photo-selection/finalize-uploads",
      data: {"image_paths": imagePaths},
      options: Options(receiveTimeout: const Duration(minutes: 3)),
    );
    final raw = (res.data?["s3_urls"] as List?) ?? const [];
    return raw.map((e) => e.toString()).toList();
  }

  // ── 프로필 이미지 조회 ─────────────────────────────────────
  Future<String?> fetchProfileImage(int userId) async {
    try {
      final res = await _tourstarDio.get<Map<String, dynamic>>(
        "/api/v1/photo-selection/profile-image",
        queryParameters: {"user_id": userId},
        options: Options(receiveTimeout: const Duration(minutes: 1)),
      );
      return res.data?["profile_image_url"]?.toString();
    } catch (_) {
      return null;
    }
  }

  // ── 프로필 이미지 업로드 ───────────────────────────────────
  Future<String?> uploadProfileImage(XFile file, {int? userId}) async {
    final formData = FormData.fromMap({
      "file": await MultipartFile.fromFile(
        file.path,
        filename: _fileNameFromPath(file.path),
      ),
    });
    final res = await _tourstarDio.post<Map<String, dynamic>>(
      "/api/v1/photo-selection/upload-profile-image",
      data: formData,
      queryParameters: userId != null ? {"user_id": userId} : null,
      options: Options(
        contentType: "multipart/form-data",
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
    return res.data?["profile_image_url"]?.toString();
  }

  // ── 댓글 등록 ─────────────────────────────────────────────
  Future<TourstarComment> createComment({
    required String postId,
    required String content,
    String author = "익명",
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
