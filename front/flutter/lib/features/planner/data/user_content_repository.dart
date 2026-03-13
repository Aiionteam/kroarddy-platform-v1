import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/network/api_client.dart";
import "user_content_models.dart";

final userContentRepositoryProvider = Provider<UserContentRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return UserContentRepository(dio);
});

class UserContentRepository {
  UserContentRepository(this._dio);

  final Dio _dio;

  Future<ValidateImageResult> validateImageAndGetUploadUrl(XFile file) async {
    final formData = FormData.fromMap({
      "file": await MultipartFile.fromFile(
        file.path,
        filename: file.name.isEmpty ? "upload.jpg" : file.name,
      ),
    });

    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/user-content/validate-image",
      data: formData,
      options: Options(contentType: "multipart/form-data"),
    );
    return ValidateImageResult.fromJson(res.data ?? const {});
  }

  Future<void> uploadImageToS3({
    required String uploadUrl,
    required XFile file,
    ProgressCallback? onSendProgress,
  }) async {
    final bytes = await file.readAsBytes();
    final contentType = _guessContentType(file.name);
    final raw = Dio();
    await raw.put<dynamic>(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {"Content-Type": contentType},
      ),
      onSendProgress: onSendProgress,
    );
  }

  String _guessContentType(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }

  Future<List<UserRoute>> fetchRoutes({
    int limit = 20,
    int offset = 0,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      "/v1/user-content/routes",
      queryParameters: {
        "limit": limit,
        "offset": offset,
      },
    );
    final routesRaw = (res.data?["routes"] as List?) ?? const [];
    return routesRaw
        .whereType<Map>()
        .map((e) => UserRoute.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<PolishResponse> polishRoute({
    required String title,
    required String location,
    required String description,
    required List<RouteItemInput> routeItems,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/user-content/routes/polish",
      data: {
        "title": title,
        "location": location,
        "description": description,
        "route_items": routeItems.map((e) => e.toJson()).toList(),
      },
    );
    return PolishResponse.fromJson(res.data ?? const {});
  }

  Future<UserRoute> saveRoute({
    int? userId,
    required String title,
    required String location,
    required String description,
    required List<PolishedRouteItem> routeItems,
    required List<String> tags,
    String? imageUrl,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/user-content/routes",
      data: {
        "user_id": userId,
        "title": title,
        "location": location,
        "description": description,
        "route_items": routeItems.map((e) => e.toJson()).toList(),
        "tags": tags,
        "image_url": imageUrl,
      },
    );
    return UserRoute.fromJson(res.data ?? const {});
  }

  Future<int> likeRoute(int routeId) async {
    final res = await _dio.post<Map<String, dynamic>>("/v1/user-content/routes/$routeId/like");
    return (res.data?["likes"] as num?)?.toInt() ?? 0;
  }
}
