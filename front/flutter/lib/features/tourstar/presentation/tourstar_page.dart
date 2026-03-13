import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/router/main_shell.dart";
import "state/tourstar_controller.dart";

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
const _kGreen = Color(0xFF10B981);

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

// ── Local post model ─────────────────────────────────────────
class _TourPost {
  _TourPost({
    required this.id,
    required this.title,
    required this.location,
    required this.date,
    required this.comment,
    required this.tags,
    required this.photoFiles,
    this.visibility = "public",
    this.likes = 0,
    this.liked = false,
    this.comments = const [],
  });

  final String id;
  final String title;
  final String location;
  final String date;
  final String comment;
  final List<String> tags;
  final List<XFile> photoFiles;
  String visibility;
  int likes;
  bool liked;
  List<String> comments;
}

// ═════════════════════════════════════════════════════════════
class TourstarPage extends ConsumerStatefulWidget {
  const TourstarPage({super.key});

  @override
  ConsumerState<TourstarPage> createState() => _TourstarPageState();
}

class _TourstarPageState extends ConsumerState<TourstarPage> {
  final List<_TourPost> _posts = [];
  String _filter = "all";
  bool _gridView = false;

  List<_TourPost> get _filtered {
    if (_filter == "all") return _posts;
    return _posts.where((p) => p.visibility == _filter).toList();
  }

  Map<String, int> get _stats => {
        "total": _posts.length,
        "photos": _posts.fold(0, (a, p) => a + p.photoFiles.length),
        "likes": _posts.fold(0, (a, p) => a + p.likes),
        "public": _posts.where((p) => p.visibility == "public").length,
      };

  void _toggleLike(String id) {
    setState(() {
      for (final p in _posts) {
        if (p.id == id) {
          p.liked = !p.liked;
          p.likes += p.liked ? 1 : -1;
        }
      }
    });
  }

  void _toggleVisibility(String id) {
    setState(() {
      for (final p in _posts) {
        if (p.id == id) {
          p.visibility = p.visibility == "public" ? "private" : "public";
        }
      }
    });
  }

  void _addComment(String id, String content) {
    setState(() {
      for (final p in _posts) {
        if (p.id == id) {
          p.comments = [...p.comments, content];
        }
      }
    });
  }

  void _openDetail(_TourPost post) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PostDetailSheet(
        post: post,
        onLike: (id) { _toggleLike(id); setState(() {}); },
        onToggleVisibility: (id) { _toggleVisibility(id); setState(() {}); },
        onAddComment: (id, c) { _addComment(id, c); setState(() {}); },
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
      builder: (_) => _CreatePostSheet(
        onCreated: (post) => setState(() => _posts.insert(0, post)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stats = _stats;
    final filtered = _filtered;

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
              padding: const EdgeInsets.all(20),
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
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_kPurple2, _kPink],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: _kPurple2.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        "T",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "내 여행기록",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: _kGray800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          "소중한 여행의 순간들을 기록하세요",
                          style: TextStyle(fontSize: 11, color: _kGray400),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _StatItem(
                              value: "${stats['total']}",
                              label: "게시물",
                            ),
                            const SizedBox(width: 20),
                            _StatItem(
                              value: "${stats['photos']}",
                              label: "사진",
                            ),
                            const SizedBox(width: 20),
                            _StatItem(
                              value: "${stats['likes']}",
                              label: "좋아요",
                              color: _kPink,
                            ),
                            const SizedBox(width: 20),
                            _StatItem(
                              value: "${stats['public']}",
                              label: "공개",
                              color: _kGreen,
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

          // ── Filter / View Toggle ─────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final tab in [
                            ("all", "전체"),
                            ("public", "공개"),
                            ("private", "비공개"),
                          ])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: GestureDetector(
                                onTap: () =>
                                    setState(() => _filter = tab.$1),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 7,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _filter == tab.$1
                                        ? _kPurpleLight
                                        : Colors.white,
                                    border: Border.all(
                                      color: _filter == tab.$1
                                          ? const Color(0xFFD8B4FE)
                                          : _kGray200,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    tab.$2,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: _filter == tab.$1
                                          ? _kPurple
                                          : _kGray500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          Text(
                            "${filtered.length}개의 기록",
                            style: const TextStyle(
                              fontSize: 12,
                              color: _kGray400,
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
                        _ViewToggleBtn(
                          icon: Icons.view_stream,
                          active: !_gridView,
                          onTap: () => setState(() => _gridView = false),
                        ),
                        _ViewToggleBtn(
                          icon: Icons.grid_view,
                          active: _gridView,
                          onTap: () => setState(() => _gridView = true),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Posts ────────────────────────────────────────
          if (filtered.isEmpty)
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
                  (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _FeedCard(
                      post: filtered[i],
                      onTap: () => _openDetail(filtered[i]),
                      onLike: _toggleLike,
                    ),
                  ),
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
        label: const Text("새 기록"),
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
            '"새 기록" 버튼으로 첫 번째 여행을 기록해보세요',
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
    required this.onLike,
  });
  final _TourPost post;
  final VoidCallback onTap;
  final void Function(String) onLike;

  @override
  Widget build(BuildContext context) {
    final firstPhoto =
        post.photoFiles.isNotEmpty ? post.photoFiles.first : null;
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
                    child: firstPhoto != null
                        ? Image.file(
                            File(firstPhoto.path),
                            fit: BoxFit.cover,
                            width: double.infinity,
                          )
                        : Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [_kPurple2, _kPink],
                              ),
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.photo,
                                size: 40,
                                color: Colors.white54,
                              ),
                            ),
                          ),
                  ),
                  Positioned(
                    top: 10,
                    left: 10,
                    child: _Badge(
                      label: post.visibility == "public" ? "공개" : "비공개",
                      color: post.visibility == "public"
                          ? _kGreen
                          : _kGray700.withValues(alpha: 0.8),
                    ),
                  ),
                  if (post.photoFiles.length > 1)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: _Badge(
                        label: "${post.photoFiles.length}",
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          post.title,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: _kGray800,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => onLike(post.id),
                        child: Row(
                          children: [
                            Icon(
                              post.liked
                                  ? Icons.favorite
                                  : Icons.favorite_border,
                              size: 16,
                              color: post.liked ? _kPink : _kGray400,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              "${post.likes}",
                              style: TextStyle(
                                fontSize: 11,
                                color: post.liked ? _kPink : _kGray400,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
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
                      Text(
                        post.location,
                        style: const TextStyle(
                          fontSize: 11,
                          color: _kGray500,
                        ),
                      ),
                      const Text(
                        " · ",
                        style: TextStyle(color: _kGray400),
                      ),
                      Text(
                        post.date,
                        style:
                            const TextStyle(fontSize: 11, color: _kGray400),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    post.comment,
                    style: const TextStyle(
                      fontSize: 12,
                      color: _kGray700,
                      height: 1.5,
                    ),
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: _kGray100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                "#$tag",
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: _kGray700,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.chat_bubble_outline,
                        size: 12,
                        color: _kGray400,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        "댓글 ${post.comments.length}",
                        style:
                            const TextStyle(fontSize: 11, color: _kGray500),
                      ),
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

// ── Grid Card ────────────────────────────────────────────────
class _GridCard extends StatelessWidget {
  const _GridCard({required this.post, required this.onTap});
  final _TourPost post;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final firstPhoto =
        post.photoFiles.isNotEmpty ? post.photoFiles.first : null;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            firstPhoto != null
                ? Image.file(File(firstPhoto.path), fit: BoxFit.cover)
                : Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_kPurple2, _kPink],
                      ),
                    ),
                  ),
            Positioned(
              top: 4,
              left: 4,
              child: _Badge(
                label: post.visibility == "public" ? "공개" : "비공개",
                color: post.visibility == "public" ? _kGreen : Colors.black54,
                fontSize: 8,
              ),
            ),
            if (post.photoFiles.length > 1)
              Positioned(
                top: 4,
                right: 4,
                child: _Badge(
                  label: "+${post.photoFiles.length}",
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
// Post Detail Sheet
// ══════════════════════════════════════════════════════════════
class _PostDetailSheet extends StatefulWidget {
  const _PostDetailSheet({
    required this.post,
    required this.onLike,
    required this.onToggleVisibility,
    required this.onAddComment,
  });
  final _TourPost post;
  final void Function(String) onLike;
  final void Function(String) onToggleVisibility;
  final void Function(String, String) onAddComment;

  @override
  State<_PostDetailSheet> createState() => _PostDetailSheetState();
}

class _PostDetailSheetState extends State<_PostDetailSheet> {
  int _photoIdx = 0;
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
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
                          child: post.photoFiles.isNotEmpty
                              ? Image.file(
                                  File(post.photoFiles[_photoIdx].path),
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                )
                              : Container(
                                  decoration: const BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [_kPurple2, _kPink],
                                    ),
                                  ),
                                ),
                        ),
                        if (post.photoFiles.length > 1) ...[
                          Positioned(
                            left: 8,
                            top: 0,
                            bottom: 0,
                            child: Center(
                              child: IconButton(
                                onPressed: () => setState(
                                  () => _photoIdx = (_photoIdx - 1 +
                                          post.photoFiles.length) %
                                      post.photoFiles.length,
                                ),
                                icon: const Icon(
                                  Icons.chevron_left,
                                  color: Colors.white,
                                  size: 32,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.black38,
                                ),
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
                                  () => _photoIdx = (_photoIdx + 1) %
                                      post.photoFiles.length,
                                ),
                                icon: const Icon(
                                  Icons.chevron_right,
                                  color: Colors.white,
                                  size: 32,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.black38,
                                ),
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
                                post.photoFiles.length,
                                (i) => AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: i == _photoIdx ? 16 : 6,
                                  height: 6,
                                  margin: const EdgeInsets.symmetric(
                                    horizontal: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: i == _photoIdx
                                        ? Colors.white
                                        : Colors.white54,
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
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  post.title,
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: _kGray800,
                                  ),
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  widget.onToggleVisibility(post.id);
                                  setState(() {});
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: post.visibility == "public"
                                        ? const Color(0xFFECFDF5)
                                        : _kGray100,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: post.visibility == "public"
                                          ? const Color(0xFF6EE7B7)
                                          : _kGray200,
                                    ),
                                  ),
                                  child: Text(
                                    post.visibility == "public"
                                        ? "공개"
                                        : "비공개",
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: post.visibility == "public"
                                          ? const Color(0xFF059669)
                                          : _kGray500,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_outlined,
                                size: 14,
                                color: _kGray400,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                post.location,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: _kGray500,
                                ),
                              ),
                              const Text(
                                " · ",
                                style: TextStyle(color: _kGray400),
                              ),
                              Text(
                                post.date,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: _kGray400,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            post.comment,
                            style: const TextStyle(
                              fontSize: 14,
                              color: _kGray700,
                              height: 1.6,
                            ),
                          ),
                          if (post.tags.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: post.tags
                                  .map(
                                    (tag) => Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _kPurpleLight,
                                        borderRadius:
                                            BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        "#$tag",
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: _kPurple,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              GestureDetector(
                                onTap: () {
                                  widget.onLike(post.id);
                                  setState(() {});
                                },
                                child: Row(
                                  children: [
                                    Icon(
                                      post.liked
                                          ? Icons.favorite
                                          : Icons.favorite_border,
                                      color:
                                          post.liked ? _kPink : _kGray400,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      "${post.likes}",
                                      style: TextStyle(
                                        color:
                                            post.liked ? _kPink : _kGray400,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 20),
                              const Icon(
                                Icons.chat_bubble_outline,
                                size: 18,
                                color: _kGray400,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                "댓글 ${post.comments.length}",
                                style: const TextStyle(
                                  color: _kGray500,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(width: 20),
                              const Icon(
                                Icons.photo_library_outlined,
                                size: 18,
                                color: _kGray400,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                "사진 ${post.photoFiles.length}장",
                                style: const TextStyle(
                                  color: _kGray500,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 28, color: _kGray100),
                          Text(
                            "댓글 ${post.comments.length}개",
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _kGray700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (post.comments.isEmpty)
                            const Text(
                              "첫 댓글을 남겨보세요.",
                              style: TextStyle(fontSize: 12, color: _kGray400),
                            )
                          else
                            ...post.comments.map(
                              (c) => Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: _kGray100,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  c,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _kGray700,
                                  ),
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
                                    hintStyle: const TextStyle(
                                      color: _kGray400,
                                      fontSize: 13,
                                    ),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(
                                        color: _kGray200,
                                      ),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 10,
                                    ),
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
                                  setState(() {});
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _kPurple,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    "등록",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
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
  const _CreatePostSheet({required this.onCreated});
  final void Function(_TourPost) onCreated;

  @override
  ConsumerState<_CreatePostSheet> createState() => _CreatePostSheetState();
}

class _CreatePostSheetState extends ConsumerState<_CreatePostSheet> {
  String _visibility = "public";
  String? _openGroup;
  final _commentCtrl = TextEditingController();

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
                                      child: Image.file(
                                        File(img.sourceImage),
                                        fit: BoxFit.cover,
                                        errorBuilder: (ctx0, err0, trace0) =>
                                            const Center(
                                          child: Icon(
                                            Icons.image_outlined,
                                            color: _kGray400,
                                          ),
                                        ),
                                      ),
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
                    // ── Generated result ─────────────────────
                    if (state.generatedPost != null) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFFF5F3FF),
                              Color(0xFFFCE7F3),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFFEDE9FE),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.auto_awesome,
                                  color: _kPurple,
                                  size: 16,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  "AI 생성 결과",
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: _kPurple,
                                  ),
                                ),
                              ],
                            ),
                            const Divider(
                              height: 16,
                              color: Color(0xFFEDE9FE),
                            ),
                            Text(
                              state.generatedPost!.title,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: _kGray800,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.location_on_outlined,
                                  size: 14,
                                  color: _kGray400,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  state.generatedPost!.location,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _kGray500,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              state.generatedPost!.comment,
                              style: const TextStyle(
                                fontSize: 13,
                                color: _kGray700,
                                height: 1.6,
                              ),
                            ),
                            if (state.generatedPost!.tags.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: state.generatedPost!.tags
                                    .map(
                                      (tag) => Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius:
                                              BorderRadius.circular(20),
                                          border: Border.all(
                                            color:
                                                const Color(0xFFD8B4FE),
                                          ),
                                        ),
                                        child: Text(
                                          "#$tag",
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: _kPurple,
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    // ── Actions ──────────────────────────────
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed:
                                state.loading ? null : ctrl.generatePost,
                            icon: const Icon(Icons.auto_awesome, size: 16),
                            label: Text(
                              state.loading ? "생성중..." : "AI 게시글 생성",
                              style: const TextStyle(fontSize: 14),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: _kPurple,
                              side: const BorderSide(color: _kPurple),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        if (state.generatedPost != null) ...[
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton(
                              onPressed: () {
                                final gp = state.generatedPost!;
                                final post = _TourPost(
                                  id: DateTime.now()
                                      .millisecondsSinceEpoch
                                      .toString(),
                                  title: gp.title,
                                  location: gp.location,
                                  date: DateTime.now()
                                      .toString()
                                      .substring(0, 10),
                                  comment: gp.comment,
                                  tags: gp.tags,
                                  photoFiles: state.pickedFiles,
                                  visibility: _visibility,
                                );
                                widget.onCreated(post);
                                Navigator.pop(context);
                              },
                              style: FilledButton.styleFrom(
                                backgroundColor: _kPurple,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text(
                                "게시하기",
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
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
