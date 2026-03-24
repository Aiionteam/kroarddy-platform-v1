import "dart:async";
import "dart:io";

import "package:dio/dio.dart";
import "package:exif/exif.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../data/tourstar_models.dart";
import "../../data/tourstar_repository.dart";
import "tourstar_state.dart";

// ignore_for_file: avoid_catches_without_on_clauses

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
    if (files.isEmpty) return;
    state = state.copyWith(
      pickedFiles: files,
      filteredPickedFiles: files,
      clearDateFilter: true,
      statusMessage: "${files.length}장을 선택했습니다. 촬영일 확인중...",
      clearGeneratedPost: true,
    );

    await _summarizeShotDates(files);
    await uploadAndAnalyze(autoGenerateComment: true);
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

  Future<void> uploadAndAnalyze({bool autoGenerateComment = false}) async {
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

      if (autoGenerateComment && defaults.isNotEmpty) {
        await _generateAutoCommentInternal(defaults.toList());
      }
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
    await _generateAutoCommentInternal(paths);
    state = state.copyWith(loading: false);
  }

  Future<void> _generateAutoCommentInternal(List<String> paths) async {
    try {
      final auto = await _repo.autoComment(imagePaths: paths, maxImages: 3);
      final nextComment = auto.comment.trim();
      if (nextComment.isNotEmpty) {
        state = state.copyWith(comment: nextComment, statusMessage: "자동 코멘트 초안 생성 완료");
      } else {
        state = state.copyWith(statusMessage: "자동 코멘트 결과가 비어 있습니다.");
      }
    } catch (e) {
      state = state.copyWith(statusMessage: "자동 코멘트 오류: $e");
    }
  }

  // ── 서버 게시글 목록 불러오기 ─────────────────────────────────
  Future<void> loadPosts() async {
    state = state.copyWith(postsLoading: true);
    try {
      final posts = await _repo.listPosts();
      state = state.copyWith(serverPosts: posts, postsLoading: false);
    } catch (e) {
      state = state.copyWith(postsLoading: false);
    }
  }

  // ── 서버 게시글 저장 ──────────────────────────────────────────
  Future<void> savePost({
    required String title,
    required String location,
    required String comment,
    required String visibility,
    required List<String> tags,
    required List<String> imagePaths,
    Map<String, dynamic>? selectedScores,
  }) async {
    state = state.copyWith(loading: true, statusMessage: "게시글을 저장하는 중...");
    try {
      final created = await _repo.createPost(
        title: title,
        location: location,
        comment: comment,
        visibility: visibility,
        tags: tags,
        imagePaths: imagePaths,
        selectedScores: selectedScores,
      );
      state = state.copyWith(
        serverPosts: [created, ...state.serverPosts],
        statusMessage: "게시글이 저장되었습니다.",
      );
    } catch (e) {
      state = state.copyWith(statusMessage: "게시글 저장 오류: $e");
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  // ── 댓글 등록 ─────────────────────────────────────────────────
  Future<void> addComment(String postId, String content) async {
    try {
      final comment = await _repo.createComment(postId: postId, content: content);
      final updated = state.serverPosts.map((p) {
        if (p.id != postId) return p;
        return TourstarPostRecord(
          id: p.id,
          userId: p.userId,
          title: p.title,
          location: p.location,
          comment: p.comment,
          visibility: p.visibility,
          tags: p.tags,
          photoUrls: p.photoUrls,
          selectedScores: p.selectedScores,
          comments: [...p.comments, comment],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        );
      }).toList();
      state = state.copyWith(serverPosts: updated);
    } catch (_) {}
  }

  // ── 딥링크 open post ID 설정/해제 ────────────────────────────
  void setOpenPostId(String id) => state = state.copyWith(openPostId: id);
  void clearOpenPostId() => state = state.copyWith(clearOpenPostId: true);

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

  /// 웹 플로우와 동일하게 "게시하기" 한 번으로:
  /// 1) MBTI 기반 게시글 생성 -> 2) 생성 결과를 DB 저장
  Future<bool> publishPost({required String visibility}) async {
    final comment = state.comment.trim();
    final paths = state.selectedImagePaths.toList();
    if (paths.isEmpty) {
      state = state.copyWith(statusMessage: "AI 랭킹에서 최소 1장을 선택해 주세요.");
      return false;
    }
    if (comment.isEmpty) {
      state = state.copyWith(statusMessage: "코멘트 초안을 입력해 주세요.");
      return false;
    }

    state = state.copyWith(loading: true, statusMessage: "게시글 생성 및 저장중...");
    try {
      final generated = await _repo.generatePost(
        comment: comment,
        styleFilter: state.styleFilter,
        imagePaths: paths,
      );
      final created = await _repo.createPost(
        title: generated.title,
        location: generated.location,
        comment: generated.comment,
        visibility: visibility,
        tags: generated.tags,
        imagePaths: paths,
      );

      state = state.copyWith(
        generatedPost: generated,
        serverPosts: [created, ...state.serverPosts],
        statusMessage: "게시글 생성 완료",
      );
      return true;
    } catch (e) {
      state = state.copyWith(statusMessage: "게시글 생성/저장 오류: $e");
      return false;
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

  Future<void> _summarizeShotDates(List<XFile> files) async {
    int known = 0;
    DateTime? minDate;
    DateTime? maxDate;
    for (final file in files) {
      final d = await _getShotDate(file);
      if (d == null) continue;
      known += 1;
      minDate = (minDate == null || d.isBefore(minDate)) ? d : minDate;
      maxDate = (maxDate == null || d.isAfter(maxDate)) ? d : maxDate;
    }
    if (known == 0) {
      state = state.copyWith(statusMessage: "촬영일 메타데이터 없음. 업로드/분석을 시작합니다...");
      return;
    }
    final range = "${minDate!.year}-${minDate.month.toString().padLeft(2, "0")}-${minDate.day.toString().padLeft(2, "0")} ~ "
        "${maxDate!.year}-${maxDate.month.toString().padLeft(2, "0")}-${maxDate.day.toString().padLeft(2, "0")}";
    state = state.copyWith(statusMessage: "촬영일 확인 완료 ($known/${files.length}장): $range");
  }
}
