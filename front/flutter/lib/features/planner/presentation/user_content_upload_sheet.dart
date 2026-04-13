import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../data/planner_models.dart";
import "../data/planner_repository.dart";
import "../data/user_content_models.dart";
import "state/user_content_controller.dart";
import "state/user_content_state.dart";

const _primary = KroaddyColors.primary;
const _primaryLight = KroaddyColors.brandWash;
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _maxStopsPerDay = 5;

/// 웹 `UploadModal` 과 동일한 3단계(사진·폼·AI) + 완료
class UserContentUploadSheet extends ConsumerStatefulWidget {
  const UserContentUploadSheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<UserContentUploadSheet> createState() => _UserContentUploadSheetState();
}

class _DayDraft {
  _DayDraft({required this.stops});
  List<RouteItemInput> stops;
}

class _UserContentUploadSheetState extends ConsumerState<UserContentUploadSheet> {
  /// 0 사진, 1 폼, 2 AI(로딩/미리보기), 3 완료
  int _step = 0;
  late TextEditingController _titleCtrl;
  late TextEditingController _locationCtrl;
  late TextEditingController _descCtrl;
  late List<_DayDraft> _days;
  bool _planPickerOpen = false;
  List<TravelPlanRecord> _myPlans = const [];
  bool _plansLoading = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController();
    _locationCtrl = TextEditingController();
    _descCtrl = TextEditingController();
    _days = [
      _DayDraft(
        stops: List.generate(
          3,
          (_) => RouteItemInput(place: ""),
        ),
      ),
    ];
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _locationCtrl.dispose();
    _descCtrl.dispose();
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

  void _importPlan(TravelPlanRecord plan) {
    _titleCtrl.text = plan.routeName;
    _locationCtrl.text = plan.location;
    _descCtrl.text = "";
    if (plan.schedule.isEmpty) {
      _days = [
        _DayDraft(stops: [RouteItemInput(place: "")]),
      ];
    } else {
      final byDay = <int, List<RouteItemInput>>{};
      for (final item in plan.schedule) {
        final d = item.day <= 0 ? 1 : item.day;
        byDay.putIfAbsent(d, () => []);
        final arr = byDay[d]!;
        if (arr.length < _maxStopsPerDay) {
          arr.add(RouteItemInput(place: item.place, note: item.title));
        }
      }
      final sorted = byDay.keys.toList()..sort();
      _days = sorted.map((k) {
        final stops = byDay[k]!;
        return _DayDraft(stops: stops.isEmpty ? [RouteItemInput(place: "")] : stops);
      }).toList();
      if (_days.isEmpty) {
        _days = [_DayDraft(stops: [RouteItemInput(place: "")])];
      }
    }
    setState(() => _planPickerOpen = false);
  }

  List<RouteItemInput> _allStops() {
    return _days.expand((d) => d.stops).where((s) => s.place.trim().isNotEmpty).toList();
  }

  Future<void> _goNextFromPhoto() async {
    final state = ref.read(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);
    if (state.selectedImagePath != null && state.selectedImagePath!.isNotEmpty) {
      try {
        await ctrl.validateImageForNextStep();
        if (!mounted) return;
      } catch (_) {
        return;
      }
    }
    setState(() => _step = 1);
  }

  Future<void> _runPolish() async {
    final ctrl = ref.read(userContentControllerProvider.notifier);
    ctrl
      ..setDraftTitle(_titleCtrl.text)
      ..setDraftLocation(_locationCtrl.text)
      ..setDraftDescription(_descCtrl.text);
    final items = _allStops();
    setState(() => _step = 2);
    await ctrl.polishDraftFromItems(items);
    if (!mounted) return;
    final st = ref.read(userContentControllerProvider);
    if (st.polished != null) {
      setState(() {});
    }
  }

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
            initialChildSize: 0.92,
            minChildSize: 0.55,
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
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
                    child: Row(
                      children: [
                        const Text(
                          "내 루트 업로드",
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const Spacer(),
                        if (_step < 2)
                          IconButton(
                            onPressed: widget.onClose,
                            icon: const Icon(Icons.close, color: _textSecondary),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: List.generate(3, (i) {
                        final active = (_step == 3 ? 2 : _step) >= i;
                        return Expanded(
                          child: Container(
                            margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                            height: 5,
                            decoration: BoxDecoration(
                              color: active ? _primary : Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _stepLabel(),
                        style: const TextStyle(fontSize: 11, color: _textSecondary),
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      children: _buildStepBody(state, ctrl, scrollCtrl),
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

  String _stepLabel() {
    switch (_step) {
      case 0:
        return "사진 선택";
      case 1:
        return "루트 입력";
      case 2:
        return "AI 다듬기";
      case 3:
        return "완료";
      default:
        return "";
    }
  }

  List<Widget> _buildStepBody(UserContentState state, UserContentController ctrl, ScrollController scrollCtrl) {
    if (_step == 0) {
      return _buildPhotoStep(state, ctrl);
    }
    if (_step == 1) {
      return _buildFormStep(state, ctrl);
    }
    if (_step == 2) {
      return _buildPolishStep(state, ctrl);
    }
    return _buildDoneStep();
  }

  List<Widget> _buildPhotoStep(UserContentState state, UserContentController ctrl) {
    return [
      GestureDetector(
        onTap: ctrl.pickImage,
        child: Container(
          height: 200,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade300, width: 2),
            color: Colors.grey.shade50,
          ),
          child: state.selectedImagePath != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.file(
                    File(state.selectedImagePath!),
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("📸", style: TextStyle(fontSize: 48)),
                    const SizedBox(height: 8),
                    Text(
                      "사진을 탭해서 선택",
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "JPG, PNG, WEBP",
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
        ),
      ),
      if (state.selectedImagePath != null)
        TextButton(
          onPressed: () => ctrl.pickImage(),
          child: const Text("사진 제거", style: TextStyle(fontSize: 12)),
        ),
      if (state.message.isNotEmpty && state.validatedImage == null && state.selectedImagePath != null)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(state.message, style: const TextStyle(color: Colors.red, fontSize: 12)),
        ),
      if (state.validatedImage != null)
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF059669), size: 18),
              SizedBox(width: 6),
              Text("이미지 검증 완료", style: TextStyle(color: Color(0xFF059669), fontSize: 12)),
            ],
          ),
        ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: state.loading ? null : _goNextFromPhoto,
          style: FilledButton.styleFrom(
            backgroundColor: _primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: state.loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  state.selectedImagePath == null ? "사진 없이 계속" : "다음",
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
        ),
      ),
    ];
  }

  List<Widget> _buildFormStep(UserContentState state, UserContentController ctrl) {
    return [
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _plansLoading ? null : _openPlanPicker,
          icon: _plansLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.calendar_month_outlined, size: 18),
          label: const Text("저장된 일정에서 가져오기"),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF4338CA),
            side: const BorderSide(color: Color(0xFFA5B4FC), width: 2),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      ),
      if (_planPickerOpen) _buildPlanPicker(),
      const SizedBox(height: 12),
      _fieldLabel("루트 제목 *"),
      TextField(
        controller: _titleCtrl,
        decoration: _inputDeco(hint: "예: 강릉 감성 당일치기"),
      ),
      const SizedBox(height: 12),
      _fieldLabel("여행지 *"),
      TextField(
        controller: _locationCtrl,
        decoration: _inputDeco(hint: "예: 강릉, 경포대"),
      ),
      const SizedBox(height: 12),
      _fieldLabel("한 줄 소개 (선택)"),
      TextField(
        controller: _descCtrl,
        maxLines: 2,
        decoration: _inputDeco(hint: "이 루트의 매력을 간단히 (AI가 다듬어줘요)"),
      ),
      const SizedBox(height: 16),
      Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          const Text(
            "장소 목록 *",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _textSecondary),
          ),
          const SizedBox(width: 6),
          Text(
            "(일차당 최대 $_maxStopsPerDay개)",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
          ),
        ],
      ),
      const SizedBox(height: 8),
      ...List.generate(_days.length, _buildDaySection),
      const SizedBox(height: 8),
      OutlinedButton.icon(
        onPressed: () {
          setState(() {
            _days.add(_DayDraft(stops: [RouteItemInput(place: "")]));
          });
        },
        icon: const Icon(Icons.add, size: 18),
        label: Text("+ ${_days.length + 1}일차 추가"),
        style: OutlinedButton.styleFrom(
          foregroundColor: _primary,
          side: BorderSide(color: Colors.purple.shade200, width: 2),
          minimumSize: const Size.fromHeight(44),
        ),
      ),
      const SizedBox(height: 20),
      Row(
        children: [
          OutlinedButton(
            onPressed: () => setState(() => _step = 0),
            child: const Text("←"),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: FilledButton.icon(
              onPressed: _canPolish() ? _runPolish : null,
              icon: const Icon(Icons.auto_awesome, size: 18),
              label: const Text("AI로 다듬기"),
              style: FilledButton.styleFrom(backgroundColor: _primary, padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
          ),
        ],
      ),
    ];
  }

  Widget _buildPlanPicker() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
                const Text("저장된 일정 선택", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF4338CA))),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => _planPickerOpen = false),
                  child: const Text("닫기", style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
          if (_myPlans.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text("저장된 일정이 없습니다.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: _textSecondary)),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _myPlans.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final p = _myPlans[i];
                  return ListTile(
                    dense: true,
                    title: Text(p.routeName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text(
                      "${p.location}${p.startDate != null ? " · ${p.startDate}" : ""} · ${p.schedule.length}곳",
                      style: const TextStyle(fontSize: 11),
                    ),
                    onTap: () => _importPlan(p),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  bool _canPolish() {
    if (_titleCtrl.text.trim().isEmpty || _locationCtrl.text.trim().isEmpty) return false;
    return _allStops().isNotEmpty;
  }

  Widget _fieldLabel(String text, {bool flex = true}) {
    final w = Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _textSecondary));
    if (!flex) return w;
    return Padding(padding: const EdgeInsets.only(bottom: 6), child: Align(alignment: Alignment.centerLeft, child: w));
  }

  InputDecoration _inputDeco({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  Widget _buildDaySection(int dayIdx) {
    final day = _days[dayIdx];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: _primaryLight,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: _primary,
                  child: Text("${dayIdx + 1}", style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                Text("${dayIdx + 1}일차", style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF6B21A8))),
                const SizedBox(width: 8),
                Text("${day.stops.length}/$_maxStopsPerDay", style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                const Spacer(),
                TextButton(
                  onPressed: day.stops.length >= _maxStopsPerDay
                      ? null
                      : () {
                          setState(() {
                            day.stops.add(RouteItemInput(place: ""));
                          });
                        },
                  child: const Text("+ 장소 추가", style: TextStyle(fontSize: 12)),
                ),
                if (_days.length > 1)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _days.removeAt(dayIdx);
                      });
                    },
                    child: Text("삭제", style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: List.generate(day.stops.length, (si) {
                final stop = day.stops[si];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        margin: const EdgeInsets.only(top: 8),
                        decoration: const BoxDecoration(color: Color(0xFFE9D5FF), shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: Text(
                          "${si + 1}",
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          children: [
                            TextFormField(
                              key: ValueKey("plc_${dayIdx}_${si}_${stop.place}"),
                              initialValue: stop.place,
                              onChanged: (v) => day.stops[si] = RouteItemInput(place: v, note: stop.note),
                              decoration: _inputDeco(hint: "장소명 (예: 안목해변 커피거리)"),
                            ),
                            const SizedBox(height: 4),
                            TextFormField(
                              key: ValueKey("memo_${dayIdx}_${si}_${stop.note}"),
                              initialValue: stop.note ?? "",
                              onChanged: (v) =>
                                  day.stops[si] = RouteItemInput(place: stop.place, note: v.isEmpty ? null : v),
                              style: const TextStyle(fontSize: 12),
                              decoration: _inputDeco(hint: "간단한 메모 (선택)").copyWith(
                                filled: true,
                                fillColor: Colors.grey.shade50,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (day.stops.length > 1)
                        IconButton(
                          onPressed: () {
                            setState(() {
                              day.stops.removeAt(si);
                            });
                          },
                          icon: Icon(Icons.close, size: 18, color: Colors.grey.shade400),
                        ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPolishStep(UserContentState state, UserContentController ctrl) {
    if (state.loading) {
      return [
        const SizedBox(height: 40),
        const Center(
          child: SizedBox(
            width: 56,
            height: 56,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 56,
                  height: 56,
                  child: CircularProgressIndicator(strokeWidth: 4, color: _primary),
                ),
                Text("✨", style: TextStyle(fontSize: 22)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Center(
          child: Text(
            "AI가 루트를 다듬고 있어요",
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _textPrimary),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            "감성적인 소개와 여행 팁을 추가하는 중…",
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
        ),
      ];
    }

    if (state.polished == null) {
      return [
        const SizedBox(height: 24),
        Text(
          state.message.isNotEmpty ? state.message : "AI 다듬기에 실패했습니다.",
          style: const TextStyle(color: Colors.red, fontSize: 13),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () => setState(() => _step = 1),
          child: const Text("돌아가기"),
        ),
      ];
    }

    final p = state.polished!;
    return [
      Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: Stack(
                children: [
                  Container(
                    height: 140,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [KroaddyColors.primary, Color(0xFF6366F1)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  if (state.selectedImagePath != null)
                    Image.file(
                      File(state.selectedImagePath!),
                      height: 140,
                      width: double.infinity,
                      fit: BoxFit.cover,
                    ),
                  Container(height: 140, color: Colors.black.withValues(alpha: 0.35)),
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 12,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: p.tags
                              .map(
                                (t) => Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.25),
                                    borderRadius: BorderRadius.circular(99),
                                  ),
                                  child: Text(
                                    t.startsWith("#") ? t : "#$t",
                                    style: const TextStyle(fontSize: 10, color: Colors.white),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          p.title,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        Text("📍 ${p.location}", style: const TextStyle(fontSize: 12, color: Colors.white70)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.description, style: const TextStyle(fontSize: 12, color: _textSecondary, height: 1.4)),
                  const SizedBox(height: 12),
                  ...p.routeItems.asMap().entries.map((e) {
                    final i = e.key;
                    final it = e.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: const BoxDecoration(color: Color(0xFFE9D5FF), shape: BoxShape.circle),
                            alignment: Alignment.center,
                            child: Text(
                              "${i + 1}",
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(it.place, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                Text(it.description, style: const TextStyle(fontSize: 11, color: _textSecondary)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          OutlinedButton(
            onPressed: () {
              ctrl.clearPolishResult();
              setState(() => _step = 1);
            },
            child: const Text("다시 입력"),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: FilledButton.icon(
              onPressed: state.loading
                  ? null
                  : () async {
                      final before = ref.read(userContentControllerProvider).saveSuccessCount;
                      await ctrl.savePolishedRoute();
                      if (!mounted) return;
                      final after = ref.read(userContentControllerProvider).saveSuccessCount;
                      if (after > before) {
                        setState(() => _step = 3);
                      }
                    },
              icon: const Icon(Icons.rocket_launch_outlined, size: 18),
              label: Text(state.loading ? "저장 중…" : "공유하기"),
              style: FilledButton.styleFrom(backgroundColor: _primary, padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
          ),
        ],
      ),
    ];
  }

  List<Widget> _buildDoneStep() {
    return [
      const SizedBox(height: 32),
      const Center(child: Text("🎉", style: TextStyle(fontSize: 56))),
      const SizedBox(height: 12),
      const Center(
        child: Text(
          "루트가 공유됐어요!",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _textPrimary),
        ),
      ),
      const SizedBox(height: 8),
      const Center(
        child: Text(
          "피드에서 내 루트를 확인해보세요",
          style: TextStyle(fontSize: 13, color: _textSecondary),
        ),
      ),
      const SizedBox(height: 24),
      FilledButton(
        onPressed: widget.onClose,
        style: FilledButton.styleFrom(
          backgroundColor: _primary,
          minimumSize: const Size.fromHeight(48),
        ),
        child: const Text("확인"),
      ),
    ];
  }
}
