// ── 게시글 / 댓글 / 공유 미리보기 ──────────────────────────────

class TourstarComment {
  TourstarComment({
    required this.id,
    required this.postId,
    this.userId,
    required this.author,
    required this.content,
    required this.createdAt,
    this.authorProfileImageUrl,
  });

  final String id;
  final String postId;
  final int? userId;
  final String author;
  final String content;
  final DateTime? createdAt;
  final String? authorProfileImageUrl;

  factory TourstarComment.fromJson(Map<String, dynamic> json) {
    return TourstarComment(
      id: json["id"]?.toString() ?? "",
      postId: json["post_id"]?.toString() ?? "",
      userId: (json["user_id"] as num?)?.toInt(),
      author: json["author"]?.toString() ?? "",
      content: json["content"]?.toString() ?? "",
      createdAt: DateTime.tryParse(json["created_at"]?.toString() ?? ""),
      authorProfileImageUrl: json["author_profile_image_url"]?.toString(),
    );
  }
}

class TourstarPostRecord {
  TourstarPostRecord({
    required this.id,
    required this.title,
    required this.location,
    required this.comment,
    required this.visibility,
    required this.tags,
    required this.photoUrls,
    required this.comments,
    required this.createdAt,
    required this.updatedAt,
    this.userId,
    this.selectedScores,
    this.authorNickname,
    this.authorProfileImageUrl,
    this.likes = 0,
    this.liked = false,
    this.bookmarked = false,
  });

  final String id;
  final int? userId;
  final String title;
  final String location;
  final String comment;
  final String visibility;
  final List<String> tags;
  final List<String> photoUrls;
  final Map<String, dynamic>? selectedScores;
  final List<TourstarComment> comments;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// 게시글 작성자 닉네임 (백엔드 author_nickname 필드)
  final String? authorNickname;

  /// 게시글 작성자 프로필 이미지 URL (presigned)
  final String? authorProfileImageUrl;

  /// 좋아요 수
  final int likes;

  /// 현재 사용자가 좋아요한 여부 (서버 응답 기반, 없으면 false)
  final bool liked;

  /// 현재 사용자가 스크랩(북마크)한 여부 (클라이언트 측 관리)
  final bool bookmarked;

  factory TourstarPostRecord.fromJson(Map<String, dynamic> json) {
    final tagsRaw = (json["tags"] as List?) ?? [];
    final urlsRaw = (json["photo_urls"] as List?) ?? [];
    final commentsRaw = (json["comments"] as List?) ?? [];
    return TourstarPostRecord(
      id: json["id"]?.toString() ?? "",
      userId: (json["user_id"] as num?)?.toInt(),
      title: json["title"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      comment: json["comment"]?.toString() ?? "",
      visibility: json["visibility"]?.toString() ?? "public",
      tags: tagsRaw.map((e) => e.toString()).toList(),
      photoUrls: urlsRaw.map((e) => e.toString()).toList(),
      selectedScores: json["selected_scores"] is Map
          ? Map<String, dynamic>.from(json["selected_scores"] as Map)
          : null,
      comments: commentsRaw
          .whereType<Map>()
          .map((e) => TourstarComment.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      createdAt: DateTime.tryParse(json["created_at"]?.toString() ?? ""),
      updatedAt: DateTime.tryParse(json["updated_at"]?.toString() ?? ""),
      authorNickname: json["author_nickname"]?.toString(),
      authorProfileImageUrl: json["author_profile_image_url"]?.toString(),
      likes: (json["likes"] as num?)?.toInt() ?? 0,
      liked: json["liked"] == true,
    );
  }

  TourstarPostRecord copyWith({
    bool? bookmarked,
    List<TourstarComment>? comments,
    int? likes,
    bool? liked,
  }) {
    return TourstarPostRecord(
      id: id,
      title: title,
      location: location,
      comment: comment,
      visibility: visibility,
      tags: tags,
      photoUrls: photoUrls,
      comments: comments ?? this.comments,
      createdAt: createdAt,
      updatedAt: updatedAt,
      userId: userId,
      selectedScores: selectedScores,
      authorNickname: authorNickname,
      authorProfileImageUrl: authorProfileImageUrl,
      likes: likes ?? this.likes,
      liked: liked ?? this.liked,
      bookmarked: bookmarked ?? this.bookmarked,
    );
  }
}

class TourstarSharePreview {
  TourstarSharePreview({
    required this.id,
    required this.title,
    required this.location,
    required this.thumbnailUrl,
    required this.visibility,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String location;
  final String thumbnailUrl;
  final String visibility;
  final DateTime? createdAt;

  factory TourstarSharePreview.fromJson(Map<String, dynamic> json) {
    return TourstarSharePreview(
      id: json["id"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      thumbnailUrl: json["thumbnail_url"]?.toString() ?? "",
      visibility: json["visibility"]?.toString() ?? "public",
      createdAt: DateTime.tryParse(json["created_at"]?.toString() ?? ""),
    );
  }
}

// ── 기존 모델 ────────────────────────────────────────────────

class UploadedPhoto {
  UploadedPhoto({
    required this.name,
    required this.url,
    required this.size,
  });

  final String name;
  final String url;
  final int size;

  factory UploadedPhoto.fromJson(Map<String, dynamic> json) {
    return UploadedPhoto(
      name: json["name"]?.toString() ?? "",
      url: json["url"]?.toString() ?? "",
      size: (json["size"] as num?)?.toInt() ?? 0,
    );
  }
}

class UploadPipelineJob {
  UploadPipelineJob({
    required this.jobId,
    required this.status,
  });

  final String jobId;
  final String status;

  factory UploadPipelineJob.fromJson(Map<String, dynamic> json) {
    return UploadPipelineJob(
      jobId: json["job_id"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "",
    );
  }
}

class UploadPhotosResponse {
  UploadPhotosResponse({
    required this.uploaded,
    required this.batchDir,
    required this.pipelineJob,
  });

  final List<UploadedPhoto> uploaded;
  final String batchDir;
  final UploadPipelineJob? pipelineJob;

  factory UploadPhotosResponse.fromJson(Map<String, dynamic> json) {
    final uploadedRaw = (json["uploaded"] as List?) ?? const [];
    return UploadPhotosResponse(
      uploaded: uploadedRaw
          .whereType<Map>()
          .map((e) => UploadedPhoto.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      batchDir: json["batch_dir"]?.toString() ?? "",
      pipelineJob: json["pipeline_job"] is Map
          ? UploadPipelineJob.fromJson(Map<String, dynamic>.from(json["pipeline_job"] as Map))
          : null,
    );
  }
}

class RankedImage {
  RankedImage({
    required this.rank,
    required this.sourceImage,
    required this.finalScore,
    required this.isCandidate,
    required this.rejectReason,
  });

  final int rank;
  final String sourceImage;
  final double finalScore;
  final bool isCandidate;
  final String rejectReason;

  factory RankedImage.fromJson(Map<String, dynamic> json) {
    return RankedImage(
      rank: (json["rank"] as num?)?.toInt() ?? 0,
      sourceImage: json["source_image"]?.toString() ?? "",
      finalScore: (json["final_score"] as num?)?.toDouble() ?? 0.0,
      isCandidate: json["is_candidate"] == true,
      rejectReason: json["reject_reason"]?.toString() ?? "",
    );
  }
}

class EvaluationResult {
  EvaluationResult({
    required this.ranked,
  });

  final List<RankedImage> ranked;

  factory EvaluationResult.fromJson(Map<String, dynamic> json) {
    final rankedRaw = (json["ranked"] as List?) ?? const [];
    return EvaluationResult(
      ranked: rankedRaw
          .whereType<Map>()
          .map((e) => RankedImage.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class TourstarJobStatus {
  TourstarJobStatus({
    required this.jobId,
    required this.status,
    required this.result,
    required this.error,
  });

  final String jobId;
  final String status;
  final EvaluationResult? result;
  final String? error;

  factory TourstarJobStatus.fromJson(Map<String, dynamic> json) {
    return TourstarJobStatus(
      jobId: json["job_id"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "",
      result: json["result"] is Map
          ? EvaluationResult.fromJson(Map<String, dynamic>.from(json["result"] as Map))
          : null,
      error: json["error"]?.toString(),
    );
  }
}

class AutoCommentResponse {
  AutoCommentResponse({
    required this.comment,
    required this.locationHint,
    required this.mood,
    required this.timeOfDay,
  });

  final String comment;
  final String locationHint;
  final String mood;
  final String timeOfDay;

  factory AutoCommentResponse.fromJson(Map<String, dynamic> json) {
    return AutoCommentResponse(
      comment: json["comment"]?.toString() ?? "",
      locationHint: json["location_hint"]?.toString() ?? "",
      mood: json["mood"]?.toString() ?? "",
      timeOfDay: json["time_of_day"]?.toString() ?? "",
    );
  }
}

class GeneratePostResponse {
  GeneratePostResponse({
    required this.title,
    required this.location,
    required this.comment,
    required this.tags,
  });

  final String title;
  final String location;
  final String comment;
  final List<String> tags;

  factory GeneratePostResponse.fromJson(Map<String, dynamic> json) {
    final tagsRaw = (json["tags"] as List?) ?? const [];
    return GeneratePostResponse(
      title: json["title"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      comment: json["comment"]?.toString() ?? "",
      tags: tagsRaw.map((e) => e.toString()).toList(),
    );
  }
}
