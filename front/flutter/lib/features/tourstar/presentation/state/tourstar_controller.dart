import "dart:async";
import "dart:io";

import "package:dio/dio.dart";
import "package:exif/exif.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";
import "package:photo_manager/photo_manager.dart";

import "../../../../core/auth/jwt_claims.dart";
import "../../../../core/auth/token_store.dart";
import "../../../../core/network/api_client.dart";
import "../../../chat/data/friend_repository.dart";
import "../../../profile/data/profile_repository.dart";
import "../../data/tourstar_models.dart";
import "../../data/tourstar_repository.dart";
import "../../data/tourstar_schedule.dart";
import "../../../planner/data/planner_models.dart";
import "tourstar_state.dart";

// ignore_for_file: avoid_catches_without_on_clauses

final tourstarControllerProvider = NotifierProvider<TourstarController, TourstarState>(
  TourstarController.new,
);

class TourstarController extends Notifier<TourstarState> {
  final ImagePicker _picker = ImagePicker();
  final Map<String, DateTime> _shotDateCache = <String, DateTime>{};
  static const int _kMaxAutoGalleryPick = 200;

  TourstarRepository get _repo => ref.read(tourstarRepositoryProvider);
  FriendRepository get _friendRepo => ref.read(friendRepositoryProvider);
  TokenStore get _tokenStore => ref.read(tokenStoreProvider);

  @override
  TourstarState build() {
    // 초기화: 사용자 정보 + 친구 목록 + 게시물 로드
    Future.microtask(() => _init());
    return TourstarState.initial();
  }

  Future<void> _init() async {
    await _loadUserInfo();
    await Future.wait([loadPosts(), loadFriends()]);
  }

  Future<void> _loadUserInfo() async {
    try {
      final token = await _tokenStore.readAccessToken();
      if (token == null || token.isEmpty) return;
      // 게이트웨이 JWT는 app_user_id에 앱 사용자 PK를 두는 경우가 많음 — 삭제/작성자 검증과 맞춤
      final userId = getAppUserIdFromToken(token) ?? getUserIdFromToken(token);

      // 프로필 API 닉네임을 JWT claim보다 우선 (토큰 갱신 전에도 설정에서 변경한 이름 반영)
      String? nickname;
      if (userId != null) {
        try {
          final userModel = await ref.read(profileRepositoryProvider).findUserById(userId);
          nickname = userModel?.nickname?.trim();
        } catch (_) {}
      }
      if (nickname == null || nickname.isEmpty) {
        nickname = getNicknameFromToken(token)?.trim();
      }

      state = state.copyWith(myUserId: userId, myNickname: nickname);

      if (userId != null) {
        final imageUrl = await _repo.fetchProfileImage(userId);
        if (imageUrl != null && imageUrl.isNotEmpty) {
          state = state.copyWith(profileImageUrl: imageUrl);
        }
      }
    } catch (_) {}
  }

  /// 설정에서 닉네임 저장 후 호출 — 저장값·프로필 API 기준으로 반영(JWT만 믿으면 토큰 미갱신 시 구 닉네임이 남음).
  Future<void> syncNicknameFromProfile({String? savedNickname}) async {
    final token = await _tokenStore.readAccessToken();
    if (token == null || token.isEmpty) return;
    final userId = getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
    final previousNick = state.myNickname?.trim();

    String? newNick = savedNickname?.trim();
    if (newNick == null || newNick.isEmpty) {
      if (userId != null) {
        try {
          final userModel = await ref.read(profileRepositoryProvider).findUserById(userId);
          newNick = userModel?.nickname?.trim();
        } catch (_) {}
      }
      newNick ??= getNicknameFromToken(token)?.trim();
    }

    if (newNick == null || newNick.isEmpty) return;

    state = state.copyWith(myUserId: userId ?? state.myUserId, myNickname: newNick);

    if (userId != null) {
      try {
        final imageUrl = await _repo.fetchProfileImage(userId);
        if (imageUrl != null && imageUrl.isNotEmpty) {
          state = state.copyWith(profileImageUrl: imageUrl);
        }
      } catch (_) {}
    }

    final uid = state.myUserId;
    if (state.serverPosts.isEmpty) return;

    final next = <TourstarPostRecord>[];
    var changed = false;
    for (final p in state.serverPosts) {
      final auth = (p.authorNickname ?? "").trim();
      final byId = uid != null && p.userId != null && p.userId == uid;
      final byPrevNick =
          previousNick != null && previousNick.isNotEmpty && auth == previousNick;
      if (byId && auth != newNick) {
        changed = true;
        next.add(p.copyWith(authorNickname: newNick));
      } else if (!byId && byPrevNick && auth != newNick) {
        changed = true;
        next.add(p.copyWith(authorNickname: newNick));
      } else {
        next.add(p);
      }
    }
    if (changed) {
      state = state.copyWith(serverPosts: next);
    }
  }

  Future<void> loadFriends() async {
    try {
      final friends = await _friendRepo.getFriendList();
      final nicknames = friends.map((f) => f.nickname).toSet();
      state = state.copyWith(friendNicknames: nicknames);
    } catch (_) {}
  }

  Future<void> uploadProfileImage(XFile file) async {
    try {
      final userId = state.myUserId;
      final url = await _repo.uploadProfileImage(file, userId: userId);
      if (url != null && url.isNotEmpty) {
        state = state.copyWith(profileImageUrl: url);
      }
    } catch (_) {}
  }

  Future<void> pickImages() async {
    final files = await _picker.pickMultiImage();
    if (files.isEmpty) return;
    // 기간 필터는 "사진 선택 전 설정"도 가능해야 하므로 clearDateFilter 하지 않는다.
    state = state.copyWith(
      pickedFiles: files,
      filteredPickedFiles: files,
      statusMessage: "screens.tourstar.status_picked_exif_checking",
      statusMessageParams: {"count": "${files.length}"},
      clearGeneratedPost: true,
    );

    await _summarizeShotDates(files);
    // 이미 기간이 설정돼 있으면, 선택 직후 자동으로 기간 내 사진만 업로드 대상에 남긴다.
    await _applyDateFilterIfNeeded();
    await uploadAndAnalyze(autoGenerateComment: true);
  }

  /// 기간이 설정된 경우, OS 갤러리에서 해당 기간의 사진을 자동 선별해 `pickedFiles`에 채운다.
  /// - 사용자 액션(버튼 클릭)을 통해서만 실행한다(프라이버시/심사 이슈 방지).
  Future<void> autoPickFromGallery() async {
    final start = state.filterStartDate;
    final end = state.filterEndDate;
    if (start == null || end == null) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_date_filter_ready",
        clearStatusParams: true,
      );
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_checking_gallery_permission",
      clearStatusParams: true,
      clearGeneratedPost: true,
    );

    try {
      final permission = await PhotoManager.requestPermissionExtend();
      final allowed = permission.isAuth || permission == PermissionState.limited;
      if (!allowed) {
        state = state.copyWith(
          loading: false,
          statusMessage: "screens.tourstar.status_gallery_permission_denied",
          clearStatusParams: true,
        );
        return;
      }

      final filter = FilterOptionGroup()
        ..addOrderOption(const OrderOption(type: OrderOptionType.createDate, asc: false))
        ..setOption(
          AssetType.image,
          const FilterOption(),
        );
      // NOTE:
      // - photo_manager의 createTimeCond는 플랫폼/제조사에 따라 "촬영일"이 아닌 "미디어 DB 추가/생성일"에
      //   가깝게 동작할 수 있다(예: 카카오톡으로 받은 과거 촬영 사진을 오늘 저장한 경우).
      // - 그래서 1차로는 createTimeCond로 빠르게 후보를 줄이되, 비어 있으면 All 앨범을 최근순 스캔하며
      //   EXIF 촬영일(없으면 lastModified)로 기간을 재필터링하는 폴백을 사용한다.
      filter.createTimeCond = DateTimeCond(min: start, max: end);

      List<AssetPathEntity> paths = await PhotoManager.getAssetPathList(
        type: RequestType.image,
        hasAll: true,
        filterOption: filter,
      );
      final prefilteredEmpty = paths.isEmpty;
      if (prefilteredEmpty) {
        // createTimeCond로는 못 잡는 케이스(외부에서 받은 사진 등)를 위해 전체(All)에서 EXIF 기준으로 스캔한다.
        final fallbackFilter = FilterOptionGroup()
          ..addOrderOption(const OrderOption(type: OrderOptionType.createDate, asc: false))
          ..setOption(
            AssetType.image,
            const FilterOption(),
          );
        paths = await PhotoManager.getAssetPathList(
          type: RequestType.image,
          hasAll: true,
          filterOption: fallbackFilter,
        );
      }
      if (paths.isEmpty) {
        state = state.copyWith(
          loading: false,
          pickedFiles: <XFile>[],
          filteredPickedFiles: <XFile>[],
          statusMessage: "screens.tourstar.status_no_photos_in_range",
          clearStatusParams: true,
        );
        return;
      }

      // hasAll=true일 때는 "전체(All/Recent)" 앨범이 포함되며,
      // 이를 포함해 여러 앨범을 순회하면 동일 자산이 중복될 수 있다.
      // 기간 조건은 filter(createTimeCond)로 이미 걸려 있으므로, All 앨범 1개만 사용한다.
      final all = paths.first;
      final picked = <XFile>[];
      final seenIds = <String>{};
      if (!prefilteredEmpty) {
        // 1차(빠른 경로): createTimeCond로 후보가 잡힌 경우엔 그대로 상위 N장만 사용.
        final assets = await all.getAssetListPaged(page: 0, size: _kMaxAutoGalleryPick);
        for (final asset in assets) {
          final id = asset.id;
          if (id.isNotEmpty && seenIds.contains(id)) continue;
          if (id.isNotEmpty) seenIds.add(id);
          final file = await asset.file;
          if (file == null) continue;
          picked.add(XFile(file.path));
        }
      } else {
        // 폴백(정확 경로): All 앨범을 최근순으로 스캔하며 EXIF 촬영일 기준으로 기간 필터링.
        // - 너무 많은 사진을 읽지 않도록 스캔 상한을 둔다.
        const int maxScan = 2000; // 실사용에서 안전한 상한(성능/배터리)
        const int pageSize = 200;
        int scanned = 0;
        int page = 0;
        while (picked.length < _kMaxAutoGalleryPick && scanned < maxScan) {
          final assets = await all.getAssetListPaged(page: page, size: pageSize);
          if (assets.isEmpty) break;
          page += 1;
          for (final asset in assets) {
            if (picked.length >= _kMaxAutoGalleryPick || scanned >= maxScan) break;
            scanned += 1;
            final id = asset.id;
            if (id.isNotEmpty && seenIds.contains(id)) continue;
            if (id.isNotEmpty) seenIds.add(id);
            final file = await asset.file;
            if (file == null) continue;

            final x = XFile(file.path);
            final shotAt = await _getShotDate(x);
            if (shotAt == null) {
              if (state.includeUnknownShotDate) picked.add(x);
              continue;
            }
            if (!shotAt.isBefore(start) && !shotAt.isAfter(end)) {
              picked.add(x);
            }
          }
        }
      }

      if (picked.isEmpty) {
        state = state.copyWith(
          loading: false,
          pickedFiles: <XFile>[],
          filteredPickedFiles: <XFile>[],
          statusMessage: "screens.tourstar.status_no_photos_in_range",
          clearStatusParams: true,
        );
        return;
      }

      state = state.copyWith(
        pickedFiles: picked,
        filteredPickedFiles: picked, // 이미 기간 조건으로 가져온 목록이므로 동일
        statusMessage: "screens.tourstar.status_gallery_autopick_done",
        statusMessageParams: {"count": "${picked.length}"},
        clearGeneratedPost: true,
      );

      await _summarizeShotDates(picked);
      await _applyDateFilterIfNeeded();
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_gallery_autopick_error",
        statusMessageParams: {"error": "$e"},
      );
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> openGallerySettings() async {
    try {
      await PhotoManager.openSetting();
    } catch (_) {}
  }

  /// "원터치" 동작: 기간 사진 자동 선별 -> 바로 업로드/AI 분석까지 수행한다.
  Future<void> autoPickAndUploadFromGallery() async {
    await autoPickFromGallery();
    if (state.pickedFiles.isEmpty) return;
    await uploadAndAnalyze(autoGenerateComment: true);
  }

  Future<void> setIncludeUnknownShotDate(bool value) async {
    state = state.copyWith(includeUnknownShotDate: value);
    await _applyDateFilterIfNeeded();
  }

  Future<void> setDateRange(DateTime start, DateTime end) async {
    final rangeStart = DateTime(start.year, start.month, start.day);
    final rangeEnd = DateTime(end.year, end.month, end.day, 23, 59, 59);
    state = state.copyWith(
      filterStartDate: rangeStart,
      filterEndDate: rangeEnd,
      clearGeneratedPost: true,
    );
    await _applyDateFilterIfNeeded();
  }

  void clearDateRange() {
    state = state.copyWith(
      clearDateFilter: true,
      filteredPickedFiles: state.pickedFiles,
      statusMessage: "screens.tourstar.status_date_filter_cleared",
      clearStatusParams: true,
      clearGeneratedPost: true,
    );
  }

  void setStyleFilter(String value) {
    state = state.copyWith(styleFilter: value);
  }

  void setComment(String value) {
    state = state.copyWith(comment: value);
  }

  void setAttachedScheduleFromTravelPlan(TravelPlanRecord plan) {
    state = state.copyWith(
      attachedScheduleSnapshot: attachedScheduleFromTravelPlan(plan),
    );
  }

  void clearAttachedSchedule() {
    state = state.copyWith(clearAttachedSchedule: true);
  }

  /// 새 기록 시트를 열 때만 호출한다. 로그인 ID·피드·친구 등은 유지하고 작성용 필드만 비운다.
  /// (기존: initial()로 전체 초기화 → myUserId 소실로 게시물이 익명 저장되고 목록이 비는 버그)
  void reset() {
    state = state.copyWith(
      loading: false,
      statusMessage: "screens.tourstar.status_hint_select_upload",
      clearStatusParams: true,
      styleFilter: "AUTO",
      comment: "",
      pickedFiles: <XFile>[],
      filteredPickedFiles: <XFile>[],
      clearDateFilter: true,
      rankedImages: <RankedImage>[],
      selectedImagePaths: <String>{},
      clearGeneratedPost: true,
      clearAttachedSchedule: true,
    );
    _shotDateCache.clear();
  }

  /// 게시 직전 토큰에서 다시 ID/닉네임을 읽어 state에 반영한다.
  Future<bool> ensureIdentityForAuthoring() async {
    final token = await _tokenStore.readAccessToken();
    if (token == null || token.isEmpty) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_need_login",
        clearStatusParams: true,
      );
      return false;
    }
    final userId = getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
    if (userId == null) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_cannot_resolve_user",
        clearStatusParams: true,
      );
      return false;
    }
    String? nickname;
    try {
      final userModel = await ref.read(profileRepositoryProvider).findUserById(userId);
      nickname = userModel?.nickname?.trim();
    } catch (_) {}
    if (nickname == null || nickname.isEmpty) {
      nickname = getNicknameFromToken(token)?.trim();
    }
    state = state.copyWith(myUserId: userId, myNickname: nickname);
    return true;
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
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_pick_photos_first",
        clearStatusParams: true,
      );
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_upload_analyze_start",
      clearStatusParams: true,
      clearGeneratedPost: true,
    );

    try {
      final upload = await _repo.uploadPhotos(filesToUpload);
      final jobId = upload.pipelineJob?.jobId ?? "";
      if (jobId.isEmpty) {
        throw Exception("pipeline_job.job_id가 비어 있습니다.");
      }

      state = state.copyWith(
        statusMessage: "screens.tourstar.status_upload_done_analyzing",
        clearStatusParams: true,
      );
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
        statusMessage: "screens.tourstar.status_analyze_done_ranked",
        statusMessageParams: {"count": "${ranked.length}"},
      );

      if (autoGenerateComment && defaults.isNotEmpty) {
        await _generateAutoCommentInternal(defaults.toList());
      }
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final detail = code != null
          ? "HTTP $code"
          : "${e.type.name} ${e.message ?? ""}";
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_upload_error",
        statusMessageParams: {"detail": detail},
      );
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_upload_error",
        statusMessageParams: {"detail": "$e"},
      );
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> generateAutoComment() async {
    final paths = state.selectedImagePaths.toList();
    if (paths.isEmpty) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_pick_ranked_first",
        clearStatusParams: true,
      );
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_generating_auto_comment",
      clearStatusParams: true,
    );
    await _generateAutoCommentInternal(paths);
    state = state.copyWith(loading: false);
  }

  Future<void> _generateAutoCommentInternal(List<String> paths) async {
    try {
      final auto = await _repo.autoComment(imagePaths: paths, maxImages: 3);
      final nextComment = auto.comment.trim();
      if (nextComment.isNotEmpty) {
        state = state.copyWith(
          comment: nextComment,
          statusMessage: "screens.tourstar.status_auto_comment_done",
          clearStatusParams: true,
        );
      } else {
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_auto_comment_empty",
          clearStatusParams: true,
        );
      }
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_auto_comment_error",
        statusMessageParams: {"error": "$e"},
      );
    }
  }

  // ── 서버 게시글 목록 불러오기 ─────────────────────────────────
  Future<void> loadPosts() async {
    state = state.copyWith(postsLoading: true);
    try {
      final posts = await _repo.listPosts(viewerUserId: state.myUserId);
      final liked = <String>{...state.likedPostIds};
      for (final p in posts) {
        if (p.liked || p.honorVote == 1) liked.add(p.id);
      }
      state = state.copyWith(serverPosts: posts, likedPostIds: liked, postsLoading: false);
    } catch (e) {
      state = state.copyWith(postsLoading: false);
    }
  }

  // ── 게시글 수정 ─────────────────────────────────────────────
  Future<bool> updatePost({
    required String postId,
    String? title,
    String? location,
    String? comment,
    String? visibility,
    List<String>? tags,
    List<String>? keepPhotoUrls,
    List<String>? newImagePaths,
  }) async {
    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_editing_post",
      clearStatusParams: true,
    );
    try {
      final updated = await _repo.updatePost(
        postId: postId,
        title: title,
        location: location,
        comment: comment,
        visibility: visibility,
        tags: tags,
        keepPhotoUrls: keepPhotoUrls,
        newImagePaths: newImagePaths,
      );
      final posts = state.serverPosts.map((p) => p.id == postId ? updated : p).toList();
      state = state.copyWith(
        serverPosts: posts,
        statusMessage: "screens.tourstar.status_post_updated",
        clearStatusParams: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_post_update_error",
        statusMessageParams: {"error": "$e"},
      );
      return false;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  // ── 게시글 삭제 ─────────────────────────────────────────────
  Future<bool> deletePost(String postId) async {
    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_deleting_post",
      clearStatusParams: true,
    );
    if (!await ensureIdentityForAuthoring()) {
      state = state.copyWith(loading: false);
      return false;
    }
    final userId = state.myUserId!;
    try {
      await _repo.deletePost(postId: postId, userId: userId);
      final posts = state.serverPosts.where((p) => p.id != postId).toList();
      state = state.copyWith(
        serverPosts: posts,
        statusMessage: "screens.tourstar.status_post_deleted",
        clearStatusParams: true,
      );
      return true;
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final detail = e.response?.data?.toString() ?? "";
      if (code == 403) {
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_delete_forbidden",
          clearStatusParams: true,
        );
      } else {
        final d =
            "${code != null ? "(HTTP $code) " : ""}${detail.isNotEmpty ? detail : (e.message ?? e)}";
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_post_delete_error",
          statusMessageParams: {"detail": d},
        );
      }
      return false;
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_post_delete_error",
        statusMessageParams: {"detail": "$e"},
      );
      return false;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  // ── 스크랩(북마크) 토글 ────────────────────────────────────
  void toggleBookmark(String postId) {
    final posts = state.serverPosts.map((p) {
      if (p.id != postId) return p;
      return p.copyWith(bookmarked: !p.bookmarked);
    }).toList();
    state = state.copyWith(serverPosts: posts);
  }

  bool _isOwnerPost(TourstarPostRecord p) {
    if (state.myUserId != null && p.userId != null) return p.userId == state.myUserId;
    final mn = (state.myNickname ?? "").trim();
    if (mn.isNotEmpty && (p.authorNickname ?? "").trim() == mn) return true;
    return false;
  }

  /// 명예 투표: [value]는 1(썸업) 또는 -1(썸다운)
  void voteHonor(String postId, int value) {
    if (value != 1 && value != -1) return;
    Future.microtask(() async {
      if (!await ensureIdentityForAuthoring()) return;
      final userId = state.myUserId!;
      final target = state.serverPosts.where((p) => p.id == postId).firstOrNull;
      if (target != null && _isOwnerPost(target)) {
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_cannot_vote_own",
          clearStatusParams: true,
        );
        return;
      }
      try {
        final res = await _repo.voteHonor(postId: postId, userId: userId, value: value);
        final likedIds = <String>{...state.likedPostIds};
        if (res.liked) {
          likedIds.add(postId);
        } else {
          likedIds.remove(postId);
        }
        final posts = state.serverPosts.map((p) {
          if (p.id != postId) return p;
          return p.copyWith(
            likes: res.likes,
            liked: res.liked,
            honorUp: res.honorUp,
            honorDown: res.honorDown,
            honorVote: res.honorVote,
          );
        }).toList();
        state = state.copyWith(serverPosts: posts, likedPostIds: likedIds);
      } on DioException catch (e) {
        final code = e.response?.statusCode;
        final body = e.response?.data?.toString() ?? "";
        if (code == 400 || body.contains("본인")) {
          state = state.copyWith(
            statusMessage: "screens.tourstar.status_cannot_vote_own",
            clearStatusParams: true,
          );
          return;
        }
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_honor_vote_error",
          statusMessageParams: {"error": "$e"},
        );
      } catch (e) {
        state = state.copyWith(
          statusMessage: "screens.tourstar.status_honor_vote_error",
          statusMessageParams: {"error": "$e"},
        );
      }
    });
  }

  /// 딥링크 등으로 목록에 없는 글을 합침
  void mergeServerPost(TourstarPostRecord post) {
    final exists = state.serverPosts.any((p) => p.id == post.id);
    final likedIds = <String>{...state.likedPostIds};
    if (post.liked) likedIds.add(post.id);
    if (!exists) {
      state = state.copyWith(
        serverPosts: [post, ...state.serverPosts],
        likedPostIds: likedIds,
      );
    } else {
      state = state.copyWith(
        serverPosts: state.serverPosts.map((p) => p.id == post.id ? post : p).toList(),
        likedPostIds: likedIds,
      );
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
    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_saving_post",
      clearStatusParams: true,
    );
    if (!await ensureIdentityForAuthoring()) {
      state = state.copyWith(loading: false);
      return;
    }
    final userId = state.myUserId!;
    try {
      final created = await _repo.createPost(
        title: title,
        location: location,
        comment: comment,
        visibility: visibility,
        tags: tags,
        imagePaths: imagePaths,
        userId: userId,
        authorNickname: state.myNickname,
        selectedScores: selectedScores,
      );
      state = state.copyWith(
        serverPosts: [created, ...state.serverPosts],
        statusMessage: "screens.tourstar.status_post_saved",
        clearStatusParams: true,
      );
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_post_save_error",
        statusMessageParams: {"error": "$e"},
      );
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  // ── 댓글 등록 ─────────────────────────────────────────────────
  Future<void> addComment(String postId, String content) async {
    // 실제 닉네임으로 댓글 작성 (토큰에서 추출, 없으면 "익명")
    String author = state.myNickname ?? "익명";
    if (author.isEmpty) {
      try {
        final token = await _tokenStore.readAccessToken();
        if (token != null && token.isNotEmpty) {
          author = getNicknameFromToken(token) ?? "익명";
        }
      } catch (_) {}
    }
    try {
      final comment = await _repo.createComment(
        postId: postId,
        content: content,
        author: author,
        userId: state.myUserId,
      );
      final updated = state.serverPosts.map((p) {
        if (p.id != postId) return p;
        return p.copyWith(comments: [...p.comments, comment]);
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
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_comment_required",
        clearStatusParams: true,
      );
      return;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_mbti_generating",
      clearStatusParams: true,
    );
    try {
      final post = await _repo.generatePost(
        comment: comment,
        styleFilter: state.styleFilter,
        imagePaths: paths,
      );
      state = state.copyWith(
        generatedPost: post,
        statusMessage: "screens.tourstar.status_post_generate_done",
        clearStatusParams: true,
      );
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_post_generate_error",
        statusMessageParams: {"error": "$e"},
      );
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
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_select_ai_rank_first",
        clearStatusParams: true,
      );
      return false;
    }
    if (comment.isEmpty) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_comment_draft_required",
        clearStatusParams: true,
      );
      return false;
    }

    state = state.copyWith(
      loading: true,
      statusMessage: "screens.tourstar.status_publish_generating",
      clearStatusParams: true,
    );
    if (!await ensureIdentityForAuthoring()) {
      state = state.copyWith(loading: false);
      return false;
    }
    final userId = state.myUserId!;
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
        userId: userId,
        authorNickname: state.myNickname,
        attachedSchedule: state.attachedScheduleSnapshot,
      );

      state = state.copyWith(
        generatedPost: generated,
        serverPosts: [created, ...state.serverPosts],
        statusMessage: "screens.tourstar.status_post_generate_done",
        clearStatusParams: true,
        clearAttachedSchedule: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_publish_error",
        statusMessageParams: {"error": "$e"},
      );
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

  Future<void> _applyDateFilterIfNeeded() async {
    final start = state.filterStartDate;
    final end = state.filterEndDate;
    if (start == null || end == null) {
      state = state.copyWith(filteredPickedFiles: state.pickedFiles);
      return;
    }
    if (state.pickedFiles.isEmpty) {
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_date_filter_ready",
        clearStatusParams: true,
      );
      return;
    }

    final filtered = <XFile>[];
    int unknown = 0;
    for (final file in state.pickedFiles) {
      final shotAt = await _getShotDate(file);
      if (shotAt == null) {
        unknown += 1;
        if (state.includeUnknownShotDate) filtered.add(file);
        continue;
      }
      if (!shotAt.isBefore(start) && !shotAt.isAfter(end)) {
        filtered.add(file);
      }
    }
    state = state.copyWith(
      filteredPickedFiles: filtered,
      statusMessage: "screens.tourstar.status_date_filter_applied",
      statusMessageParams: {
        "filtered": "${filtered.length}",
        "total": "${state.pickedFiles.length}",
        "unknown": "$unknown",
      },
      clearGeneratedPost: true,
    );
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
      state = state.copyWith(
        statusMessage: "screens.tourstar.status_no_exif_fallback",
        clearStatusParams: true,
      );
      return;
    }
    final range = "${minDate!.year}-${minDate.month.toString().padLeft(2, "0")}-${minDate.day.toString().padLeft(2, "0")} ~ "
        "${maxDate!.year}-${maxDate.month.toString().padLeft(2, "0")}-${maxDate.day.toString().padLeft(2, "0")}";
    state = state.copyWith(
      statusMessage: "screens.tourstar.status_shot_date_done",
      statusMessageParams: {
        "known": "$known",
        "total": "${files.length}",
        "range": range,
      },
    );
  }
}
