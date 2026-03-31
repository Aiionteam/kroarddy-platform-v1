import "dart:io";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

// ignore_for_file: avoid_catches_without_on_clauses

import "../../../core/router/main_shell.dart";
import "../data/tourstar_models.dart";
import "../data/tourstar_repository.dart";
import "state/tourstar_controller.dart";
import "state/tourstar_state.dart";

// ── Design tokens ────────────────────────────────────────────
const _kPurple = Color(0xFF8A2BE2);
const _kPurple2 = Color(0xFF9333EA);
const _kPink = Color(0xFFEC4899);
const _kPurpleLight = Color(0xFFF3E8FF);
const _kGray100 = Color(0xFFF3F4F6);
const _kGray200 = Color(0xFFE5E7EB);
const _kGray300 = Color(0xFFD1D5DB);
const _kGray400 = Color(0xFF9CA3AF);
const _kGray500 = Color(0xFF6B7280);
const _kGray700 = Color(0xFF374151);
const _kGray800 = Color(0xFF1F2937);

// ── MBTI groups ──────────────────────────────────────────────
class _MbtiGroup {
  const _MbtiGroup(this.title, this.items);
  final String title;
  final List<String> items;
}

const _mbtiGroups = [
  _MbtiGroup("분석/전략형 (NT)", ["INTJ", "INTP", "ENTJ", "ENTP"]),
  _MbtiGroup("외교/감성형 (NF)", ["INFJ", "INFP", "ENFJ", "ENFP"]),
  _MbtiGroup("관리/실무형 (SJ)", ["ISTJ", "ISFJ", "ESTJ", "ESFJ"]),
  _MbtiGroup("탐험/즉흥형 (SP)", ["ISTP", "ISFP", "ESTP", "ESFP"]),
];

// ═════════════════════════════════════════════════════════════
class TourstarPage extends ConsumerStatefulWidget {
  const TourstarPage({super.key, this.initialPostId});

  /// 딥링크나 채팅 카드에서 바로 열 게시글 ID
  final String? initialPostId;

  @override
  ConsumerState<TourstarPage> createState() => _TourstarPageState();
}

class _TourstarPageState extends ConsumerState<TourstarPage> {
  String _filter = "all";
  String _sortBy = "latest";   // latest | likes | comments
  String _searchQuery = "";
  bool _gridView = false;
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _searchCtrl = TextEditingController();

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

  List<TourstarPostRecord> _getFiltered(TourstarState tourState) {
    final all = tourState.serverPosts;
    List<TourstarPostRecord> result;
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
      case "likes":
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(tourstarControllerProvider.notifier).loadPosts().then((_) {
        if (!mounted) return;
        final id = widget.initialPostId;
        if (id != null && id.isNotEmpty) {
          final post = ref
              .read(tourstarControllerProvider)
              .serverPosts
              .where((p) => p.id == id)
              .firstOrNull;
          if (post != null) _openDetail(post);
        }
      });
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

  Widget _verticalDivider() => Container(width: 1, height: 28, color: const Color(0xFFF3F4F6));

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
            expandedHeight: 90,
            leading: IconButton(
              icon: const Icon(Icons.menu, color: _kGray800),
              onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.fromLTRB(60, 0, 20, 14),
              title: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "투어스타",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _kGray800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "AI가 베스트 사진을 골라드려요 ✨",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.normal,
                      color: _kGray400,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Profile / Stats ──────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 아바타 + 이름
                  Row(
                    children: [
                      GestureDetector(
                        onTap: _pickAndUploadProfileImage,
                        child: Stack(
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [_kPurple2, _kPink],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: _kPurple2.withValues(alpha: 0.25),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ClipOval(
                                child: effectiveProfileImage != null
                                    ? Image.network(
                                        effectiveProfileImage,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Center(
                                          child: Text(
                                            (tourState.myNickname ?? "T").substring(0, 1).toUpperCase(),
                                            style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      )
                                    : Center(
                                        child: Text(
                                          (tourState.myNickname ?? "T").substring(0, 1).toUpperCase(),
                                          style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                              ),
                            ),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: _kPurple,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 1.5),
                                ),
                                child: const Icon(Icons.camera_alt, size: 12, color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tourState.myNickname ?? "닉네임을 불러오는 중…",
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: _kGray800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              "소중한 여행의 순간들을 기록하세요 ✈️",
                              style: TextStyle(fontSize: 12, color: _kGray400),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(height: 1, color: Color(0xFFF3F4F6)),
                  const SizedBox(height: 14),
                  // 통계 (전체 폭으로)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _StatItem(value: "${stats['total']}", label: "전체"),
                      _verticalDivider(),
                      _StatItem(value: "${stats['mine']}", label: "내 게시물"),
                      _verticalDivider(),
                      _StatItem(value: "${stats['bookmarked']}", label: "스크랩"),
                      _verticalDivider(),
                      _StatItem(value: "${stats['likes']}", label: "좋아요", color: _kPink),
                      _verticalDivider(),
                      _StatItem(value: "${stats['friends']}", label: "친구", color: _kPurple),
                    ],
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
                    hintText: "게시물 검색...",
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
                            ("all", "전체"),
                            ("mine", "내 게시물 (${stats['mine']})"),
                            ("friends", "친구 게시물 (${stats['friendPosts']})"),
                            ("bookmarked", "스크랩 (${stats['bookmarked']})"),
                          ])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: GestureDetector(
                                onTap: () => setState(() => _filter = tab.$1),
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

          // ── 정렬 바 (최신순 / 좋아요순 / 댓글순) ─────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  for (final sort in [("latest", "최신순"), ("likes", "좋아요순"), ("comments", "댓글순")])
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
                        isLiked: tourState.likedPostIds.contains(p.id),
                        onTap: () => _openDetail(p),
                        onLike: () => ref.read(tourstarControllerProvider.notifier).toggleLike(p.id),
                        onBookmark: () => ref.read(tourstarControllerProvider.notifier).toggleBookmark(p.id),
                        onDelete: isOwner
                            ? () async {
                                final confirmed = await showDialog<bool>(
                                  context: context,
                                  builder: (dialogContext) => AlertDialog(
                                    title: const Text("게시물 삭제"),
                                    content: const Text("정말로 삭제하시겠습니까?"),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(dialogContext, false),
                                        child: const Text("취소"),
                                      ),
                                      TextButton(
                                        onPressed: () => Navigator.pop(dialogContext, true),
                                        child: const Text("삭제", style: TextStyle(color: Colors.red)),
                                      ),
                                    ],
                                  ),
                                );
                                if (confirmed == true && mounted) {
                                  final ok = await ref.read(tourstarControllerProvider.notifier).deletePost(p.id);
                                  if (!ok && mounted) {
                                    final msg = ref.read(tourstarControllerProvider).statusMessage;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(msg.isNotEmpty ? msg : "게시글 삭제에 실패했습니다.")),
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
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "AI가 베스트 사진을 골라드려요",
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kGray800,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          "사진을 올리면 잘 나온 사진만 자동 추천하고\n"
                          "코멘트만 남기면 예쁘게 게시됩니다",
                          style: TextStyle(
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
        label: const Text("내 여행기록"),
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
          const Text(
            "아직 기록된 여행이 없습니다",
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _kGray400,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            '"내 여행기록" 버튼으로 첫 번째 여행을 기록해보세요',
            style: TextStyle(fontSize: 12, color: _kGray300),
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
              child: const Text(
                "여행 기록하기",
                style: TextStyle(
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
    this.isLiked = false,
    this.myProfileImageUrl,
    this.onBookmark,
    this.onDelete,
    this.onLike,
  });
  final TourstarPostRecord post;
  final VoidCallback onTap;
  final bool isFriend;
  final bool isOwner;
  final bool isLiked;
  final String? myProfileImageUrl;
  final VoidCallback? onBookmark;
  final VoidCallback? onDelete;
  final VoidCallback? onLike;

  Widget _buildAvatar() {
    final imageUrl = isOwner ? myProfileImageUrl : post.authorProfileImageUrl;
    final initial = (post.authorNickname ?? "?").substring(0, 1).toUpperCase();
    return Container(
      width: 32,
      height: 32,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_kPurple2, _kPink]),
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl.isNotEmpty
            ? Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) =>
                Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold))))
            : Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                            errorBuilder: (_, __, ___) => _PhotoPlaceholder(),
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
                        child: Row(
                          children: [
                            Text(
                              post.authorNickname ?? "알 수 없음",
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kGray700),
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
                                child: const Text("친구", style: TextStyle(fontSize: 9, color: _kPurple, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ],
                        ),
                      ),
                      // 좋아요 버튼
                      GestureDetector(
                        onTap: onLike,
                        child: Icon(
                          isLiked ? Icons.favorite : Icons.favorite_border,
                          size: 16,
                          color: isLiked ? _kPink : _kGray400,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Text(
                        "${post.likes}",
                        style: TextStyle(fontSize: 11, color: isLiked ? _kPink : _kGray500),
                      ),
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
                    errorBuilder: (_, __, ___) => Container(
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
  });
  final TourstarPostRecord post;
  final void Function(String postId, String content) onAddComment;
  final bool isOwner;
  final String? myNickname;
  final String? myProfileImageUrl;
  final Map<String, String> authorProfileMap;
  final Future<bool> Function(String postId)? onDeletePost;
  final void Function(TourstarPostRecord post)? onEditPost;

  @override
  ConsumerState<_PostDetailSheet> createState() => _PostDetailSheetState();
}

class _PostDetailSheetState extends ConsumerState<_PostDetailSheet> {
  int _photoIdx = 0;
  final _ctrl = TextEditingController();

  String _relativeTime(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 60) return "방금 전";
    if (diff.inMinutes < 60) return "${diff.inMinutes}분 전";
    if (diff.inHours < 24) return "${diff.inHours}시간 전";
    if (diff.inDays < 7) return "${diff.inDays}일 전";
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
      const SnackBar(content: Text("공유 링크가 클립보드에 복사되었습니다.")),
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
            ? Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) =>
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
                                  errorBuilder: (_, __, ___) =>
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
                                          errorBuilder: (_, __, ___) => Center(child: Text(initial, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold))));
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
                                    Text(
                                      post.authorNickname ?? "알 수 없음",
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _kGray800),
                                    ),
                                    if (dateStr.isNotEmpty)
                                      Text(dateStr, style: const TextStyle(fontSize: 11, color: _kGray400)),
                                  ],
                                ),
                              ),
                              // 내 게시물이면 수정/삭제 메뉴
                              if (isOwner) ...[
                                const SizedBox(width: 4),
                                PopupMenuButton<String>(
                                  icon: const Icon(Icons.more_vert, size: 20, color: _kGray500),
                                  onSelected: (value) async {
                                    if (value == "edit") {
                                      if (!mounted) return;
                                      Navigator.pop(context);
                                      widget.onEditPost?.call(post);
                                    } else if (value == "delete") {
                                      final confirmed = await showDialog<bool>(
                                        context: context,
                                        builder: (dialogContext) => AlertDialog(
                                          title: const Text("게시물 삭제"),
                                          content: const Text("정말로 삭제하시겠습니까?"),
                                          actions: [
                                            TextButton(
                                              onPressed: () => Navigator.pop(dialogContext, false),
                                              child: const Text("취소"),
                                            ),
                                            TextButton(
                                              onPressed: () => Navigator.pop(dialogContext, true),
                                              child: const Text("삭제", style: TextStyle(color: Colors.red)),
                                            ),
                                          ],
                                        ),
                                      );
                                      if (confirmed == true && mounted) {
                                        final ok = await widget.onDeletePost?.call(post.id) ?? false;
                                        if (!mounted) return;
                                        if (ok) {
                                          Navigator.pop(context);
                                        } else {
                                          final msg = ref.read(tourstarControllerProvider).statusMessage;
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(content: Text(msg.isNotEmpty ? msg : "게시글 삭제에 실패했습니다.")),
                                          );
                                        }
                                      }
                                    }
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(value: "edit", child: Row(children: [
                                      Icon(Icons.edit_outlined, size: 18, color: _kPurple),
                                      SizedBox(width: 8),
                                      Text("수정", style: TextStyle(color: _kPurple, fontWeight: FontWeight.w600)),
                                    ])),
                                    PopupMenuItem(value: "delete", child: Row(children: [
                                      Icon(Icons.delete_outline, size: 18, color: Colors.red),
                                      SizedBox(width: 8),
                                      Text("삭제", style: TextStyle(color: Colors.red)),
                                    ])),
                                  ],
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
                              Text("댓글 ${post.comments.length}", style: const TextStyle(color: _kGray500, fontSize: 13)),
                              const SizedBox(width: 20),
                              const Icon(Icons.photo_library_outlined, size: 18, color: _kGray400),
                              const SizedBox(width: 4),
                              Text("사진 ${post.photoUrls.length}장", style: const TextStyle(color: _kGray500, fontSize: 13)),
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
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.share_outlined, size: 14, color: _kPurple),
                                      SizedBox(width: 4),
                                      Text("공유", style: TextStyle(fontSize: 12, color: _kPurple, fontWeight: FontWeight.w600)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 28, color: _kGray100),
                          Text(
                            "댓글 ${post.comments.length}개",
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _kGray700),
                          ),
                          const SizedBox(height: 8),
                          if (post.comments.isEmpty)
                            const Text("첫 댓글을 남겨보세요.", style: TextStyle(fontSize: 12, color: _kGray400))
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
                                    hintText: "댓글을 입력하세요",
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
                                  child: const Text("등록", style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
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

  Widget _buildRankedPreview(String sourceImage) {
    final resolved = TourstarRepository.toDisplayImageUrl(sourceImage);
    if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
      return Image.network(
        resolved,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Center(
          child: Icon(Icons.image_outlined, color: _kGray400),
        ),
      );
    }
    return Image.file(
      File(sourceImage),
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const Center(
        child: Icon(Icons.image_outlined, color: _kGray400),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _openGroup = _mbtiGroups.first.title;
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
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
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "새 여행 기록 만들기",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _kGray800,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          "AI가 잘 나온 사진을 자동으로 추려드려요 ✨",
                          style: TextStyle(fontSize: 12, color: _kGray400),
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
                child: Text(
                  state.statusMessage,
                  style: const TextStyle(
                    fontSize: 12,
                    color: _kPurple,
                    fontWeight: FontWeight.w500,
                  ),
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
                          "사진 (${state.pickedFiles.length}장 선택됨)",
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
                                  state.loading ? "처리중..." : "사진 선택",
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
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: state.loading ||
                                    state.pickedFiles.isEmpty
                                ? null
                                : () async {
                                    final now = DateTime.now();
                                    final picked = await showDateRangePicker(
                                      context: context,
                                      firstDate:
                                          DateTime(now.year - 10),
                                      lastDate:
                                          DateTime(now.year + 1),
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
                                  ? "${state.filterStartDate!.month}/${state.filterStartDate!.day}"
                                      " ~ "
                                      "${state.filterEndDate?.month}/${state.filterEndDate?.day}"
                                      " (${state.filteredPickedFiles.length}장)"
                                  : "기간 선택",
                              style: const TextStyle(fontSize: 12),
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
                            child: const Text(
                              "해제",
                              style: TextStyle(
                                fontSize: 12,
                                color: _kGray500,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    // Upload button
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.loading || state.pickedFiles.isEmpty
                            ? null
                            : ctrl.uploadAndAnalyze,
                        icon: const Icon(
                          Icons.cloud_upload_outlined,
                          size: 18,
                        ),
                        label: const Text(
                          "업로드 + AI 분석",
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: _kPurple,
                          padding:
                              const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                    // Ranked images
                    if (state.rankedImages.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Text(
                            "AI 랭킹 결과",
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _kGray700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            "${state.selectedImagePaths.length}/${state.rankedImages.length} 선택",
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
                    const Text(
                      "한줄 코멘트",
                      style: TextStyle(
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
                              hintText:
                                  "간단한 코멘트만 남기면 AI가 예쁘게 작성해드려요",
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
                            const Text(
                              "자동",
                              style: TextStyle(
                                fontSize: 9,
                                color: _kPurple,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    // ── MBTI ────────────────────────────────
                    const SizedBox(height: 16),
                    const Text(
                      "문체 프리셋 (MBTI)",
                      style: TextStyle(
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
                                "자동 (기본)",
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
                                () => _openGroup = _openGroup == group.title
                                    ? null
                                    : group.title,
                              ),
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  children: [
                                    Text(
                                      group.title,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: _kGray500,
                                      ),
                                    ),
                                    const Spacer(),
                                    Icon(
                                      _openGroup == group.title
                                          ? Icons.expand_less
                                          : Icons.expand_more,
                                      size: 16,
                                      color: _kGray400,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (_openGroup == group.title) ...[
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
                    const Text(
                      "공개 설정",
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kGray700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _VisibilityBtn(
                          label: "공개",
                          icon: Icons.public,
                          selected: _visibility == "public",
                          onTap: () =>
                              setState(() => _visibility = "public"),
                        ),
                        const SizedBox(width: 10),
                        _VisibilityBtn(
                          label: "비공개",
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
                                final ok =
                                    await ctrl.publishPost(visibility: _visibility);
                                if (ok && mounted) Navigator.pop(context);
                              },
                        style: FilledButton.styleFrom(
                          backgroundColor: _kPurple,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          state.loading ? "게시중..." : "게시하기",
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
        SnackBar(content: Text("사진은 최대 $_maxPhotos장까지 추가할 수 있습니다.")),
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
    final title = _titleCtrl.text.trim();
    final location = _locationCtrl.text.trim();
    final comment = _commentCtrl.text.trim();
    final tags = _tagsCtrl.text
        .split(",")
        .map((t) => t.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("제목을 입력해 주세요.")));
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
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("새 사진 업로드에 실패했습니다.")),
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
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("수정에 실패했습니다.")));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("저장 중 오류: $e")),
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
                      errorBuilder: (_, __, ___) => Container(
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
                errorBuilder: (_, __, ___) => Container(
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
                  "사진 추가",
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
            const Text("사진", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kGray700)),
            const Spacer(),
            Text(
              "${_keepUrls.length + _newFiles.length}/$_maxPhotos",
              style: const TextStyle(fontSize: 11, color: _kGray400),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          "× 를 눌러 삭제 · 갤러리에서 새 사진을 추가할 수 있습니다.",
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
                  const Expanded(
                    child: Text(
                      "게시물 수정",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _kGray800),
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
                    _field("제목", _titleCtrl),
                    _field("장소", _locationCtrl),
                    _field("내용", _commentCtrl, maxLines: 5),
                    _photoSection(),
                    _field("태그 (쉼표로 구분)", _tagsCtrl),
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
                      : const Text("저장하기", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
