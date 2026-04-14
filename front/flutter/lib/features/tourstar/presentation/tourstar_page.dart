import "dart:io";

import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

// ignore_for_file: avoid_catches_without_on_clauses

import "../../../core/auth/jwt_claims.dart";
import "../../../core/router/main_shell.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../../chat/data/friend_repository.dart";
import "../../planner/data/planner_models.dart";
import "../../planner/data/planner_repository.dart";
import "../data/tourstar_models.dart";
import "../data/tourstar_repository.dart";
import "../data/tourstar_schedule.dart";
import "state/tourstar_controller.dart";
import "state/tourstar_state.dart";
import "tourstar_status_text.dart";
import "widgets/tourstar_attached_schedule_preview.dart";

// ── Design tokens (강조·버튼·선택: Kroaddy 남색) ─────────────────
const _kPurple = KroaddyColors.primary;
const _kPurple2 = KroaddyColors.primary;
const _kPink = Color(0xFFEC4899);
const _kPurpleLight = KroaddyColors.brandWash;
const _kGray100 = Color(0xFFF3F4F6);
const _kGray200 = Color(0xFFE5E7EB);
const _kGray300 = Color(0xFFD1D5DB);
const _kGray400 = Color(0xFF9CA3AF);
const _kGray500 = Color(0xFF6B7280);
const _kGray700 = Color(0xFF374151);
const _kGray800 = Color(0xFF1F2937);

// ── MBTI groups (labels: screens.tourstar.mbti_group_*) ───────
class _MbtiGroup {
  const _MbtiGroup(this.key, this.items);
  final String key;
  final List<String> items;
}

bool _tourstarPostHasAttachedSchedule(TourstarPostRecord post) {
  return !tourstarAttachedScheduleIsEmpty(post.attachedSchedule);
}

const _mbtiGroups = [
  _MbtiGroup("nt", ["INTJ", "INTP", "ENTJ", "ENTP"]),
  _MbtiGroup("nf", ["INFJ", "INFP", "ENFJ", "ENFP"]),
  _MbtiGroup("sj", ["ISTJ", "ISFJ", "ESTJ", "ESFJ"]),
  _MbtiGroup("sp", ["ISTP", "ISFP", "ESTP", "ESFP"]),
];

// ═════════════════════════════════════════════════════════════
class TourstarPage extends ConsumerStatefulWidget {
  const TourstarPage({
    super.key,
    this.initialPostId,
    this.initialAuthorUserId,
    this.initialAuthorName,
  });

  /// 딥링크나 채팅 카드에서 바로 열 게시글 ID
  final String? initialPostId;

  /// 유저 콘텐츠 등에서 닉네임 탭 시 — 작성자 피드로 바로 진입
  final int? initialAuthorUserId;
  final String? initialAuthorName;

  @override
  ConsumerState<TourstarPage> createState() => _TourstarPageState();
}

class _TourstarPageState extends ConsumerState<TourstarPage> {
  String _filter = "all";
  String _sortBy = "latest";   // latest | honor | comments
  String _searchQuery = "";
  bool _gridView = false;
  /// 작성자 피드 (웹과 동일: 닉네임 탭 시 해당 유저 글만)
  int? _viewAuthorUserId;
  String _viewAuthorName = "";
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _searchCtrl = TextEditingController();
  bool _friendRequestSending = false;

  bool get _authorFeedOpen => _viewAuthorName.isNotEmpty;

  bool _postMatchesAuthor(TourstarPostRecord p) {
    if (_viewAuthorName.isEmpty) return false;
    if (_viewAuthorUserId != null && p.userId != null) {
      return p.userId == _viewAuthorUserId;
    }
    return (p.authorNickname ?? "").trim() == _viewAuthorName;
  }

  bool _isSelfAuthorFeed(TourstarState s) {
    if (_viewAuthorName.isEmpty) return false;
    if (_viewAuthorUserId != null && s.myUserId != null) {
      return _viewAuthorUserId == s.myUserId;
    }
    final mn = (s.myNickname ?? "").trim();
    return mn.isNotEmpty && mn == _viewAuthorName;
  }

  /// 작성자 피드 주인이 내 친구인지 (웹 `isViewingFriend`와 동일)
  bool _isViewingFriend(TourstarState s) {
    if (!_authorFeedOpen || _isSelfAuthorFeed(s)) return false;
    final n = _viewAuthorName.trim();
    if (n.isEmpty) return false;
    return s.friendNicknames.contains(n);
  }

  Future<void> _sendFriendRequestForViewingAuthor() async {
    if (_friendRequestSending) return;
    final tourState = ref.read(tourstarControllerProvider);
    final name = _viewAuthorName.trim();
    if (name.isEmpty || _isSelfAuthorFeed(tourState) || _isViewingFriend(tourState)) return;
    final myId = tourState.myUserId;
    if (myId == null) return;
    setState(() => _friendRequestSending = true);
    final repo = ref.read(friendRepositoryProvider);
    try {
      var targetId = _viewAuthorUserId;
      targetId ??= await repo.findUserIdByNickname(name);
      if (!mounted) return;
      if (targetId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("screens.tourstar.error_author_not_found".tr(namedArgs: {"name": name}))),
        );
        return;
      }
      if (targetId == myId) return;
      final ok = await repo.sendFriendRequest(targetId);
      if (!mounted) return;
      if (ok) {
        await ref.read(tourstarControllerProvider.notifier).loadFriends();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("screens.tourstar.friend_request_sent".tr(namedArgs: {"name": name}))),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("screens.tourstar.friend_request_failed".tr())),
        );
      }
    } finally {
      if (mounted) setState(() => _friendRequestSending = false);
    }
  }

  /// 작성자 피드 헤더에 표시할 이름 — 본인 피드는 최신 `myNickname` 우선(설정에서 닉네임 변경 반영).
  String _authorFeedHeaderDisplayName(TourstarState s) {
    if (_isSelfAuthorFeed(s)) {
      final m = (s.myNickname ?? "").trim();
      if (m.isNotEmpty) return m;
    }
    return _viewAuthorName;
  }

  void _leaveAuthorFeed() {
    setState(() {
      _viewAuthorUserId = null;
      _viewAuthorName = "";
      _filter = "all";
      _gridView = false;
      _searchCtrl.clear();
      _searchQuery = "";
    });
  }

  void _openAuthorFeed(TourstarPostRecord p, TourstarState tourState) {
    final name = (p.authorNickname ?? "").trim();
    if (name.isEmpty) return;
    setState(() {
      _viewAuthorUserId = p.userId;
      _viewAuthorName = name;
      _filter = "all";
      _gridView = true;
      _searchCtrl.clear();
      _searchQuery = "";
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  bool _isMyPost(TourstarPostRecord p, TourstarState s) {
    if (s.myUserId != null && p.userId != null) return p.userId == s.myUserId;
    if ((s.myNickname ?? "").isNotEmpty) return p.authorNickname == s.myNickname;
    return false;
  }

  /// 카드·그리드에 표시할 작성자명 — 내 글이면 최신 `myNickname` 우선.
  String _displayAuthorNickname(TourstarPostRecord p, TourstarState s) {
    if (_isMyPost(p, s)) {
      final m = (s.myNickname ?? "").trim();
      if (m.isNotEmpty) return m;
    }
    return (p.authorNickname ?? "").trim();
  }

  List<TourstarPostRecord> _getFiltered(TourstarState tourState) {
    final all = tourState.serverPosts;
    List<TourstarPostRecord> result;
    if (_viewAuthorName.isNotEmpty) {
      result = all.where(_postMatchesAuthor).toList();
    } else {
      switch (_filter) {
        case "friends":
          final nicknames = tourState.friendNicknames;
          result = all.where((p) {
            final nick = p.authorNickname ?? "";
            return nick.isNotEmpty && nicknames.contains(nick);
          }).toList();
        case "mine":
          result = all.where((p) => _isMyPost(p, tourState)).toList();
        case "bookmarked":
          result = all.where((p) => p.bookmarked).toList();
        default:
          result = List<TourstarPostRecord>.from(all);
      }
    }
    // 검색 필터
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((p) =>
        (p.title.toLowerCase().contains(q)) ||
        (p.comment.toLowerCase().contains(q)) ||
        (p.location.toLowerCase().contains(q)) ||
        p.tags.any((t) => t.toLowerCase().contains(q)) ||
        (p.authorNickname ?? "").toLowerCase().contains(q),
      ).toList();
    }
    // 정렬
    switch (_sortBy) {
      case "honor":
        result.sort((a, b) => b.likes.compareTo(a.likes));
      case "comments":
        result.sort((a, b) => b.comments.length.compareTo(a.comments.length));
      default: // latest
        result.sort((a, b) {
          final at = a.createdAt ?? DateTime(2000);
          final bt = b.createdAt ?? DateTime(2000);
          return bt.compareTo(at);
        });
    }
    return result;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final id = widget.initialPostId;
      if (id != null && id.isNotEmpty) {
        var waited = 0;
        while (mounted && waited < 60) {
          final st = ref.read(tourstarControllerProvider);
          if (!st.postsLoading) break;
          await Future<void>.delayed(const Duration(milliseconds: 100));
          waited++;
        }
      } else {
        var waited = 0;
        while (mounted && waited < 60) {
          final st = ref.read(tourstarControllerProvider);
          if (!st.postsLoading) break;
          await Future<void>.delayed(const Duration(milliseconds: 100));
          waited++;
        }
      }
      if (!mounted) return;
      if (id != null && id.isNotEmpty) {
        final st = ref.read(tourstarControllerProvider);
        TourstarPostRecord? post = st.serverPosts.where((p) => p.id == id).firstOrNull;
        if (post == null) {
          try {
            final fetched = await ref.read(tourstarRepositoryProvider).fetchPost(
                  postId: id,
                  viewerUserId: st.myUserId,
                );
            ref.read(tourstarControllerProvider.notifier).mergeServerPost(fetched);
            post = fetched;
          } catch (_) {}
        }
        if (post != null && mounted) _openDetail(post);
        return;
      }
      final authorName = widget.initialAuthorName?.trim() ?? "";
      if (widget.initialAuthorUserId != null || authorName.isNotEmpty) {
        setState(() {
          _viewAuthorUserId = widget.initialAuthorUserId;
          _viewAuthorName = authorName;
          _filter = "all";
          _gridView = true;
          _searchCtrl.clear();
          _searchQuery = "";
        });
      }
    });
  }

  Future<void> _pickAndUploadProfileImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;
    await ref.read(tourstarControllerProvider.notifier).uploadProfileImage(file);
  }

  void _openDetail(TourstarPostRecord post) {
    final tourState = ref.read(tourstarControllerProvider);
    final isOwner = _isOwner(post, tourState);
    final nick = (post.authorNickname ?? "").trim();
    final effectiveImg = tourState.profileImageUrl ??
        tourState.serverPosts
            .where((p) => _isMyPost(p, tourState) && (p.authorProfileImageUrl ?? "").isNotEmpty)
            .firstOrNull?.authorProfileImageUrl;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PostDetailSheet(
        post: post,
        isOwner: isOwner,
        myNickname: tourState.myNickname,
        myProfileImageUrl: effectiveImg,
        authorProfileMap: _buildAuthorMap(tourState),
        onAddComment: (id, c) {
          ref.read(tourstarControllerProvider.notifier).addComment(id, c);
        },
        onDeletePost: (id) async {
          final ok = await ref.read(tourstarControllerProvider.notifier).deletePost(id);
          return ok;
        },
        onEditPost: (p) => _openEdit(p),
        onAuthorFeedTap: nick.isNotEmpty
            ? () {
                Navigator.pop(context);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) return;
                  _openAuthorFeed(post, ref.read(tourstarControllerProvider));
                });
              }
            : null,
      ),
    );
  }

  bool _isOwner(TourstarPostRecord post, TourstarState s) {
    if (s.myUserId != null && post.userId != null) return post.userId == s.myUserId;
    if (s.myNickname != null && post.authorNickname != null) return post.authorNickname == s.myNickname;
    return false;
  }

  /// 닉네임 → 프로필 이미지 URL 맵 (댓글 아바타용)
  Map<String, String> _buildAuthorMap(TourstarState s) {
    final map = <String, String>{};
    for (final p in s.serverPosts) {
      if ((p.authorNickname ?? "").isNotEmpty && (p.authorProfileImageUrl ?? "").isNotEmpty) {
        map[p.authorNickname!] = p.authorProfileImageUrl!;
      }
    }
    if ((s.myNickname ?? "").isNotEmpty && (s.profileImageUrl ?? "").isNotEmpty) {
      map[s.myNickname!] = s.profileImageUrl!;
    }
    return map;
  }

  void _openEdit(TourstarPostRecord post) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditPostSheet(
        post: post,
        onSave: ({
          required String title,
          required String location,
          required String comment,
          required List<String> tags,
          List<String>? keepPhotoUrls,
          List<String>? newImagePaths,
        }) async {
          final ok = await ref.read(tourstarControllerProvider.notifier).updatePost(
            postId: post.id,
            title: title,
            location: location,
            comment: comment,
            tags: tags,
            keepPhotoUrls: keepPhotoUrls,
            newImagePaths: newImagePaths,
          );
          return ok;
        },
      ),
    );
  }

  void _openCreate() {
    ref.read(tourstarControllerProvider.notifier).reset();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _CreatePostSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 상태 구독 - serverPosts / postsLoading 변화 시 rebuild
    final tourState = ref.watch(tourstarControllerProvider);
    final allPosts = tourState.serverPosts;
    final filtered = _getFiltered(tourState);
    final authorFeedHeaderName =
        _authorFeedOpen ? _authorFeedHeaderDisplayName(tourState) : "";

    // 프로필 이미지: state.profileImageUrl 없으면 내 게시물의 authorProfileImageUrl 사용
    final effectiveProfileImage = tourState.profileImageUrl ??
        allPosts.where((p) => _isMyPost(p, tourState) && (p.authorProfileImageUrl ?? "").isNotEmpty)
            .firstOrNull?.authorProfileImageUrl;

    final myPosts = allPosts.where((p) => _isMyPost(p, tourState)).toList();
    final bookmarkedPosts = allPosts.where((p) => p.bookmarked).toList();
    final friendPosts = allPosts.where((p) {
      final nick = p.authorNickname ?? "";
      return nick.isNotEmpty && tourState.friendNicknames.contains(nick);
    }).toList();
    final myLikes = myPosts.fold(0, (a, p) => a + p.likes);
    final stats = {
      "total": allPosts.length,
      "mine": myPosts.length,
      "bookmarked": bookmarkedPosts.length,
      "photos": myPosts.fold(0, (a, p) => a + p.photoUrls.length),
      "likes": myLikes,
      "friends": tourState.friendNicknames.length,
      "friendPosts": friendPosts.length,
    };

    final authorPostsForHeader =
        _authorFeedOpen ? allPosts.where(_postMatchesAuthor).toList() : <TourstarPostRecord>[];
    String? authorFeedAvatar;
    if (_authorFeedOpen) {
      if (_isSelfAuthorFeed(tourState)) {
        authorFeedAvatar = effectiveProfileImage;
      } else {
        for (final p in allPosts) {
          if (_postMatchesAuthor(p) && (p.authorProfileImageUrl ?? "").isNotEmpty) {
            authorFeedAvatar = p.authorProfileImageUrl;
            break;
          }
        }
      }
    }
    final authorFeedScrapCount = _authorFeedOpen
        ? (_isSelfAuthorFeed(tourState)
            ? bookmarkedPosts.length
            : authorPostsForHeader.where((p) => p.bookmarked).length)
        : 0;

    return Scaffold(
      backgroundColor: _kGray100,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            shadowColor: Colors.black12,
            expandedHeight: 112,
            toolbarHeight: kToolbarHeight,
            leading: IconButton(
              icon: const Icon(Icons.menu, color: _kGray800),
              onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.fromLTRB(56, 0, 16, 12),
              centerTitle: false,
              title: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    "sidebar.tourstar".tr(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _kGray800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "screens.tourstar.subtitle".tr(),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      height: 1.25,
                      fontWeight: FontWeight.normal,
                      color: _kGray400,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── 작성자 피드 프로필 (전체 피드에서는 숨김 · 웹과 동일) ──
          if (_authorFeedOpen)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                padding: const EdgeInsets.fromLTRB(12, 14, 16, 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextButton.icon(
                      onPressed: _leaveAuthorFeed,
                      icon: const Icon(Icons.arrow_back_ios_new, size: 14, color: _kGray700),
                      label: Text("screens.tourstar.back_short".tr(), style: const TextStyle(fontSize: 13, color: _kGray700)),
                      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4)),
                    ),
                    const SizedBox(width: 4),
                    if (_isSelfAuthorFeed(tourState))
                      GestureDetector(
                        onTap: _pickAndUploadProfileImage,
                        child: Stack(
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(colors: [_kPurple2, _kPink]),
                                shape: BoxShape.circle,
                              ),
                              child: ClipOval(
                                child: authorFeedAvatar != null && authorFeedAvatar.isNotEmpty
                                    ? Image.network(
                                        authorFeedAvatar,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, _, _) => Center(
                                          child: Text(
                                            authorFeedHeaderName.isNotEmpty
                                                ? authorFeedHeaderName.substring(0, 1).toUpperCase()
                                                : "T",
                                            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      )
                                    : Center(
                                        child: Text(
                                          authorFeedHeaderName.isNotEmpty
                                              ? authorFeedHeaderName.substring(0, 1).toUpperCase()
                                              : "T",
                                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                              ),
                            ),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: _kPurple,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 1.5),
                                ),
                                child: const Icon(Icons.camera_alt, size: 10, color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        width: 64,
                        height: 64,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(colors: [Color(0xFF3B82F6), _kPurple2]),
                          shape: BoxShape.circle,
                        ),
                        child: ClipOval(
                          child: authorFeedAvatar != null && authorFeedAvatar.isNotEmpty
                              ? Image.network(authorFeedAvatar, fit: BoxFit.cover)
                              : Center(
                                  child: Text(
                                    authorFeedHeaderName.isNotEmpty ? authorFeedHeaderName.substring(0, 1).toUpperCase() : "?",
                                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                                  ),
                                ),
                        ),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Text(
                                  authorFeedHeaderName.isNotEmpty ? authorFeedHeaderName : _viewAuthorName,
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _kGray800),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 2,
                                ),
                              ),
                              if (!_isSelfAuthorFeed(tourState)) ...[
                                const SizedBox(width: 6),
                                if (_isViewingFriend(tourState))
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF6FF),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFBFDBFE)),
                                    ),
                                    child: Text(
                                      "screens.tourstar.friend_badge".tr(),
                                      style: const TextStyle(fontSize: 10, color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600),
                                    ),
                                  )
                                else
                                  TextButton(
                                    onPressed: _friendRequestSending ? null : _sendFriendRequestForViewingAuthor,
                                    style: TextButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      foregroundColor: const Color(0xFF2563EB),
                                    ),
                                    child: _friendRequestSending
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : Text(
                                            "screens.tourstar.send_friend_request".tr(),
                                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                                          ),
                                  ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isSelfAuthorFeed(tourState)
                                ? "screens.tourstar.author_caption_self".tr()
                                : "screens.tourstar.author_caption_other".tr(),
                            style: const TextStyle(fontSize: 11, color: _kGray400),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _StatItem(
                                value: "${authorPostsForHeader.length}",
                                label: "screens.tourstar.stat_posts".tr(),
                                color: _kPurple,
                              ),
                              _StatItem(
                                value: "$authorFeedScrapCount",
                                label: "screens.tourstar.stat_scraps".tr(),
                                color: const Color(0xFFF59E0B),
                              ),
                              _StatItem(
                                value: "${stats['friends']}",
                                label: "screens.tourstar.stat_friends".tr(),
                                color: const Color(0xFF3B82F6),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── 검색 바 ──────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kGray200),
                ),
                child: TextField(
                  controller: _searchCtrl,
                  style: const TextStyle(fontSize: 13),
                  onChanged: (v) => setState(() => _searchQuery = v.trim()),
                  decoration: InputDecoration(
                    hintText: "screens.tourstar.search_placeholder".tr(),
                    hintStyle: const TextStyle(color: _kGray400, fontSize: 13),
                    prefixIcon: const Icon(Icons.search, size: 18, color: _kGray400),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close, size: 16, color: _kGray400),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _searchQuery = "");
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  ),
                ),
              ),
            ),
          ),

          // ── Filter Tabs + View Toggle ─────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final tab in [
                            ("all", "screens.tourstar.tab_all".tr()),
                            (
                              "mine",
                              "screens.tourstar.tab_mine_n".tr(namedArgs: {"count": "${stats['mine']}"}),
                            ),
                            (
                              "friends",
                              "screens.tourstar.tab_friends_n".tr(namedArgs: {"count": "${stats['friendPosts']}"}),
                            ),
                            (
                              "bookmarked",
                              "screens.tourstar.tab_bookmarked_n".tr(namedArgs: {"count": "${stats['bookmarked']}"}),
                            ),
                          ])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _filter = tab.$1;
                                  _viewAuthorUserId = null;
                                  _viewAuthorName = "";
                                  _gridView = false;
                                }),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: _filter == tab.$1 ? _kPurpleLight : Colors.white,
                                    border: Border.all(color: _filter == tab.$1 ? const Color(0xFFD8B4FE) : _kGray200),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    tab.$2,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: _filter == tab.$1 ? _kPurple : _kGray500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _kGray200),
                    ),
                    child: Row(
                      children: [
                        _ViewToggleBtn(icon: Icons.view_stream, active: !_gridView, onTap: () => setState(() => _gridView = false)),
                        _ViewToggleBtn(icon: Icons.grid_view, active: _gridView, onTap: () => setState(() => _gridView = true)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── 정렬 바 (최신순 / 명예순 / 댓글순) ─────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final sort in [
                      ("latest", "screens.tourstar.sort_latest".tr()),
                      ("honor", "screens.tourstar.sort_honor".tr()),
                      ("comments", "screens.tourstar.sort_comments".tr()),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: GestureDetector(
                          onTap: () => setState(() => _sortBy = sort.$1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: _sortBy == sort.$1 ? _kPurpleLight : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              sort.$2,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: _sortBy == sort.$1 ? FontWeight.w700 : FontWeight.w400,
                                color: _sortBy == sort.$1 ? _kPurple : _kGray400,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // ── Posts ────────────────────────────────────────
          if (tourState.postsLoading)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
            )
          else if (filtered.isEmpty)
            SliverToBoxAdapter(
              child: _EmptyState(onTap: _openCreate),
            )
          else if (_gridView)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _GridCard(
                    post: filtered[i],
                    onTap: () => _openDetail(filtered[i]),
                  ),
                  childCount: filtered.length,
                ),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 4,
                  crossAxisSpacing: 4,
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    final p = filtered[i];
                    final nick = (p.authorNickname ?? "").trim();
                    final isFriend = nick.isNotEmpty && tourState.friendNicknames.contains(nick);
                    final isOwner = _isOwner(p, tourState);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _FeedCard(
                        post: p,
                        isFriend: isFriend,
                        isOwner: isOwner,
                        myProfileImageUrl: effectiveProfileImage,
                        authorDisplayName: _displayAuthorNickname(p, tourState),
                        onTap: () => _openDetail(p),
                        onAuthorTap: nick.isNotEmpty ? () => _openAuthorFeed(p, tourState) : null,
                        onHonorVote: isOwner
                            ? null
                            : (v) => ref.read(tourstarControllerProvider.notifier).voteHonor(p.id, v),
                        onBookmark: () => ref.read(tourstarControllerProvider.notifier).toggleBookmark(p.id),
                        onDelete: isOwner
                            ? () async {
                                final messenger = ScaffoldMessenger.of(context);
                                final confirmed = await showDialog<bool>(
                                  context: context,
                                  builder: (dialogContext) => AlertDialog(
                                    title: Text("screens.tourstar.delete_post_title".tr()),
                                    content: Text("screens.tourstar.delete_post_confirm".tr()),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(dialogContext, false),
                                        child: Text("common.cancel".tr()),
                                      ),
                                      TextButton(
                                        onPressed: () => Navigator.pop(dialogContext, true),
                                        child: Text("common.delete".tr(), style: const TextStyle(color: Colors.red)),
                                      ),
                                    ],
                                  ),
                                );
                                if (!mounted) return;
                                if (confirmed == true) {
                                  final ok = await ref.read(tourstarControllerProvider.notifier).deletePost(p.id);
                                  if (!mounted) return;
                                  if (!ok) {
                                    final msg = ref.read(tourstarControllerProvider).statusMessage;
                                    messenger.showSnackBar(
                                      SnackBar(content: Text(msg.isNotEmpty ? msg : "screens.tourstar.delete_post_failed".tr())),
                                    );
                                  }
                                }
                              }
                            : null,
                      ),
                    );
                  },
                  childCount: filtered.length,
                ),
              ),
            ),

          // ── AI Banner ────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFF5F3FF), Color(0xFFFCE7F3)],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEDE9FE)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.auto_awesome,
                      color: _kPurple,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "screens.tourstar.ai_banner_title".tr(),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kGray800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "screens.tourstar.ai_banner_body".tr(),
                          style: const TextStyle(
                            fontSize: 11,
                            color: _kGray500,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),

      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        backgroundColor: _kPurple,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text("screens.tourstar.fab_new_post".tr()),
        elevation: 4,
      ),
    );
  }
}

// ── Stat Item ────────────────────────────────────────────────
class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.value,
    required this.label,
    this.color = _kGray800,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: _kGray400)),
      ],
    );
  }
}

// ── View Toggle Button ───────────────────────────────────────
class _ViewToggleBtn extends StatelessWidget {
  const _ViewToggleBtn({
    required this.icon,
    required this.active,
    required this.onTap,
  });
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: active ? _kPurpleLight : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 18,
          color: active ? _kPurple : _kGray400,
        ),
      ),
    );
  }
}

// ── Empty State ──────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _kGray200,
          width: 1.5,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.photo_library_outlined,
            size: 56,
            color: _kGray300,
          ),
          const SizedBox(height: 16),
          Text(
            "screens.tourstar.empty_title".tr(),
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _kGray400,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "screens.tourstar.empty_hint".tr(),
            style: const TextStyle(fontSize: 12, color: _kGray300),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 28,
                vertical: 13,
              ),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_kPurple2, _kPink],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                "screens.tourstar.empty_cta".tr(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Feed Card ────────────────────────────────────────────────
class _FeedCard extends StatelessWidget {
  const _FeedCard({
    required this.post,
    required this.onTap,
    this.isFriend = false,
    this.isOwner = false,
    this.myProfileImageUrl,
    this.authorDisplayName,
    this.onBookmark,
    this.onDelete,
    this.onHonorVote,
    this.onAuthorTap,
  });
  final TourstarPostRecord post;
  final VoidCallback onTap;
  final bool isFriend;
  final bool isOwner;
  final String? myProfileImageUrl;
  /// 설정에서 닉네임 변경 직후에도 맞춤 표시 (내 글 → `myNickname` 반영).
  final String? authorDisplayName;
  final VoidCallback? onBookmark;
  final VoidCallback? onDelete;
  /// 1 = 썸업, -1 = 썸다운 (본인 글이면 null)
  final void Function(int value)? onHonorVote;
  /// 닉네임 탭 시 작성자 피드 (닉네임이 있을 때)
  final VoidCallback? onAuthorTap;

  Widget _buildAvatar() {
    final imageUrl = isOwner ? myProfileImageUrl : post.authorProfileImageUrl;
    final label = (authorDisplayName != null && authorDisplayName!.trim().isNotEmpty)
        ? authorDisplayName!.trim()
        : (post.authorNickname ?? "?");
    final initial = label.isNotEmpty ? label.substring(0, 1).toUpperCase() : "?";
    return Container(
      width: 32,
      height: 32,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_kPurple2, _kPink]),
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl.isNotEmpty
            ? Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, _, _) =>
                Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold))))
            : Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final resolvedAuthor = (authorDisplayName != null && authorDisplayName!.trim().isNotEmpty)
        ? authorDisplayName!.trim()
        : (post.authorNickname ?? "").trim();
    final thumbUrl = post.photoUrls.isNotEmpty ? post.photoUrls.first : null;
    final dateStr = post.createdAt != null
        ? "${post.createdAt!.year}-${post.createdAt!.month.toString().padLeft(2, '0')}-${post.createdAt!.day.toString().padLeft(2, '0')}"
        : "";
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: thumbUrl != null
                        ? Image.network(
                            thumbUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            errorBuilder: (_, _, _) => _PhotoPlaceholder(),
                          )
                        : _PhotoPlaceholder(),
                  ),
                  if (post.photoUrls.length > 1)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: _Badge(
                        label: "${post.photoUrls.length}",
                        color: Colors.black54,
                      ),
                    ),
                ],
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    post.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: _kGray800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 12,
                        color: _kGray400,
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          post.location,
                          style: const TextStyle(fontSize: 11, color: _kGray500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (dateStr.isNotEmpty) ...[
                        const Text(" · ", style: TextStyle(color: _kGray400)),
                        Text(dateStr, style: const TextStyle(fontSize: 11, color: _kGray400)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    post.comment,
                    style: const TextStyle(fontSize: 12, color: _kGray700, height: 1.5),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_tourstarPostHasAttachedSchedule(post)) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.calendar_month_outlined, size: 14, color: _kPurple),
                        const SizedBox(width: 4),
                        Text(
                          "screens.tourstar.schedule_in_feed_hint".tr(),
                          style: const TextStyle(fontSize: 10, color: _kPurple, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                  if (post.tags.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: post.tags
                          .take(3)
                          .map(
                            (tag) => Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: _kGray100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text("#$tag", style: const TextStyle(fontSize: 10, color: _kGray700)),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildAvatar(),
                      const SizedBox(width: 6),
                      Expanded(
                        child: GestureDetector(
                          onTap: onAuthorTap ?? onTap,
                          behavior: HitTestBehavior.opaque,
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  resolvedAuthor.isEmpty ? "screens.unknown".tr() : resolvedAuthor,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: _kGray800,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                              if (isFriend) ...[
                                const SizedBox(width: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: _kPurpleLight,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFD8B4FE)),
                                  ),
                                  child: Text(
                                    "screens.tourstar.friend_badge".tr(),
                                    style: const TextStyle(fontSize: 9, color: _kPurple, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (isOwner)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Text(
                            "▲${post.honorUp} ▼${post.honorDown}",
                            style: const TextStyle(fontSize: 10, color: _kGray400),
                          ),
                        )
                      else if (onHonorVote != null) ...[
                        GestureDetector(
                          onTap: () => onHonorVote!(1),
                          child: Icon(
                            post.honorVote == 1 ? Icons.thumb_up : Icons.thumb_up_outlined,
                            size: 16,
                            color: post.honorVote == 1 ? const Color(0xFF059669) : _kGray400,
                          ),
                        ),
                        Text("${post.honorUp}", style: TextStyle(fontSize: 10, color: post.honorVote == 1 ? const Color(0xFF059669) : _kGray500)),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => onHonorVote!(-1),
                          child: Icon(
                            post.honorVote == -1 ? Icons.thumb_down : Icons.thumb_down_outlined,
                            size: 16,
                            color: post.honorVote == -1 ? const Color(0xFFE11D48) : _kGray400,
                          ),
                        ),
                        Text("${post.honorDown}", style: TextStyle(fontSize: 10, color: post.honorVote == -1 ? const Color(0xFFE11D48) : _kGray500)),
                        const SizedBox(width: 4),
                        Text(
                          "screens.tourstar.net_likes".tr(namedArgs: {"likes": "${post.likes}"}),
                          style: const TextStyle(fontSize: 9, color: _kGray400),
                        ),
                      ],
                      const SizedBox(width: 8),
                      // 댓글 수
                      const Icon(Icons.chat_bubble_outline, size: 12, color: _kGray400),
                      const SizedBox(width: 2),
                      Text("${post.comments.length}", style: const TextStyle(fontSize: 11, color: _kGray500)),
                      const SizedBox(width: 6),
                      // 스크랩 버튼
                      if (onBookmark != null)
                        GestureDetector(
                          onTap: onBookmark,
                          child: Icon(
                            post.bookmarked ? Icons.bookmark : Icons.bookmark_border,
                            size: 16,
                            color: post.bookmarked ? _kPurple : _kGray400,
                          ),
                        ),
                      // 삭제 버튼 (내 게시물)
                      if (isOwner && onDelete != null) ...[
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: onDelete,
                          child: const Icon(Icons.delete_outline, size: 16, color: Color(0xFFEF4444)),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Photo Placeholder ──────────────────────────────────────
class _PhotoPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_kPurple2, _kPink]),
      ),
      child: const Center(child: Icon(Icons.photo, size: 40, color: Colors.white54)),
    );
  }
}

// ── Grid Card ────────────────────────────────────────────────
class _GridCard extends StatelessWidget {
  const _GridCard({required this.post, required this.onTap});
  final TourstarPostRecord post;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final thumbUrl = post.photoUrls.isNotEmpty ? post.photoUrls.first : null;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            thumbUrl != null
                ? Image.network(thumbUrl, fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(colors: [_kPurple2, _kPink]),
                      ),
                    ))
                : Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(colors: [_kPurple2, _kPink]),
                    ),
                  ),
            if (post.photoUrls.length > 1)
              Positioned(
                top: 4,
                right: 4,
                child: _Badge(
                  label: "+${post.photoUrls.length}",
                  color: Colors.black54,
                  fontSize: 8,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Badge ────────────────────────────────────────────────────
class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color, this.fontSize = 10});
  final String label;
  final Color color;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Post Detail Sheet (서버 기반)
// ══════════════════════════════════════════════════════════════
class _PostDetailSheet extends ConsumerStatefulWidget {
  const _PostDetailSheet({
    required this.post,
    required this.onAddComment,
    this.isOwner = false,
    this.myNickname,
    this.myProfileImageUrl,
    this.authorProfileMap = const {},
    this.onDeletePost,
    this.onEditPost,
    this.onAuthorFeedTap,
  });
  final TourstarPostRecord post;
  final void Function(String postId, String content) onAddComment;
  final bool isOwner;
  final String? myNickname;
  final String? myProfileImageUrl;
  final Map<String, String> authorProfileMap;
  final Future<bool> Function(String postId)? onDeletePost;
  final void Function(TourstarPostRecord post)? onEditPost;
  final VoidCallback? onAuthorFeedTap;

  @override
  ConsumerState<_PostDetailSheet> createState() => _PostDetailSheetState();
}

class _PostDetailSheetState extends ConsumerState<_PostDetailSheet> {
  int _photoIdx = 0;
  bool _scheduleExpanded = false;
  final _ctrl = TextEditingController();

  String _relativeTime(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 60) return "screens.tourstar.time_just_now".tr();
    if (diff.inMinutes < 60) {
      return "screens.tourstar.time_minutes_ago".tr(namedArgs: {"n": "${diff.inMinutes}"});
    }
    if (diff.inHours < 24) {
      return "screens.tourstar.time_hours_ago".tr(namedArgs: {"n": "${diff.inHours}"});
    }
    if (diff.inDays < 7) {
      return "screens.tourstar.time_days_ago".tr(namedArgs: {"n": "${diff.inDays}"});
    }
    return "${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}";
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _copyShareLink(TourstarPostRecord post) async {
    final url = TourstarRepository.buildShareUrl(post.id);
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("screens.tourstar.share_link_copied".tr())),
    );
  }

  Widget _buildCommentAvatar(TourstarComment c) {
    // 댓글 작성자 아바타: authorProfileMap 우선, 없으면 이니셜
    final nick = c.author;
    String? imageUrl;
    if (nick == widget.myNickname) {
      imageUrl = widget.myProfileImageUrl;
    } else {
      imageUrl = c.authorProfileImageUrl ?? widget.authorProfileMap[nick];
    }
    final initial = nick.isNotEmpty ? nick.substring(0, 1).toUpperCase() : "?";
    return Container(
      width: 28,
      height: 28,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_kPurple2, _kPink]),
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl.isNotEmpty
            ? Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, _, _) =>
                Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold))))
            : Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 댓글 실시간 반영 + myUserId 비동기 로드 대응을 위해 state 전체를 감시
    final tourState = ref.watch(tourstarControllerProvider);
    final allPosts = tourState.serverPosts;
    final post = allPosts.where((p) => p.id == widget.post.id).firstOrNull ??
        widget.post;

    // isOwner: myUserId가 나중에 로드되어도 즉시 반영되도록 동적 계산
    final bool isOwner = () {
      if (tourState.myUserId != null && post.userId != null) {
        return post.userId == tourState.myUserId;
      }
      if (tourState.myNickname != null && post.authorNickname != null) {
        return post.authorNickname == tourState.myNickname;
      }
      return false;
    }();
    final dateStr = post.createdAt != null
        ? "${post.createdAt!.year}-${post.createdAt!.month.toString().padLeft(2, '0')}-${post.createdAt!.day.toString().padLeft(2, '0')}"
        : "";

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            // Drag handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _kGray200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Photo carousel
                    Stack(
                      children: [
                        AspectRatio(
                          aspectRatio: 4 / 3,
                          child: post.photoUrls.isNotEmpty
                              ? Image.network(
                                  post.photoUrls[_photoIdx],
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  errorBuilder: (_, _, _) =>
                                      Container(
                                        decoration: const BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [_kPurple2, _kPink],
                                          ),
                                        ),
                                      ),
                                )
                              : Container(
                                  decoration: const BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [_kPurple2, _kPink],
                                    ),
                                  ),
                                ),
                        ),
                        if (post.photoUrls.length > 1) ...[
                          Positioned(
                            left: 8,
                            top: 0,
                            bottom: 0,
                            child: Center(
                              child: IconButton(
                                onPressed: () => setState(
                                  () => _photoIdx = (_photoIdx - 1 +
                                          post.photoUrls.length) %
                                      post.photoUrls.length,
                                ),
                                icon: const Icon(Icons.chevron_left, color: Colors.white, size: 32),
                                style: IconButton.styleFrom(backgroundColor: Colors.black38),
                              ),
                            ),
                          ),
                          Positioned(
                            right: 8,
                            top: 0,
                            bottom: 0,
                            child: Center(
                              child: IconButton(
                                onPressed: () => setState(
                                  () => _photoIdx = (_photoIdx + 1) % post.photoUrls.length,
                                ),
                                icon: const Icon(Icons.chevron_right, color: Colors.white, size: 32),
                                style: IconButton.styleFrom(backgroundColor: Colors.black38),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 12,
                            left: 0,
                            right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(
                                post.photoUrls.length,
                                (i) => AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: i == _photoIdx ? 16 : 6,
                                  height: 6,
                                  margin: const EdgeInsets.symmetric(horizontal: 2),
                                  decoration: BoxDecoration(
                                    color: i == _photoIdx ? Colors.white : Colors.white54,
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    // Post info
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 작성자 정보
                          Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(colors: [_kPurple2, _kPink]),
                                  shape: BoxShape.circle,
                                ),
                                child: ClipOval(
                                  child: () {
                                    final imgUrl = isOwner
                                        ? widget.myProfileImageUrl
                                        : post.authorProfileImageUrl;
                                    final initial = (post.authorNickname ?? "?").substring(0, 1).toUpperCase();
                                    if (imgUrl != null && imgUrl.isNotEmpty) {
                                      return Image.network(imgUrl, fit: BoxFit.cover,
                                          errorBuilder: (_, _, _) => Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold))));
                                    }
                                    return Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)));
                                  }(),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (widget.onAuthorFeedTap != null)
                                      GestureDetector(
                                        onTap: widget.onAuthorFeedTap,
                                        child: Text(
                                          post.authorNickname ?? "screens.unknown".tr(),
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: _kGray800,
                                            decoration: TextDecoration.underline,
                                          ),
                                        ),
                                      )
                                    else
                                      Text(
                                        post.authorNickname ?? "screens.unknown".tr(),
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _kGray800),
                                      ),
                                    if (dateStr.isNotEmpty)
                                      Text(dateStr, style: const TextStyle(fontSize: 11, color: _kGray400)),
                                  ],
                                ),
                              ),
                              // 작성자: 수정 · 일정 보기 · 삭제 / 타인: 일정이 있으면 일정 보기만
                              if (isOwner || _tourstarPostHasAttachedSchedule(post)) ...[
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Wrap(
                                    alignment: WrapAlignment.end,
                                    spacing: 0,
                                    runSpacing: 4,
                                    children: [
                                      if (isOwner)
                                        TextButton.icon(
                                          onPressed: () {
                                            if (!mounted) return;
                                            Navigator.pop(context);
                                            widget.onEditPost?.call(post);
                                          },
                                          icon: const Icon(Icons.edit_outlined, size: 16, color: _kPurple),
                                          label: Text(
                                            "screens.tourstar.action_edit".tr(),
                                            style: const TextStyle(fontSize: 12, color: _kPurple, fontWeight: FontWeight.w600),
                                          ),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                      if (_tourstarPostHasAttachedSchedule(post))
                                        TextButton.icon(
                                          onPressed: () => setState(() => _scheduleExpanded = !_scheduleExpanded),
                                          icon: Icon(
                                            _scheduleExpanded ? Icons.expand_less : Icons.calendar_month_outlined,
                                            size: 16,
                                            color: _kGray700,
                                          ),
                                          label: Text(
                                            _scheduleExpanded
                                                ? "screens.tourstar.schedule_collapse".tr()
                                                : "screens.tourstar.view_schedule".tr(),
                                            style: const TextStyle(fontSize: 12, color: _kGray700, fontWeight: FontWeight.w600),
                                          ),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                      if (isOwner)
                                        TextButton.icon(
                                          onPressed: () async {
                                            final navigator = Navigator.of(context);
                                            final messenger = ScaffoldMessenger.of(context);
                                            final confirmed = await showDialog<bool>(
                                              context: context,
                                              builder: (dialogContext) => AlertDialog(
                                                title: Text("screens.tourstar.delete_post_title".tr()),
                                                content: Text("screens.tourstar.delete_post_confirm".tr()),
                                                actions: [
                                                  TextButton(
                                                    onPressed: () => Navigator.pop(dialogContext, false),
                                                    child: Text("common.cancel".tr()),
                                                  ),
                                                  TextButton(
                                                    onPressed: () => Navigator.pop(dialogContext, true),
                                                    child: Text("common.delete".tr(), style: const TextStyle(color: Colors.red)),
                                                  ),
                                                ],
                                              ),
                                            );
                                            if (!mounted) return;
                                            if (confirmed == true) {
                                              final ok = await widget.onDeletePost?.call(post.id) ?? false;
                                              if (ok) {
                                                navigator.pop();
                                              } else {
                                                final msg = ref.read(tourstarControllerProvider).statusMessage;
                                                messenger.showSnackBar(
                                                  SnackBar(content: Text(msg.isNotEmpty ? msg : "screens.tourstar.delete_post_failed".tr())),
                                                );
                                              }
                                            }
                                          },
                                          icon: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
                                          label: Text("common.delete".tr(), style: const TextStyle(fontSize: 12, color: Colors.red)),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  post.title,
                                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _kGray800),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 14, color: _kGray400),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(post.location, style: const TextStyle(fontSize: 12, color: _kGray500)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            post.comment,
                            style: const TextStyle(fontSize: 14, color: _kGray700, height: 1.6),
                          ),
                          if (_tourstarPostHasAttachedSchedule(post) &&
                              _scheduleExpanded &&
                              post.attachedSchedule != null) ...[
                            const SizedBox(height: 12),
                            TourstarAttachedSchedulePreview(data: post.attachedSchedule!),
                          ],
                          if (post.tags.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: post.tags
                                  .map(
                                    (tag) => Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: _kPurpleLight,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text("#$tag", style: const TextStyle(fontSize: 12, color: _kPurple, fontWeight: FontWeight.w500)),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                          const SizedBox(height: 16),
                          // ── 액션 바 (댓글 수, 사진 수, 공유 버튼) ──
                          Row(
                            children: [
                              const Icon(Icons.chat_bubble_outline, size: 18, color: _kGray400),
                              const SizedBox(width: 4),
                              Text(
                                "screens.tourstar.comments_inline".tr(namedArgs: {"count": "${post.comments.length}"}),
                                style: const TextStyle(color: _kGray500, fontSize: 13),
                              ),
                              const SizedBox(width: 20),
                              const Icon(Icons.photo_library_outlined, size: 18, color: _kGray400),
                              const SizedBox(width: 4),
                              Text(
                                "screens.tourstar.photos_inline".tr(namedArgs: {"count": "${post.photoUrls.length}"}),
                                style: const TextStyle(color: _kGray500, fontSize: 13),
                              ),
                              const Spacer(),
                              // ── 공유 링크 복사 버튼 ──
                              GestureDetector(
                                onTap: () => _copyShareLink(post),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: _kPurpleLight,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: const Color(0xFFD8B4FE)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.share_outlined, size: 14, color: _kPurple),
                                      const SizedBox(width: 4),
                                      Text(
                                        "screens.tourstar.share".tr(),
                                        style: const TextStyle(fontSize: 12, color: _kPurple, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 28, color: _kGray100),
                          Text(
                            "screens.tourstar.comments_heading_n".tr(namedArgs: {"count": "${post.comments.length}"}),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _kGray700),
                          ),
                          const SizedBox(height: 8),
                          if (post.comments.isEmpty)
                            Text(
                              "screens.tourstar.first_comment".tr(),
                              style: const TextStyle(fontSize: 12, color: _kGray400),
                            )
                          else
                            ...post.comments.map(
                              (c) => Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: _kGray100, borderRadius: BorderRadius.circular(10)),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildCommentAvatar(c),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (c.author.isNotEmpty)
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    c.author,
                                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _kGray700),
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                if (c.createdAt != null) ...[
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    _relativeTime(c.createdAt!),
                                                    style: const TextStyle(fontSize: 10, color: _kGray400),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          const SizedBox(height: 2),
                                          Text(c.content, style: const TextStyle(fontSize: 12, color: _kGray700)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _ctrl,
                                  style: const TextStyle(fontSize: 13),
                                  decoration: InputDecoration(
                                    hintText: "screens.tourstar.comment_hint".tr(),
                                    hintStyle: const TextStyle(color: _kGray400, fontSize: 13),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: _kGray200),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () {
                                  final text = _ctrl.text.trim();
                                  if (text.isEmpty) return;
                                  widget.onAddComment(post.id, text);
                                  _ctrl.clear();
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  decoration: BoxDecoration(color: _kPurple, borderRadius: BorderRadius.circular(12)),
                                  child: Text(
                                    "screens.tourstar.comment_submit".tr(),
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Create Post Sheet
// ══════════════════════════════════════════════════════════════
class _CreatePostSheet extends ConsumerStatefulWidget {
  const _CreatePostSheet();

  @override
  ConsumerState<_CreatePostSheet> createState() => _CreatePostSheetState();
}

class _CreatePostSheetState extends ConsumerState<_CreatePostSheet> {
  String _visibility = "public";
  String? _openGroup;
  final _commentCtrl = TextEditingController();
  bool _planPickerOpen = false;
  List<TravelPlanRecord> _myPlans = const [];
  bool _plansLoading = false;

  Widget _buildRankedPreview(String sourceImage) {
    final resolved = TourstarRepository.toDisplayImageUrl(sourceImage);
    if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
      return Image.network(
        resolved,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Center(
          child: Icon(Icons.image_outlined, color: _kGray400),
        ),
      );
    }
    return Image.file(
      File(sourceImage),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const Center(
        child: Icon(Icons.image_outlined, color: _kGray400),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _openGroup = _mbtiGroups.first.key;
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _openPlanPicker() async {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return;
    final userId = getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
    if (userId == null) return;

    if (_myPlans.isNotEmpty) {
      setState(() => _planPickerOpen = true);
      return;
    }
    setState(() => _plansLoading = true);
    try {
      final plans = await ref.read(plannerRepositoryProvider).fetchMyPlans(userId);
      if (!mounted) return;
      setState(() {
        _myPlans = plans;
        _planPickerOpen = true;
        _plansLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _plansLoading = false);
    }
  }

  Widget _buildCreatePlanPickerPanel() {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFC7D2FE)),
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFFEEF2FF),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "screens.tourstar.select_saved_plan_title".tr(),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF4338CA)),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _planPickerOpen = false),
                  child: Text("common.close".tr(), style: const TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
          if (_myPlans.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                "screens.tourstar.no_saved_plans".tr(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: _kGray500),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _myPlans.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final p = _myPlans[i];
                  return ListTile(
                    dense: true,
                    title: Text(
                      p.routeName,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    subtitle: Text(
                      "${p.location}${p.startDate != null ? " · ${p.startDate}" : ""} · ${p.schedule.length}곳",
                      style: const TextStyle(fontSize: 11),
                    ),
                    onTap: () {
                      ref.read(tourstarControllerProvider.notifier).setAttachedScheduleFromTravelPlan(p);
                      setState(() => _planPickerOpen = false);
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(tourstarControllerProvider);
    final ctrl = ref.read(tourstarControllerProvider.notifier);

    // Sync comment field
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _commentCtrl.text != state.comment) {
        _commentCtrl.text = state.comment;
        _commentCtrl.selection =
            TextSelection.collapsed(offset: state.comment.length);
      }
    });

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        minChildSize: 0.6,
        maxChildSize: 0.95,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            // Handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _kGray200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 8, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "screens.tourstar.create_title".tr(),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _kGray800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "screens.tourstar.create_subtitle".tr(),
                          style: const TextStyle(fontSize: 12, color: _kGray400),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: _kGray500),
                  ),
                ],
              ),
            ),
            // Status bar
            if (state.statusMessage.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 8,
                ),
                color: _kPurpleLight,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        tourstarStatusLine(state),
                        style: const TextStyle(
                          fontSize: 12,
                          color: _kPurple,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    if (state.statusMessage ==
                        "screens.tourstar.status_gallery_permission_denied")
                      TextButton(
                        onPressed: ctrl.openGallerySettings,
                        child: Text(
                          "screens.tourstar.open_settings".tr(),
                          style: const TextStyle(
                            fontSize: 12,
                            color: _kPurple,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (state.loading)
              const LinearProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(_kPurple),
                backgroundColor: _kPurpleLight,
                minHeight: 2,
              ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Photos ──────────────────────────────
                    Row(
                      children: [
                        Text(
                          "screens.tourstar.photos_selected_n".tr(
                            namedArgs: {"count": "${state.pickedFiles.length}"},
                          ),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kGray700,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: state.loading ? null : ctrl.pickImages,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: _kPurpleLight,
                              border: Border.all(
                                color: const Color(0xFFD8B4FE),
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.add_photo_alternate_outlined,
                                  size: 16,
                                  color: _kPurple,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  state.loading
                                      ? "screens.tourstar.pick_processing".tr()
                                      : "screens.tourstar.pick_photos".tr(),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _kPurple,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (state.pickedFiles.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 90,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: state.pickedFiles.length,
                          separatorBuilder: (context0, index0) =>
                              const SizedBox(width: 8),
                          itemBuilder: (context0, i) => ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.file(
                              File(state.pickedFiles[i].path),
                              width: 90,
                              height: 90,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                    ],
                    // Date filter
                    const SizedBox(height: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: state.loading
                                    ? null
                                    : () async {
                                        final now = DateTime.now();
                                        final picked = await showDateRangePicker(
                                          context: context,
                                          firstDate: DateTime(now.year - 10),
                                          lastDate: DateTime(now.year + 1),
                                        );
                                        if (picked != null) {
                                          await ctrl.setDateRange(
                                            picked.start,
                                            picked.end,
                                          );
                                        }
                                      },
                                icon: const Icon(Icons.date_range, size: 16),
                                label: Text(
                                  state.filterStartDate != null
                                      ? "screens.tourstar.date_range_summary".tr(namedArgs: {
                                          "start":
                                              "${state.filterStartDate!.month}/${state.filterStartDate!.day}",
                                          "end":
                                              "${state.filterEndDate?.month}/${state.filterEndDate?.day}",
                                          "count": "${state.filteredPickedFiles.length}",
                                        })
                                      : "screens.tourstar.date_range_placeholder".tr(),
                                  style: const TextStyle(fontSize: 12),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: _kPurple,
                                  side: const BorderSide(
                                    color: Color(0xFFD8B4FE),
                                  ),
                                ),
                              ),
                            ),
                            if (state.filterStartDate != null) ...[
                              const SizedBox(width: 8),
                              TextButton(
                                onPressed: ctrl.clearDateRange,
                                child: Text(
                                  "screens.tourstar.clear".tr(),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _kGray500,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            OutlinedButton(
                              onPressed: state.loading ? null : ctrl.autoPickAndUploadFromGallery,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _kPurple,
                                side: const BorderSide(color: Color(0xFFD8B4FE)),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                              ),
                              child: const Text(
                                "기간 사진 업로드",
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Switch(
                                  value: state.includeUnknownShotDate,
                                  onChanged: state.loading ? null : (v) => ctrl.setIncludeUnknownShotDate(v),
                                  activeThumbColor: _kPurple,
                                ),
                                const Text(
                                  "촬영일 없는 사진 포함",
                                  style: TextStyle(fontSize: 12, color: _kGray500),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    // 업로드 + AI 분석은 "기간 사진 업로드" 버튼에서 원터치로 수행한다.
                    // Ranked images
                    if (state.rankedImages.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Text(
                            "screens.tourstar.ai_ranking_title".tr(),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _kGray700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            "screens.tourstar.ai_ranking_pick_n".tr(namedArgs: {
                              "selected": "${state.selectedImagePaths.length}",
                              "total": "${state.rankedImages.length}",
                            }),
                            style: const TextStyle(
                              fontSize: 12,
                              color: _kGray400,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 120,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: state.rankedImages.length,
                          separatorBuilder: (context0, index0) =>
                              const SizedBox(width: 8),
                          itemBuilder: (context0, i) {
                            final img = state.rankedImages[i];
                            final selected = state.selectedImagePaths
                                .contains(img.sourceImage);
                            return GestureDetector(
                              onTap: () => ctrl.toggleSelectedImagePath(
                                img.sourceImage,
                                !selected,
                              ),
                              child: Stack(
                                children: [
                                  Container(
                                    width: 100,
                                    height: 120,
                                    decoration: BoxDecoration(
                                      borderRadius:
                                          BorderRadius.circular(10),
                                      border: Border.all(
                                        color: selected
                                            ? _kPurple
                                            : Colors.transparent,
                                        width: 2,
                                      ),
                                      color: _kGray100,
                                    ),
                                    child: ClipRRect(
                                      borderRadius:
                                          BorderRadius.circular(8),
                                      child: _buildRankedPreview(img.sourceImage),
                                    ),
                                  ),
                                  Positioned(
                                    top: 4,
                                    left: 4,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.black54,
                                        borderRadius:
                                            BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        "#${img.rank}",
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                  if (selected)
                                    Positioned(
                                      top: 4,
                                      right: 4,
                                      child: Container(
                                        width: 20,
                                        height: 20,
                                        decoration: BoxDecoration(
                                          color: _kPurple,
                                          borderRadius:
                                              BorderRadius.circular(10),
                                        ),
                                        child: const Icon(
                                          Icons.check,
                                          size: 13,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    // ── Comment ──────────────────────────────
                    const SizedBox(height: 16),
                    Text(
                      "screens.tourstar.comment_one_line".tr(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kGray700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _commentCtrl,
                            maxLines: 3,
                            style: const TextStyle(fontSize: 13),
                            onChanged: ctrl.setComment,
                            decoration: InputDecoration(
                              hintText: "screens.tourstar.comment_ai_hint".tr(),
                              hintStyle: const TextStyle(
                                color: _kGray400,
                                fontSize: 12,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: _kGray200),
                              ),
                              contentPadding: const EdgeInsets.all(12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          children: [
                            GestureDetector(
                              onTap: state.loading
                                  ? null
                                  : ctrl.generateAutoComment,
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: _kPurpleLight,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.auto_fix_high,
                                  color: _kPurple,
                                  size: 20,
                                ),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "screens.tourstar.auto".tr(),
                              style: const TextStyle(
                                fontSize: 9,
                                color: _kPurple,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    // ── 플래너 일정 (게시 시 함께 저장, 상세에서 '일정 보기') ──
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: state.loading || _plansLoading ? null : _openPlanPicker,
                        icon: _plansLoading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.calendar_month_outlined, size: 18),
                        label: Text("screens.tourstar.import_saved_schedule".tr()),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _kPurple,
                          side: const BorderSide(color: Color(0xFFD8B4FE)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    if (_planPickerOpen) ...[
                      const SizedBox(height: 10),
                      _buildCreatePlanPickerPanel(),
                    ],
                    if (state.attachedScheduleSnapshot != null &&
                        !tourstarAttachedScheduleIsEmpty(state.attachedScheduleSnapshot!)) ...[
                      const SizedBox(height: 12),
                      TourstarAttachedSchedulePreview(data: state.attachedScheduleSnapshot!),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: state.loading ? null : ctrl.clearAttachedSchedule,
                          child: Text(
                            "screens.tourstar.remove_attached_schedule".tr(),
                            style: const TextStyle(fontSize: 12, color: _kGray500),
                          ),
                        ),
                      ),
                    ],
                    // ── MBTI ────────────────────────────────
                    const SizedBox(height: 16),
                    Text(
                      "screens.tourstar.tone_mbti".tr(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kGray700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: _kGray200),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          GestureDetector(
                            onTap: () => ctrl.setStyleFilter("AUTO"),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: state.styleFilter == "AUTO"
                                    ? _kPurpleLight
                                    : Colors.white,
                                border: Border.all(
                                  color: state.styleFilter == "AUTO"
                                      ? const Color(0xFFD8B4FE)
                                      : _kGray200,
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                "screens.tourstar.tone_auto_default".tr(),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: state.styleFilter == "AUTO"
                                      ? _kPurple
                                      : _kGray500,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          for (final group in _mbtiGroups) ...[
                            GestureDetector(
                              onTap: () => setState(
                                () => _openGroup = _openGroup == group.key
                                    ? null
                                    : group.key,
                              ),
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  children: [
                                    Text(
                                      "screens.tourstar.mbti_group_${group.key}".tr(),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: _kGray500,
                                      ),
                                    ),
                                    const Spacer(),
                                    Icon(
                                      _openGroup == group.key
                                          ? Icons.expand_less
                                          : Icons.expand_more,
                                      size: 16,
                                      color: _kGray400,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (_openGroup == group.key) ...[
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: group.items
                                    .map(
                                      (mbti) => GestureDetector(
                                        onTap: () =>
                                            ctrl.setStyleFilter(mbti),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 5,
                                          ),
                                          decoration: BoxDecoration(
                                            color: state.styleFilter == mbti
                                                ? _kPurpleLight
                                                : Colors.white,
                                            border: Border.all(
                                              color:
                                                  state.styleFilter == mbti
                                                      ? const Color(
                                                          0xFFD8B4FE,
                                                        )
                                                      : _kGray200,
                                            ),
                                            borderRadius:
                                                BorderRadius.circular(20),
                                          ),
                                          child: Text(
                                            mbti,
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                              color:
                                                  state.styleFilter == mbti
                                                      ? _kPurple
                                                      : _kGray500,
                                            ),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                              const SizedBox(height: 8),
                            ],
                          ],
                        ],
                      ),
                    ),
                    // ── Visibility ───────────────────────────
                    const SizedBox(height: 16),
                    Text(
                      "screens.tourstar.visibility_title".tr(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kGray700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _VisibilityBtn(
                          label: "screens.tourstar.visibility_public".tr(),
                          icon: Icons.public,
                          selected: _visibility == "public",
                          onTap: () =>
                              setState(() => _visibility = "public"),
                        ),
                        const SizedBox(width: 10),
                        _VisibilityBtn(
                          label: "screens.tourstar.visibility_private".tr(),
                          icon: Icons.lock_outline,
                          selected: _visibility == "private",
                          onTap: () =>
                              setState(() => _visibility = "private"),
                        ),
                      ],
                    ),
                    // ── Actions ──────────────────────────────
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: state.loading
                            ? null
                            : () async {
                                final navigator = Navigator.of(context);
                                final ok =
                                    await ctrl.publishPost(visibility: _visibility);
                                if (!mounted) return;
                                if (ok) navigator.pop();
                              },
                        style: FilledButton.styleFrom(
                          backgroundColor: _kPurple,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          state.loading
                              ? "screens.tourstar.posting".tr()
                              : "screens.tourstar.publish".tr(),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Visibility Button ────────────────────────────────────────
class _VisibilityBtn extends StatelessWidget {
  const _VisibilityBtn({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? _kPurpleLight : Colors.white,
            border: Border.all(
              color: selected ? const Color(0xFFD8B4FE) : _kGray200,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? _kPurple : _kGray400,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? _kPurple : _kGray500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Edit Post Sheet
// ══════════════════════════════════════════════════════════════

/// 업로드 응답 URL → 백엔드 `image_paths`용 `/tourstar-files/...` 경로
String _uploadedPathForPostUpdate(UploadedPhoto u) {
  final url = u.url.trim();
  if (url.startsWith("/")) return url;
  final uri = Uri.tryParse(url);
  if (uri != null && uri.path.isNotEmpty) return uri.path;
  return url;
}

class _EditPostSheet extends ConsumerStatefulWidget {
  const _EditPostSheet({required this.post, required this.onSave});
  final TourstarPostRecord post;
  final Future<bool> Function({
    required String title,
    required String location,
    required String comment,
    required List<String> tags,
    List<String>? keepPhotoUrls,
    List<String>? newImagePaths,
  }) onSave;

  @override
  ConsumerState<_EditPostSheet> createState() => _EditPostSheetState();
}

class _EditPostSheetState extends ConsumerState<_EditPostSheet> {
  static const int _maxPhotos = 10;

  late final TextEditingController _titleCtrl;
  late final TextEditingController _locationCtrl;
  late final TextEditingController _commentCtrl;
  late final TextEditingController _tagsCtrl;
  late final List<String> _initialPhotoUrls;
  late List<String> _keepUrls;
  final List<XFile> _newFiles = [];
  final ImagePicker _picker = ImagePicker();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.post.title);
    _locationCtrl = TextEditingController(text: widget.post.location);
    _commentCtrl = TextEditingController(text: widget.post.comment);
    _tagsCtrl = TextEditingController(text: widget.post.tags.join(", "));
    _initialPhotoUrls = List<String>.from(widget.post.photoUrls);
    _keepUrls = List<String>.from(widget.post.photoUrls);
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _locationCtrl.dispose();
    _commentCtrl.dispose();
    _tagsCtrl.dispose();
    super.dispose();
  }

  bool _samePhotoList(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  bool get _photoDirty => _newFiles.isNotEmpty || !_samePhotoList(_keepUrls, _initialPhotoUrls);

  Future<void> _pickImages() async {
    final total = _keepUrls.length + _newFiles.length;
    if (total >= _maxPhotos) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "screens.tourstar.max_photos_snackbar".tr(namedArgs: {"max": "$_maxPhotos"}),
          ),
        ),
      );
      return;
    }
    final files = await _picker.pickMultiImage();
    if (files.isEmpty || !mounted) return;
    final room = _maxPhotos - total;
    setState(() {
      _newFiles.addAll(files.take(room));
    });
  }

  void _removeKeptAt(int index) {
    setState(() => _keepUrls.removeAt(index));
  }

  void _removeNewAt(int index) {
    setState(() => _newFiles.removeAt(index));
  }

  Future<void> _save() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final title = _titleCtrl.text.trim();
    final location = _locationCtrl.text.trim();
    final comment = _commentCtrl.text.trim();
    final tags = _tagsCtrl.text
        .split(",")
        .map((t) => t.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (title.isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text("screens.tourstar.title_required".tr())));
      return;
    }
    setState(() => _saving = true);
    try {
      List<String>? newPaths;
      if (_newFiles.isNotEmpty) {
        final repo = ref.read(tourstarRepositoryProvider);
        final upload = await repo.uploadPhotos(_newFiles);
        newPaths = upload.uploaded.map(_uploadedPathForPostUpdate).where((p) => p.isNotEmpty).toList();
        if (newPaths.isEmpty && mounted) {
          messenger.showSnackBar(
            SnackBar(content: Text("screens.tourstar.upload_new_failed".tr())),
          );
          setState(() => _saving = false);
          return;
        }
      }

      final ok = await widget.onSave(
        title: title,
        location: location,
        comment: comment,
        tags: tags,
        keepPhotoUrls: _photoDirty ? List<String>.from(_keepUrls) : null,
        newImagePaths: newPaths,
      );
      if (!mounted) return;
      if (ok) {
        navigator.pop();
      } else {
        messenger.showSnackBar(SnackBar(content: Text("screens.tourstar.edit_failed".tr())));
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              "screens.tourstar.save_error".tr(namedArgs: {"error": "$e"}),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController ctrl, {int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kGray700)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: _kGray100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _kGray200),
          ),
          child: TextField(
            controller: ctrl,
            maxLines: maxLines,
            style: const TextStyle(fontSize: 14, color: _kGray800),
            decoration: const InputDecoration(
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  Widget _thumbKept(int index, String rawUrl) {
    final display = TourstarRepository.toDisplayImageUrl(rawUrl);
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 100,
              height: 100,
              child: display.isEmpty
                  ? Container(color: _kGray200, child: const Icon(Icons.image_not_supported, color: _kGray400))
                  : Image.network(
                      display,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        color: _kGray200,
                        child: const Icon(Icons.broken_image, color: _kGray400),
                      ),
                    ),
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _removeKeptAt(index),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close, size: 16, color: Colors.white),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _thumbNew(int index, XFile file) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 100,
              height: 100,
              child: Image.file(
                File(file.path),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  color: _kGray200,
                  child: const Icon(Icons.broken_image, color: _kGray400),
                ),
              ),
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _removeNewAt(index),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close, size: 16, color: Colors.white),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 4,
            left: 4,
            right: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                "NEW",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _addPhotoTile() {
    final full = _keepUrls.length + _newFiles.length >= _maxPhotos;
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Material(
        color: _kGray100,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: full ? null : _pickImages,
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 100,
            height: 100,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_photo_alternate_outlined, size: 32, color: full ? _kGray300 : _kPurple),
                const SizedBox(height: 6),
                Text(
                  "screens.tourstar.add_photo".tr(),
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: full ? _kGray400 : _kPurple),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _photoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text("screens.tourstar.photos_label".tr(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kGray700)),
            const Spacer(),
            Text(
              "${_keepUrls.length + _newFiles.length}/$_maxPhotos",
              style: const TextStyle(fontSize: 11, color: _kGray400),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          "screens.tourstar.photos_edit_hint".tr(),
          style: TextStyle(fontSize: 11, color: _kGray400.withValues(alpha: 0.95)),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 100,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              ..._keepUrls.asMap().entries.map((e) => _thumbKept(e.key, e.value)),
              ..._newFiles.asMap().entries.map((e) => _thumbNew(e.key, e.value)),
              _addPhotoTile(),
            ],
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: _kGray200, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      "screens.tourstar.edit_post_title".tr(),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _kGray800),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: _kGray500),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _field("screens.tourstar.field_title".tr(), _titleCtrl),
                    _field("screens.tourstar.field_place".tr(), _locationCtrl),
                    _field("screens.tourstar.field_content".tr(), _commentCtrl, maxLines: 5),
                    _photoSection(),
                    _field("screens.tourstar.field_tags".tr(), _tagsCtrl),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: _kPurple,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          "screens.tourstar.edit_save".tr(),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
