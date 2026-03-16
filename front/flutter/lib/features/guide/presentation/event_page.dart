import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:url_launcher/url_launcher.dart";

import "../../../core/router/main_shell.dart";
import "../data/guide_models.dart";
import "state/guide_controller.dart";
import "state/guide_state.dart";

const _primary = Color(0xFF7C3AED);
const _indigo = Color(0xFF4F46E5);
const _indigoLight = Color(0xFFEEF2FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

const _monthNames = [
  "", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

class EventPage extends ConsumerWidget {
  const EventPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(guideControllerProvider);
    final ctrl = ref.read(guideControllerProvider.notifier);
    final filtered = ctrl.filteredItems();
    final eventDays = ctrl.daysWithEvents();

    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: const Text(
          "행사추천",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: Column(
        children: [
          // 월 네비게이션 헤더
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  onPressed: ctrl.goPrevMonth,
                  icon: const Icon(Icons.chevron_left, color: _textPrimary),
                ),
                Text(
                  "${state.year}년 ${_monthNames[state.month]}",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _textPrimary,
                  ),
                ),
                IconButton(
                  onPressed: ctrl.goNextMonth,
                  icon: const Icon(Icons.chevron_right, color: _textPrimary),
                ),
              ],
            ),
          ),
          if (state.loading) const LinearProgressIndicator(color: _primary, minHeight: 2),

          // 날짜 칩
          if (eventDays.isNotEmpty)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 4, 16, 6),
                    child: Text(
                      "행사 있는 날짜",
                      style: TextStyle(fontSize: 12, color: _textSecondary, fontWeight: FontWeight.w500),
                    ),
                  ),
                  SizedBox(
                    height: 36,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        _DayChip(
                          label: "전체",
                          selected: state.selectedDay == null,
                          onTap: () => ctrl.selectDay(null),
                        ),
                        const SizedBox(width: 6),
                        ...eventDays.map(
                          (d) => Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: _DayChip(
                              label: "$d일",
                              selected: state.selectedDay == d,
                              onTap: () => ctrl.selectDay(d),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // 에러
          if (state.errorMessage != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      state.errorMessage!,
                      style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                    ),
                  ),
                ],
              ),
            ),

          // 리스트
          Expanded(child: _buildFestivalList(state, filtered, ctrl)),
        ],
      ),
    );
  }

  Widget _buildFestivalList(GuideState state, List<FestivalItem> items, GuideController ctrl) {
    if (state.loading && items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) => _FestivalSkeleton(),
      );
    }
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("🎪", style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              Text(
                state.selectedDay != null
                    ? "${state.selectedDay}일에는 등록된 행사가 없어요."
                    : "${state.year}년 ${_monthNames[state.month]}에 등록된 행사가 없어요.",
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: _textSecondary),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: ctrl.loadFestivals,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text("다시 불러오기"),
              ),
            ],
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _FestivalCard(item: items[i]),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? _primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? _primary : Colors.grey.shade200),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
            color: selected ? Colors.white : _textSecondary,
          ),
        ),
      ),
    );
  }
}

class _FestivalCard extends StatelessWidget {
  const _FestivalCard({required this.item});
  final FestivalItem item;

  String _formatDateRange() {
    final s = item.fstvlStartDate;
    final e = item.fstvlEndDate;
    if (e.isEmpty || s == e) return s;
    return "$s ~ $e";
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.fstvlNm, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary)),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.calendar_today, size: 13, color: _indigo),
            const SizedBox(width: 4),
            Flexible(child: Text(_formatDateRange(), style: const TextStyle(fontSize: 12, color: _indigo, fontWeight: FontWeight.w500))),
          ]),
          if (item.opar.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.location_on, size: 13, color: _textSecondary),
              const SizedBox(width: 4),
              Expanded(child: Text(item.opar, style: const TextStyle(fontSize: 12, color: _textSecondary), overflow: TextOverflow.ellipsis)),
            ]),
          ],
          if (item.rdnmadr.isNotEmpty) ...[
            const SizedBox(height: 2),
            Row(children: [
              const Icon(Icons.map_outlined, size: 13, color: _textSecondary),
              const SizedBox(width: 4),
              Expanded(child: Text(item.rdnmadr, style: const TextStyle(fontSize: 11, color: _textSecondary), overflow: TextOverflow.ellipsis)),
            ]),
          ],
          if (item.fstvlCo.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(item.fstvlCo, style: const TextStyle(fontSize: 12, color: _textSecondary, height: 1.5), maxLines: 3, overflow: TextOverflow.ellipsis),
          ],
          if (item.mnnstNm.isNotEmpty || item.phoneNumber.isNotEmpty || item.homepageUrl.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            const SizedBox(height: 10),
            Row(children: [
              if (item.mnnstNm.isNotEmpty)
                Expanded(child: Text(item.mnnstNm, style: const TextStyle(fontSize: 11, color: _textSecondary), overflow: TextOverflow.ellipsis)),
              if (item.phoneNumber.isNotEmpty) ...[
                const SizedBox(width: 8),
                Row(children: [
                  const Icon(Icons.phone, size: 12, color: _textSecondary),
                  const SizedBox(width: 2),
                  Text(item.phoneNumber, style: const TextStyle(fontSize: 11, color: _textSecondary)),
                ]),
              ],
              if (item.homepageUrl.isNotEmpty) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () async {
                    final uri = Uri.tryParse(item.homepageUrl);
                    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: _indigoLight, borderRadius: BorderRadius.circular(6)),
                    child: const Text("홈페이지", style: TextStyle(fontSize: 11, color: _indigo, fontWeight: FontWeight.w500)),
                  ),
                ),
              ],
            ]),
          ],
        ],
      ),
    );
  }
}

class _FestivalSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _Shimmer(width: 200, height: 16),
        const SizedBox(height: 8),
        _Shimmer(width: 140, height: 12),
        const SizedBox(height: 6),
        _Shimmer(width: double.infinity, height: 12),
        const SizedBox(height: 4),
        _Shimmer(width: double.infinity, height: 12),
      ]),
    );
  }
}

class _Shimmer extends StatelessWidget {
  const _Shimmer({required this.width, required this.height});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(4)),
    );
  }
}
