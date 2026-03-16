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
