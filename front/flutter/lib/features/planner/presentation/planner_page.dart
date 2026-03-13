import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/router/main_shell.dart";
import "../data/planner_models.dart";
import "../data/user_content_models.dart";
import "state/k_content_controller.dart";
import "state/planner_controller.dart";
import "state/user_content_controller.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

// ── 주요 여행지 데이터 ─────────────────────────────────────────
class _Destination {
  const _Destination(this.slug, this.name, this.emoji, this.highlight);
  final String slug;
  final String name;
  final String emoji;
  final String highlight;
}

const _metroCities = [
  _Destination("seoul", "서울", "🏙", "한강·경복궁·홍대"),
  _Destination("busan", "부산", "🌊", "해운대·광안리"),
  _Destination("jeju", "제주", "🌋", "한라산·우도"),
  _Destination("incheon", "인천", "✈️", "차이나타운·송도"),
  _Destination("daejeon", "대전", "🔬", "성심당·엑스포"),
  _Destination("gwangju", "광주", "🎨", "양림동·5·18"),
  _Destination("daegu", "대구", "🌶", "동성로·서문시장"),
  _Destination("ulsan", "울산", "🐋", "간절곶·고래박물관"),
];

const _regions = [
  _Destination("gangwon", "강원", "⛰", "설악산·강릉·속초"),
  _Destination("gyeonggi", "경기", "🏰", "수원화성·남이섬"),
  _Destination("chungnam", "충남", "🌾", "공주·부여"),
  _Destination("chungbuk", "충북", "🏞", "단양·속리산"),
  _Destination("jeonbuk", "전북", "🍃", "전주한옥마을"),
  _Destination("jeonnam", "전남", "🌸", "순천만·여수"),
  _Destination("gyeongbuk", "경북", "🏛", "경주·안동"),
  _Destination("gyeongnam", "경남", "🌿", "통영·남해"),
  _Destination("sejong", "세종", "🏛", "정부청사·호수공원"),
];

// ── 진입점 ─────────────────────────────────────────────────────
class PlannerPage extends ConsumerWidget {
  const PlannerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: _bgPage,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.menu, color: _textPrimary),
            onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
          ),
          title: const Text(
            "여행플래너",
            style: TextStyle(
              color: _textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          bottom: const TabBar(
            labelColor: _primary,
            unselectedLabelColor: _textSecondary,
            indicatorColor: _primary,
            indicatorWeight: 3,
            tabs: [
              Tab(text: "스탠다드"),
              Tab(text: "유저 루트"),
              Tab(text: "K-콘텐츠"),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _StandardTab(),
            _UserContentTab(),
            _KContentTab(),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// STANDARD TAB
// ═══════════════════════════════════════════════════════════════
class _StandardTab extends ConsumerStatefulWidget {
  const _StandardTab();

  @override
  ConsumerState<_StandardTab> createState() => _StandardTabState();
}

class _StandardTabState extends ConsumerState<_StandardTab> {
  // 0 = 여행지 선택, 1 = 루트 & 일정
  int _step = 0;
  _Destination? _picked;

  void _selectDest(_Destination dest) {
    setState(() {
      _picked = dest;
      _step = 1;
    });
    final ctrl = ref.read(plannerControllerProvider.notifier);
    ctrl.setLocation(dest.slug);
    ctrl.fetchRoutes();
  }

  void _backToSelect() {
    setState(() {
      _step = 0;
      _picked = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_step == 0) return _DestinationSelector(onSelect: _selectDest);
    return _PlannerWorkspace(dest: _picked!, onBack: _backToSelect);
  }
}

// ── 여행지 선택 화면 ───────────────────────────────────────────
class _DestinationSelector extends StatefulWidget {
  const _DestinationSelector({required this.onSelect});
  final void Function(_Destination) onSelect;

  @override
  State<_DestinationSelector> createState() => _DestinationSelectorState();
}

class _DestinationSelectorState extends State<_DestinationSelector> {
  String _query = "";

  List<_Destination> get _all => [..._metroCities, ..._regions];

  List<_Destination> get _filtered {
    if (_query.isEmpty) return [];
    return _all
        .where(
          (d) =>
              d.name.contains(_query) ||
              d.slug.contains(_query.toLowerCase()) ||
              d.highlight.contains(_query),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // 검색
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: "도시·명소 검색 (예: 서울, 해운대, 경주)",
                hintStyle: const TextStyle(color: _textSecondary, fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: _textSecondary),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
              ),
            ),
          ),
        ),

        if (_query.isNotEmpty)
          SliverToBoxAdapter(
            child: _filtered.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text("검색 결과가 없습니다.", style: TextStyle(color: _textSecondary))),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _filtered
                          .map(
                            (d) => ActionChip(
                              label: Text("${d.emoji} ${d.name}"),
                              onPressed: () => widget.onSelect(d),
                            ),
                          )
                          .toList(),
                    ),
                  ),
          ),

        if (_query.isEmpty) ...[
          // 광역시 바로가기
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text(
                "광역시 바로가기",
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _textSecondary),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: _metroCities
                    .map(
                      (d) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ActionChip(
                          avatar: Text(d.emoji),
                          label: Text(d.name),
                          backgroundColor: Colors.white,
                          side: BorderSide(color: Colors.grey.shade200),
                          onPressed: () => widget.onSelect(d),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),

          // 광역시 그리드
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text(
                "광역시",
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                childAspectRatio: 0.9,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              delegate: SliverChildBuilderDelegate(
                (_, i) => _DestCard(dest: _metroCities[i], onTap: () => widget.onSelect(_metroCities[i])),
                childCount: _metroCities.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 16)),

          // 지역 그리드
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text(
                "전국 지역",
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                childAspectRatio: 0.9,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              delegate: SliverChildBuilderDelegate(
                (_, i) => _DestCard(dest: _regions[i], onTap: () => widget.onSelect(_regions[i])),
                childCount: _regions.length,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _DestCard extends StatelessWidget {
  const _DestCard({required this.dest, required this.onTap});
  final _Destination dest;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(dest.emoji, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 6),
            Text(
              dest.name,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 루트 & 일정 워크스페이스 ───────────────────────────────────
class _PlannerWorkspace extends ConsumerWidget {
  const _PlannerWorkspace({required this.dest, required this.onBack});
  final _Destination dest;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(plannerControllerProvider);
    final ctrl = ref.read(plannerControllerProvider.notifier);

    return Column(
      children: [
        // 헤더
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              GestureDetector(
                onTap: onBack,
                child: Row(
                  children: [
                    const Icon(Icons.chevron_left, color: _primary),
                    Text(
                      "${dest.emoji} ${dest.name}",
                      style: const TextStyle(
                        color: _primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (state.loading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
                ),
            ],
          ),
        ),
        if (state.loading) const LinearProgressIndicator(color: _primary, minHeight: 2),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // 상태 메시지
              if (state.statusMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: _primaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    state.statusMessage,
                    style: const TextStyle(fontSize: 13, color: _primary),
                  ),
                ),

              // 루트 목록
              if (state.routes.isNotEmpty) ...[
                const Text(
                  "AI 추천 루트",
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 110,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: state.routes.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final r = state.routes[i];
                      final selected = state.selectedRouteName == r.name;
                      return _RouteCard(
                        route: r,
                        selected: selected,
                        onTap: () {
                          ctrl.selectRoute(r.name);
                          ctrl.fetchSchedule();
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // 일정 타임라인
              if (state.schedule.isNotEmpty) ...[
                Row(
                  children: [
                    const Text(
                      "여행 일정",
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                    ),
                    const Spacer(),
                    Text(
                      "${state.schedule.length}개 항목",
                      style: const TextStyle(fontSize: 12, color: _textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...state.schedule.map((s) => _ScheduleCard(item: s)),
              ],

              if (state.routes.isEmpty && !state.loading)
                Center(
                  child: Column(
                    children: [
                      const SizedBox(height: 32),
                      Text(dest.emoji, style: const TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      Text(
                        "${dest.name} 여행을 AI로 계획해보세요",
                        style: const TextStyle(fontSize: 14, color: _textSecondary),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: ctrl.fetchRoutes,
                        icon: const Icon(Icons.auto_awesome),
                        label: const Text("루트 생성"),
                        style: FilledButton.styleFrom(backgroundColor: _primary),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.route, required this.selected, required this.onTap});
  final PlanRoute route;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 160,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? _primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? _primary : Colors.grey.shade200, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: selected
                  ? _primary.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected ? Colors.white.withValues(alpha: 0.2) : _primaryLight,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                route.theme,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : _primary,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              route.name,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: selected ? Colors.white : _textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              route.description,
              style: TextStyle(
                fontSize: 11,
                color: selected ? Colors.white.withValues(alpha: 0.8) : _textSecondary,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.item});
  final ScheduleItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _primaryLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "DAY ${item.day}",
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _primary,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.time,
                  style: const TextStyle(fontSize: 11, color: _textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.title,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
          ),
          const SizedBox(height: 2),
          Text(
            item.place,
            style: const TextStyle(fontSize: 12, color: _primary),
          ),
          const SizedBox(height: 4),
          Text(
            item.description,
            style: const TextStyle(fontSize: 12, color: _textSecondary),
          ),
          if (item.tips != null && item.tips!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("💡 ", style: TextStyle(fontSize: 12)),
                  Expanded(
                    child: Text(
                      item.tips!,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// USER CONTENT TAB
// ═══════════════════════════════════════════════════════════════
class _UserContentTab extends ConsumerStatefulWidget {
  const _UserContentTab();

  @override
  ConsumerState<_UserContentTab> createState() => _UserContentTabState();
}

class _UserContentTabState extends ConsumerState<_UserContentTab> {
  UserRoute? _detailRoute;
  bool _showUpload = false;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(
      () => ref.read(userContentControllerProvider.notifier).loadFeed(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);

    ref.listen<int>(
      userContentControllerProvider.select((s) => s.saveSuccessCount),
      (prev, next) {
        if (prev != null && next > prev) {
          setState(() => _showUpload = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("루트가 공유됐습니다! 🎉")),
          );
        }
      },
    );

    return Scaffold(
      backgroundColor: _bgPage,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      const Text(
                        "유저 루트 피드",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _textPrimary,
                        ),
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () => setState(() => _showUpload = true),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text("내 루트 공유"),
                        style: FilledButton.styleFrom(
                          backgroundColor: _primary,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (state.loading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: _primary),
                  ),
                )
              else if (state.feed.isEmpty)
                const SliverFillRemaining(
                  child: Center(
                    child: Text("아직 공유된 루트가 없습니다.", style: TextStyle(color: _textSecondary)),
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.7,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _UserRouteCard(
                        route: state.feed[i],
                        onTap: () => setState(() => _detailRoute = state.feed[i]),
                        onLike: () => ctrl.likeRoute(state.feed[i].id),
                      ),
                      childCount: state.feed.length,
                    ),
                  ),
                ),
                if (state.hasMoreFeed)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Center(
                        child: OutlinedButton(
                          onPressed: state.loadingMore ? null : ctrl.loadMoreFeed,
                          child: Text(state.loadingMore ? "불러오는 중..." : "더 보기"),
                        ),
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          ),

          // 상세 바텀시트
          if (_detailRoute != null)
            _RouteDetailSheet(
              route: _detailRoute!,
              onClose: () => setState(() => _detailRoute = null),
            ),

          // 업로드 바텀시트
          if (_showUpload)
            _UploadSheet(
              onClose: () => setState(() => _showUpload = false),
            ),
        ],
      ),
    );
  }
}

class _UserRouteCard extends StatelessWidget {
  const _UserRouteCard({required this.route, required this.onTap, required this.onLike});
  final UserRoute route;
  final VoidCallback onTap;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 썸네일
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(14),
                topRight: Radius.circular(14),
              ),
              child: AspectRatio(
                aspectRatio: 3 / 2,
                child: route.imageUrl != null
                    ? Image.network(
                        route.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _gradientFallback(),
                      )
                    : _gradientFallback(),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 태그
                    if (route.tags.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 2,
                        children: route.tags
                            .take(2)
                            .map(
                              (t) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _primaryLight,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  "#$t",
                                  style: const TextStyle(fontSize: 10, color: _primary),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      route.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: _textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 12, color: _textSecondary),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            route.location,
                            style: const TextStyle(fontSize: 11, color: _textSecondary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        GestureDetector(
                          onTap: onLike,
                          child: Row(
                            children: [
                              const Icon(Icons.favorite_border, size: 14, color: Color(0xFFEC4899)),
                              const SizedBox(width: 2),
                              Text(
                                "${route.likes}",
                                style: const TextStyle(fontSize: 11, color: _textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
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

  Widget _gradientFallback() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

class _RouteDetailSheet extends StatelessWidget {
  const _RouteDetailSheet({required this.route, required this.onClose});
  final UserRoute route;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black54,
        child: GestureDetector(
          onTap: () {},
          child: DraggableScrollableSheet(
            initialChildSize: 0.8,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            builder: (_, ctrl) => Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                children: [
                  // 핸들
                  Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 10),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      controller: ctrl,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        // 헤더
                        if (route.imageUrl != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              route.imageUrl!,
                              height: 180,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                            ),
                          ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 14, color: _primary),
                            const SizedBox(width: 4),
                            Text(route.location, style: const TextStyle(fontSize: 13, color: _primary)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          route.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          route.description,
                          style: const TextStyle(fontSize: 13, color: _textSecondary),
                        ),
                        if (route.tags.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            children: route.tags
                                .map(
                                  (t) => Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: _primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text("#$t", style: const TextStyle(fontSize: 12, color: _primary)),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                        const SizedBox(height: 16),
                        const Text(
                          "루트",
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
                        ),
                        const SizedBox(height: 8),
                        ...route.routeItems.asMap().entries.map((e) {
                          final idx = e.key;
                          final item = e.value;
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Column(
                                children: [
                                  Container(
                                    width: 24,
                                    height: 24,
                                    decoration: BoxDecoration(
                                      color: _primary,
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      "${idx + 1}",
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (idx < route.routeItems.length - 1)
                                    Container(width: 2, height: 32, color: Colors.grey.shade200),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.place,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: _textPrimary,
                                        ),
                                      ),
                                      if (item.description.isNotEmpty)
                                        Text(
                                          item.description,
                                          style: const TextStyle(fontSize: 12, color: _textSecondary),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          );
                        }),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── 업로드 바텀시트 (단계별 위저드) ───────────────────────────
class _UploadSheet extends ConsumerStatefulWidget {
  const _UploadSheet({required this.onClose});
  final VoidCallback onClose;

  @override
  ConsumerState<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends ConsumerState<_UploadSheet> {
  // step: 0=사진, 1=폼, 2=폴리시, 3=완료
  int _step = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);

    return GestureDetector(
      onTap: widget.onClose,
      child: Container(
        color: Colors.black54,
        child: GestureDetector(
          onTap: () {},
          child: DraggableScrollableSheet(
            initialChildSize: 0.85,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            builder: (_, scrollCtrl) => Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                children: [
                  Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 10),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // 단계 인디케이터
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                    child: Row(
                      children: [
                        const Text(
                          "루트 공유하기",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          "${_step + 1}/4",
                          style: const TextStyle(fontSize: 13, color: _textSecondary),
                        ),
                      ],
                    ),
                  ),
                  LinearProgressIndicator(
                    value: (_step + 1) / 4,
                    color: _primary,
                    backgroundColor: _primaryLight,
                    minHeight: 3,
                  ),
                  Expanded(
                    child: ListView(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.all(20),
                      children: [
                        if (_step == 0) ...[
                          const Text(
                            "📸 대표 사진을 선택해 주세요",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            "선택 사항입니다. 없어도 공유할 수 있어요.",
                            style: TextStyle(fontSize: 12, color: _textSecondary),
                          ),
                          const SizedBox(height: 16),
                          if (state.selectedImagePath != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(
                                File(state.selectedImagePath!),
                                height: 180,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: ctrl.pickImage,
                            icon: const Icon(Icons.photo_library_outlined),
                            label: Text(state.selectedImagePath == null ? "갤러리에서 선택" : "다시 선택"),
                          ),
                          if (state.selectedImagePath != null && state.uploadedImageUrl == null) ...[
                            const SizedBox(height: 8),
                            FilledButton.icon(
                              onPressed: state.loading ? null : ctrl.validateAndUploadImage,
                              icon: const Icon(Icons.upload),
                              label: Text(state.loading ? "업로드 중..." : "사진 업로드"),
                              style: FilledButton.styleFrom(backgroundColor: _primary),
                            ),
                            if (state.uploadProgress != null) ...[
                              const SizedBox(height: 8),
                              LinearProgressIndicator(value: state.uploadProgress, color: _primary),
                            ],
                          ],
                          if (state.uploadedImageUrl != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD1FAE5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.check_circle, color: Color(0xFF059669), size: 16),
                                  SizedBox(width: 6),
                                  Text("사진 업로드 완료!", style: TextStyle(color: Color(0xFF059669), fontSize: 13)),
                                ],
                              ),
                            ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton(
                                  onPressed: () => setState(() => _step = 1),
                                  style: FilledButton.styleFrom(backgroundColor: _primary),
                                  child: const Text("다음"),
                                ),
                              ),
                            ],
                          ),
                        ] else if (_step == 1) ...[
                          const Text(
                            "✍️ 루트 정보를 입력해 주세요",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 16),
                          _InputField(
                            label: "제목",
                            initial: state.draftTitle,
                            onChanged: ctrl.setDraftTitle,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "여행지",
                            hint: "예: 부산, 제주",
                            initial: state.draftLocation,
                            onChanged: ctrl.setDraftLocation,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "한 줄 설명",
                            initial: state.draftDescription,
                            onChanged: ctrl.setDraftDescription,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "장소 목록 (한 줄당 장소 - 메모)",
                            hint: "해운대 - 오전 산책\n광안리 - 야경",
                            initial: state.draftRouteItemsText,
                            onChanged: ctrl.setDraftRouteItemsText,
                            maxLines: 5,
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => setState(() => _step = 0),
                                  child: const Text("이전"),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton(
                                  onPressed: () {
                                    setState(() => _step = 2);
                                    ctrl.polishDraft();
                                  },
                                  style: FilledButton.styleFrom(backgroundColor: _primary),
                                  child: const Text("AI 다듬기"),
                                ),
                              ),
                            ],
                          ),
                        ] else if (_step == 2) ...[
                          const Text(
                            "✨ AI 다듬기 결과",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 12),
                          if (state.loading)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32),
                                child: CircularProgressIndicator(color: _primary),
                              ),
                            )
                          else if (state.polished != null) ...[
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: _primaryLight,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    state.polished!.title,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: _textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    state.polished!.description,
                                    style: const TextStyle(fontSize: 13, color: _textSecondary),
                                  ),
                                  if (state.polished!.tags.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 6,
                                      children: state.polished!.tags
                                          .map(
                                            (t) => Chip(
                                              label: Text("#$t", style: const TextStyle(fontSize: 11)),
                                              backgroundColor: Colors.white,
                                            ),
                                          )
                                          .toList(),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => setState(() => _step = 1),
                                    child: const Text("수정하기"),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: state.loading ? null : ctrl.savePolishedRoute,
                                    style: FilledButton.styleFrom(backgroundColor: _primary),
                                    child: const Text("공유하기"),
                                  ),
                                ),
                              ],
                            ),
                          ] else ...[
                            const Text("AI 다듬기 실패. 다시 시도해 주세요.", style: TextStyle(color: Colors.red)),
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () => setState(() => _step = 1),
                              child: const Text("돌아가기"),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  const _InputField({
    required this.label,
    required this.initial,
    required this.onChanged,
    this.hint,
    this.maxLines = 1,
  });
  final String label;
  final String initial;
  final void Function(String) onChanged;
  final String? hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: ValueKey(initial.hashCode),
      initialValue: initial,
      onChanged: onChanged,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// K-CONTENT TAB
// ═══════════════════════════════════════════════════════════════
class _KContentTab extends ConsumerWidget {
  const _KContentTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(kContentControllerProvider);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text("🎬", style: TextStyle(fontSize: 48)),
            ),
            const SizedBox(height: 20),
            const Text(
              "K-콘텐츠 플래너",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: _textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                "Coming Soon",
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFD97706),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              "드라마·영화 촬영지 기반 여행 코스\n곧 제공될 예정입니다.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: _textSecondary, height: 1.6),
            ),
            if (state.message.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(state.message, style: const TextStyle(fontSize: 12, color: _textSecondary)),
            ],
          ],
        ),
      ),
    );
  }
}
