import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";
import "package:url_launcher/url_launcher.dart";

import "../../core/router/main_shell.dart";
import "state/news_context.dart";

const _primary = Color(0xFF7C3AED);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

// ── 카테고리 스타일 ─────────────────────────────────────────────
const _catStyles = <String, Map<String, dynamic>>{
  "공연/콘서트": {"bg": Color(0xFFfce7f3), "text": Color(0xFFbe185d), "emoji": "🎤"},
  "드라마/영화": {"bg": Color(0xFFf3e8ff), "text": Color(0xFF7e22ce), "emoji": "🎬"},
  "K-pop/아이돌": {"bg": Color(0xFFffe4e6), "text": Color(0xFFbe123c), "emoji": "⭐"},
  "축제/전시": {"bg": Color(0xFFfef3c7), "text": Color(0xFF92400e), "emoji": "🎨"},
  "장소/핫플": {"bg": Color(0xFFdcfce7), "text": Color(0xFF15803d), "emoji": "📍"},
};

Map<String, dynamic> _getCatStyle(String cat) =>
    _catStyles[cat] ?? {"bg": const Color(0xFFf3f4f6), "text": const Color(0xFF4b5563), "emoji": "📰"};

// ── 카드 그라데이션 (뉴스 썸네일 없을 때) ─────────────────────────
const _cardGradients = [
  [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
  [Color(0xFFEC4899), Color(0xFFDB2777)],
  [Color(0xFF0EA5E9), Color(0xFF2563EB)],
  [Color(0xFFF59E0B), Color(0xFFEA580C)],
  [Color(0xFF10B981), Color(0xFF0D9488)],
  [Color(0xFFA855F7), Color(0xFFEC4899)],
  [Color(0xFF6366F1), Color(0xFF8B5CF6)],
  [Color(0xFFF43F5E), Color(0xFFEC4899)],
  [Color(0xFF22D3EE), Color(0xFF0EA5E9)],
  [Color(0xFF84CC16), Color(0xFF16A34A)],
];

// ── 바로가기 6개 ───────────────────────────────────────────────
const _shortcuts = [
  {"label": "여행 플래너", "emoji": "🗺️", "path": "/planner"},
  {"label": "K-콘텐츠", "emoji": "🎵", "path": "/planner/k-content"},
  {"label": "일정 관리", "emoji": "📅", "path": "/planner/schedule"},
  {"label": "장소 추천", "emoji": "📍", "path": "/planner/standard"},
  {"label": "유저 루트", "emoji": "👥", "path": "/planner/user-content"},
  {"label": "단체 채팅", "emoji": "💬", "path": "/group-chat"},
];

// ── K-콘텐츠 테마 ─────────────────────────────────────────────
const _kThemes = [
  {"label": "K-POP", "emoji": "🎤", "color": Color(0xFFfff1f2), "border": Color(0xFFfecdd3), "text": Color(0xFFbe123c)},
  {"label": "K-DRAMA", "emoji": "🎬", "color": Color(0xFFfaf5ff), "border": Color(0xFFe9d5ff), "text": Color(0xFF7e22ce)},
  {"label": "K-FOOD", "emoji": "🍜", "color": Color(0xFFfffbeb), "border": Color(0xFFfde68a), "text": Color(0xFF92400e)},
  {"label": "K-BEAUTY", "emoji": "💄", "color": Color(0xFFfdf2f8), "border": Color(0xFFfbcfe8), "text": Color(0xFF9d174d)},
];

// ── 인기 여행지 ───────────────────────────────────────────────
const _popularDests = [
  {"name": "서울", "slug": "seoul", "emoji": "🏙️", "colors": [Color(0xFF6366F1), Color(0xFF8B5CF6)]},
  {"name": "부산", "slug": "busan", "emoji": "🌊", "colors": [Color(0xFF22D3EE), Color(0xFF2563EB)]},
  {"name": "제주", "slug": "jeju", "emoji": "🌿", "colors": [Color(0xFF10B981), Color(0xFF0D9488)]},
  {"name": "경주", "slug": "gyeongju", "emoji": "🏯", "colors": [Color(0xFFF59E0B), Color(0xFFEA580C)]},
  {"name": "강릉", "slug": "gangneung", "emoji": "🌅", "colors": [Color(0xFFF43F5E), Color(0xFFEC4899)]},
  {"name": "전주", "slug": "jeonju", "emoji": "🎎", "colors": [Color(0xFFEAB308), Color(0xFFF59E0B)]},
];

// ── 시골 환급 지역 ─────────────────────────────────────────────
const _ruralRegions = [
  {
    "province": "강원", "emoji": "🏔️",
    "cities": [
      {"name": "평창", "slug": "pyeongchang"},
      {"name": "영월", "slug": "yeongwol"},
      {"name": "횡성", "slug": "hoengseong"},
    ],
  },
  {
    "province": "충북", "emoji": "🌾",
    "cities": [{"name": "제천", "slug": "jecheon"}],
  },
  {
    "province": "전북", "emoji": "🎎",
    "cities": [{"name": "고창", "slug": "gochang"}],
  },
  {
    "province": "전남", "emoji": "🌊",
    "cities": [
      {"name": "강진", "slug": "gangjin"},
      {"name": "영광", "slug": "yeonggwang"},
      {"name": "해남", "slug": "haenam"},
      {"name": "고흥", "slug": "goheung"},
      {"name": "완도", "slug": "wando"},
      {"name": "영암", "slug": "yeongam"},
    ],
  },
  {
    "province": "경남", "emoji": "🌸",
    "cities": [
      {"name": "밀양", "slug": "miryang"},
      {"name": "하동", "slug": "hadong"},
      {"name": "합천", "slug": "hapcheon"},
      {"name": "거창", "slug": "geochang"},
      {"name": "남해", "slug": "namhae"},
    ],
  },
];

const _visitKoreaUrl = "https://www.visitkorea.or.kr";

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  bool _rebateOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(newsContextProvider.notifier).loadTop10();
    });
  }

  @override
  Widget build(BuildContext context) {
    final newsState = ref.watch(newsContextProvider);

    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: const Text(
          "Kroaddy",
          style: TextStyle(color: _primary, fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ══════════════════════════════════════════════════
            // 1. 뉴스 배너 캐러셀
            // ══════════════════════════════════════════════════
            if (newsState.loading)
              _BannerSkeleton()
            else if (newsState.items.isEmpty)
              Container(
                margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      "📰",
                      style: TextStyle(fontSize: 28),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      newsState.message.isNotEmpty
                          ? newsState.message
                          : "아직 AI 분석이 진행 중입니다.",
                      style: const TextStyle(color: _textSecondary, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => ref.read(newsContextProvider.notifier).loadTop10(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: _primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          "다시 시도",
                          style: TextStyle(color: _primary, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              )
            else
              _NewsBannerCarousel(items: newsState.items),

            const SizedBox(height: 20),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ══════════════════════════════════════════
                  // 2. 바로가기 6개
                  // ══════════════════════════════════════════
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: _shortcuts.map((s) {
                      final path = s["path"] as String;
                      return GestureDetector(
                        onTap: () {
                          if (path == "/group-chat") {
                            context.push("/chat");
                          } else if (path == "/planner/standard") {
                            context.push("/planner");
                          } else {
                            context.go(path);
                          }
                        },
                        child: Column(
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
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Text(s["emoji"] as String, style: const TextStyle(fontSize: 22)),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              s["label"] as String,
                              style: const TextStyle(fontSize: 10, color: _textSecondary, fontWeight: FontWeight.w500),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),

                  // ══════════════════════════════════════════
                  // 시골 여행 반값 환급
                  // ══════════════════════════════════════════
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFecfdf5), Colors.white, Color(0xFFf0fdfa)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFa7f3d0)),
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
                        const Text(
                          "2026.4 ~ 6 · 시범사업",
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF059669), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          "🎫 지정 시골 지역 여행 시 최대 50% 환급",
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
                        ),
                        const SizedBox(height: 4),
                        RichText(
                          text: const TextSpan(
                            style: TextStyle(fontSize: 11, color: _textSecondary, height: 1.4),
                            children: [
                              TextSpan(text: "여행 지출의 "),
                              TextSpan(
                                text: "절반",
                                style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                              ),
                              TextSpan(text: "을 모바일 지역사랑 상품권으로 돌려받을 수 있어요. 개인 최대 "),
                              TextSpan(
                                text: "10만 원",
                                style: TextStyle(fontWeight: FontWeight.bold, color: _textPrimary),
                              ),
                              TextSpan(text: ", 2인 이상 단체 최대 "),
                              TextSpan(
                                text: "20만 원",
                                style: TextStyle(fontWeight: FontWeight.bold, color: _textPrimary),
                              ),
                              TextSpan(text: "."),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () async {
                                  final uri = Uri.parse(_visitKoreaUrl);
                                  try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF059669),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Center(
                                    child: Text(
                                      "대한민국 구석구석 ↗",
                                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => setState(() => _rebateOpen = !_rebateOpen),
                              child: Text(
                                _rebateOpen ? "접기" : "이용 방법 보기",
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF059669),
                                  fontWeight: FontWeight.w600,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_rebateOpen) ...[
                          const SizedBox(height: 12),
                          Container(height: 1, color: const Color(0xFFd1fae5)),
                          const SizedBox(height: 12),
                          ..._buildRebateSteps(),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFBEB),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              "⚠️ 사전 신청·승인 필수 · 예산 한도로 조기 마감될 수 있음 · 세부는 지자체마다 다를 수 있으니 4월 초 공식 사이트를 꼭 확인하세요.",
                              style: TextStyle(fontSize: 10, color: Color(0xFF92400E), height: 1.4),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            "대상 지역 16곳 · 플래너로 루트 보기",
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 8),
                          ..._ruralRegions.map((region) {
                            final cities = (region["cities"] as List).cast<Map<String, dynamic>>();
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "${region["emoji"]} ${region["province"]}",
                                    style: const TextStyle(fontSize: 10, color: _textSecondary, fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: cities.map((c) => GestureDetector(
                                      onTap: () => context.push("/planner"),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFa7f3d0)),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withValues(alpha: 0.04),
                                              blurRadius: 4,
                                            ),
                                          ],
                                        ),
                                        child: Text(
                                          "${c["name"]} 🗺️",
                                          style: const TextStyle(fontSize: 11, color: _textPrimary, fontWeight: FontWeight.w500),
                                        ),
                                      ),
                                    )).toList(),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ══════════════════════════════════════════
                  // 3. K-콘텐츠 테마
                  // ══════════════════════════════════════════
                  _SectionHeader(
                    title: "🎭 K-콘텐츠 테마 여행",
                    actionLabel: "전체 보기",
                    onAction: () => context.push("/planner/k-content"),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: _kThemes.map((t) {
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => context.push("/planner/k-content"),
                          child: Container(
                            margin: EdgeInsets.only(
                              right: _kThemes.indexOf(t) < _kThemes.length - 1 ? 6 : 0,
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: t["color"] as Color,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: t["border"] as Color),
                            ),
                            child: Column(
                              children: [
                                Text(t["emoji"] as String, style: const TextStyle(fontSize: 22)),
                                const SizedBox(height: 4),
                                Text(
                                  t["label"] as String,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: t["text"] as Color,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),

                  // ══════════════════════════════════════════
                  // 4. 인기 여행지
                  // ══════════════════════════════════════════
                  _SectionHeader(
                    title: "📍 인기 여행지",
                    actionLabel: "더 보기",
                    onAction: () => context.push("/planner"),
                  ),
                  const SizedBox(height: 10),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      childAspectRatio: 1.15,
                    ),
                    itemCount: _popularDests.length,
                    itemBuilder: (_, i) {
                      final dest = _popularDests[i];
                      final colors = dest["colors"] as List<Color>;
                      return GestureDetector(
                        onTap: () => context.push("/planner"),
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: colors,
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: colors[0].withValues(alpha: 0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(dest["emoji"] as String, style: const TextStyle(fontSize: 28)),
                              const SizedBox(height: 4),
                              Text(
                                dest["name"] as String,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  shadows: [Shadow(color: Colors.black38, blurRadius: 4)],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildRebateSteps() {
    const steps = [
      ("사전 신청", "visitkorea.or.kr에서 대상 지역 확인 후 여행 전 승인을 받으세요."),
      ("여행", "승인 지역에서 식비·숙박 등 지출 (영수증 보관)."),
      ("증빙 제출", "여행 후 지자체 안내에 따라 영수증 등 제출."),
      ("환급", "확인 후 지출의 50%를 모바일 지역사랑 상품권으로 지급."),
      ("사용", "해당 지역 식당·카페·온라인몰 등에서 올해 안에 사용."),
    ];
    return steps.asMap().entries.map((entry) {
      final i = entry.key + 1;
      final (title, desc) = entry.value;
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                color: Color(0xFFa7f3d0),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text("$i", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065f46))),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 11, color: _textSecondary, height: 1.4),
                  children: [
                    TextSpan(text: title, style: const TextStyle(fontWeight: FontWeight.bold, color: _textPrimary)),
                    TextSpan(text: " — $desc"),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }).toList();
  }
}

// ── 섹션 헤더 ───────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.actionLabel, this.onAction});
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary)),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              "$actionLabel →",
              style: const TextStyle(fontSize: 11, color: _textSecondary),
            ),
          ),
      ],
    );
  }
}

// ── 뉴스 배너 캐러셀 ────────────────────────────────────────────
class _NewsBannerCarousel extends StatefulWidget {
  const _NewsBannerCarousel({required this.items});
  final List<SlimNewsItem> items;

  @override
  State<_NewsBannerCarousel> createState() => _NewsBannerCarouselState();
}

class _NewsBannerCarouselState extends State<_NewsBannerCarousel> {
  final _pageController = PageController(viewportFraction: 0.88);
  int _page = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted) return;
      final next = (_page + 1) % widget.items.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 200,
          child: PageView.builder(
            controller: _pageController,
            itemCount: widget.items.length,
            onPageChanged: (i) {
              setState(() => _page = i);
              _startTimer();
            },
            itemBuilder: (context, i) {
              final item = widget.items[i];
              final rank = i + 1;
              final catStyle = _getCatStyle(item.category);
              final gradColors = _cardGradients[i % _cardGradients.length];

              return GestureDetector(
                onTap: () async {
                  if (item.link.isNotEmpty) {
                    final uri = Uri.parse(item.link);
                    try { await launchUrl(uri, mode: LaunchMode.externalApplication); } catch (_) {}
                  }
                },
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(colors: gradColors, begin: Alignment.topLeft, end: Alignment.bottomRight),
                    boxShadow: [
                      BoxShadow(color: gradColors[0].withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        // 썸네일
                        if (item.thumbnail.isNotEmpty)
                          Image.network(
                            item.thumbnail,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                          ),
                        // 그라디언트 오버레이
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              stops: [0.3, 1.0],
                              colors: [Colors.transparent, Color(0xCC000000)],
                            ),
                          ),
                        ),
                        // 순위 배지
                        Positioned(
                          top: 10,
                          left: 10,
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: rank <= 3 ? const Color(0xFFFBBF24) : Colors.black54,
                            ),
                            child: Center(
                              child: Text(
                                "$rank",
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900),
                              ),
                            ),
                          ),
                        ),
                        // 카테고리 배지
                        Positioned(
                          top: 10,
                          right: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: catStyle["bg"] as Color,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              catStyle["emoji"] as String,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                        // 하단 텍스트
                        Positioned(
                          bottom: 12,
                          left: 12,
                          right: 12,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (item.location.isNotEmpty && item.location != "전국")
                                Text(
                                  "📍 ${item.location}",
                                  style: const TextStyle(fontSize: 10, color: Colors.white70),
                                ),
                              Text(
                                item.title,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Text(item.source, style: const TextStyle(fontSize: 10, color: Colors.white70)),
                                  const Text(" · ", style: TextStyle(fontSize: 10, color: Colors.white54)),
                                  Text(item.published.length >= 10 ? item.published.substring(0, 10) : item.published,
                                      style: const TextStyle(fontSize: 10, color: Colors.white54)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        // 도트 인디케이터
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ...List.generate(
              (widget.items.length / 2).ceil().clamp(0, 6),
              (i) {
                final active = ((_page) ~/ 1) == i * 2 || (i * 2 + 1) == _page;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  width: active ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    color: active ? _primary : Colors.grey.shade300,
                  ),
                );
              },
            ),
            const SizedBox(width: 6),
            Text(
              "${_page + 1}/${widget.items.length}",
              style: const TextStyle(fontSize: 10, color: _textSecondary),
            ),
          ],
        ),
      ],
    );
  }
}

// ── 배너 스켈레톤 ────────────────────────────────────────────────
class _BannerSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 200,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: List.generate(2, (i) => Container(
          width: MediaQuery.of(context).size.width * 0.8,
          margin: const EdgeInsets.only(right: 12, top: 4, bottom: 4),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(16),
          ),
        )),
      ),
    );
  }
}
