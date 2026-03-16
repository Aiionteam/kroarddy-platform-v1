import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/network/api_client.dart";
import "tourstar_models.dart";

final tourstarRepositoryProvider = Provider<TourstarRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return TourstarRepository(dio);
});

class TourstarRepository {
  TourstarRepository(this._dio);

  final Dio _dio;

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
      "/api/v1/photo-selection/uploads",
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
      "/api/v1/photo-selection/jobs/$jobId",
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return TourstarJobStatus.fromJson(res.data ?? const {});
  }

  Future<AutoCommentResponse> autoComment({
    required List<String> imagePaths,
    int maxImages = 3,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/api/v1/photo-selection/auto-comment",
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
      "/api/v1/photo-selection/generate-post",
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
}
