import "dart:async";
import "dart:io";

import "package:dio/dio.dart";
import "package:exif/exif.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../data/tourstar_models.dart";
import "../../data/tourstar_repository.dart";
import "tourstar_state.dart";

final tourstarControllerProvider = NotifierProvider<TourstarController, TourstarState>(
  TourstarController.new,
);

class TourstarController extends Notifier<TourstarState> {
  final ImagePicker _picker = ImagePicker();
  final Map<String, DateTime> _shotDateCache = <String, DateTime>{};

  TourstarRepository get _repo => ref.read(tourstarRepositoryProvider);

  @override
  TourstarState build() => TourstarState.initial();

  Future<void> pickImages() async {
    final files = await _picker.pickMultiImage();
    state = state.copyWith(
      pickedFiles: files,
      filteredPickedFiles: files,
      clearDateFilter: true,
      statusMessage: "${files.length}장을 선택했습니다.",
      clearGeneratedPost: true,
    );
  }

  Future<void> setDateRange(DateTime start, DateTime end) async {
    if (state.pickedFiles.isEmpty) {
      state = state.copyWith(statusMessage: "먼저 사진을 선택해 주세요.");
      return;
    }

    final rangeStart = DateTime(start.year, start.month, start.day);
    final rangeEnd = DateTime(end.year, end.month, end.day, 23, 59, 59);
    final filtered = <XFile>[];
    for (final file in state.pickedFiles) {
      final shotAt = await _getShotDate(file);
      if (shotAt == null) continue;
      if (!shotAt.isBefore(rangeStart) && !shotAt.isAfter(rangeEnd)) {
        filtered.add(file);
      }
    }
    state = state.copyWith(
      filterStartDate: rangeStart,
      filterEndDate: rangeEnd,
      filteredPickedFiles: filtered,
      statusMessage: "기간 필터 적용: ${filtered.length}/${state.pickedFiles.length}장",
      clearGeneratedPost: true,
    );
  }

  void clearDateRange() {
    state = state.copyWith(
      clearDateFilter: true,
      filteredPickedFiles: state.pickedFiles,
      statusMessage: "기간 필터를 해제했습니다.",
      clearGeneratedPost: true,
    );
  }

  void setStyleFilter(String value) {
    state = state.copyWith(styleFilter: value);
  }

  void setComment(String value) {
    state = state.copyWith(comment: value);
  }

  void reset() {
    state = TourstarState.initial();
    _shotDateCache.clear();
  }

  void toggleSelectedImagePath(String path, bool selected) {
    final next = <String>{...state.selectedImagePaths};
    if (selected) {
      next.add(path);
    } else {
      next.remove(path);
    }
    state = state.copyWith(selectedImagePaths: next);
  }

  Future<void> uploadAndAnalyze() async {
    final filesToUpload = _effectiveFiles();
    if (filesToUpload.isEmpty) {
      state = state.copyWith(statusMessage: "먼저 사진을 선택해 주세요.");
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "업로드 및 분석 작업을 시작합니다...",
      clearGeneratedPost: true,
    );

    try {
      final upload = await _repo.uploadPhotos(filesToUpload);
      final jobId = upload.pipelineJob?.jobId ?? "";
      if (jobId.isEmpty) {
        throw Exception("pipeline_job.job_id가 비어 있습니다.");
      }

      state = state.copyWith(statusMessage: "업로드 완료. 분석 진행 중...");
      final completed = await _pollJobUntilDone(jobId);
      final ranked = completed.result?.ranked ?? <RankedImage>[];
      final defaults = ranked
          .take(3)
          .map((e) => e.sourceImage)
          .where((e) => e.isNotEmpty)
          .toSet();

      state = state.copyWith(
        rankedImages: ranked,
        selectedImagePaths: defaults,
        statusMessage: "분석 완료: ${ranked.length}장 랭킹을 받았습니다.",
      );
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final msg = code != null
          ? "업로드/분석 오류: HTTP $code"
          : "업로드/분석 오류: ${e.type.name} ${e.message ?? ""}";
      state = state.copyWith(statusMessage: msg);
    } catch (e) {
      state = state.copyWith(statusMessage: "업로드/분석 오류: $e");
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> generateAutoComment() async {
    final paths = state.selectedImagePaths.toList();
    if (paths.isEmpty) {
      state = state.copyWith(statusMessage: "분석 이미지에서 최소 1장을 선택해 주세요.");
      return;
    }

    state = state.copyWith(loading: true, statusMessage: "자동 코멘트를 생성하는 중...");
    try {
      final auto = await _repo.autoComment(imagePaths: paths, maxImages: 3);
      state = state.copyWith(comment: auto.comment, statusMessage: "자동 코멘트 생성 완료");
    } catch (e) {
      state = state.copyWith(statusMessage: "자동 코멘트 오류: $e");
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> generatePost() async {
    final comment = state.comment.trim();
    final paths = state.selectedImagePaths.toList();
    if (comment.isEmpty) {
      state = state.copyWith(statusMessage: "코멘트를 입력해 주세요.");
      return;
    }

    state = state.copyWith(loading: true, statusMessage: "MBTI 게시글 생성 중...");
    try {
      final post = await _repo.generatePost(
        comment: comment,
        styleFilter: state.styleFilter,
        imagePaths: paths,
      );
      state = state.copyWith(
        generatedPost: post,
        statusMessage: "게시글 생성 완료",
      );
    } catch (e) {
      state = state.copyWith(statusMessage: "게시글 생성 오류: $e");
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<TourstarJobStatus> _pollJobUntilDone(String jobId) async {
    const maxAttempts = 60;
    for (int i = 0; i < maxAttempts; i++) {
      final status = await _repo.getJobStatus(jobId);
      if (status.status == "completed") return status;
      if (status.status == "failed") {
        throw Exception(status.error ?? "분석 작업이 실패했습니다.");
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    throw TimeoutException("분석 작업 대기 시간이 초과되었습니다.");
  }

  List<XFile> _effectiveFiles() {
    if (state.filterStartDate != null && state.filterEndDate != null) {
      return state.filteredPickedFiles;
    }
    return state.pickedFiles;
  }

  Future<DateTime?> _getShotDate(XFile file) async {
    final cached = _shotDateCache[file.path];
    if (cached != null) return cached;
    try {
      final bytes = await file.readAsBytes();
      final tags = await readExifFromBytes(bytes);
      final raw = tags["EXIF DateTimeOriginal"]?.printable ??
          tags["Image DateTime"]?.printable ??
          "";
      final parsed = _parseExifDate(raw);
      if (parsed != null) {
        _shotDateCache[file.path] = parsed;
        return parsed;
      }
    } catch (_) {
      // ignore
    }
    try {
      final fallback = await File(file.path).lastModified();
      _shotDateCache[file.path] = fallback;
      return fallback;
    } catch (_) {
      return null;
    }
  }

  DateTime? _parseExifDate(String raw) {
    if (raw.isEmpty) return null;
    final normalized = raw.trim();
    final match = RegExp(
      r"^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$",
    ).firstMatch(normalized);
    if (match == null) return null;
    final y = int.parse(match.group(1)!);
    final m = int.parse(match.group(2)!);
    final d = int.parse(match.group(3)!);
    final hh = int.parse(match.group(4)!);
    final mm = int.parse(match.group(5)!);
    final ss = int.parse(match.group(6)!);
    return DateTime(y, m, d, hh, mm, ss);
  }
}
