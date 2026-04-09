import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/router/main_shell.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../../home/state/news_context.dart";
import "../data/k_content_repository.dart";

import "../../../core/theme/kroaddy_colors.dart";

const _primary = KroaddyColors.primary;
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);

class KContentPackagePage extends ConsumerStatefulWidget {
  const KContentPackagePage({super.key, required this.packageId});

  final String packageId;

  @override
  ConsumerState<KContentPackagePage> createState() => _KContentPackagePageState();
}

class _KContentPackagePageState extends ConsumerState<KContentPackagePage> {
  late DateTime _startDate;
  late DateTime _endDate;
  bool _loading = false;
  bool _saving = false;
  bool _loadingImages = false;
  String? _error;
  int? _savedPlanId;
  String? _heroImageUrl;
  Map<String, dynamic>? _packageMeta;
  List<Map<String, dynamic>> _places = const [];
  Map<String, dynamic>? _costSummary;
  List<KContentScheduleItem> _schedule = const [];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, now.day);
    _endDate = _startDate.add(const Duration(days: 1));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadImages());
  }

  String _iso(DateTime d) {
    final m = d.month.toString().padLeft(2, "0");
    final day = d.day.toString().padLeft(2, "0");
    return "${d.year}-$m-$day";
  }

  int? _currentAppUserId() {
    final token = ref.read(authControllerProvider).accessToken;
    if (token == null || token.isEmpty) return null;
    return getAppUserIdFromToken(token) ?? getUserIdFromToken(token);
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = start ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      initialDate: initial,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: _primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: _textPrimary,
            ),
            datePickerTheme: DatePickerThemeData(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              headerBackgroundColor: const Color(0xFFF7F3FF),
              headerForegroundColor: _textPrimary,
              dayStyle: const TextStyle(fontWeight: FontWeight.w600),
              todayBorder: const BorderSide(color: _primary),
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: _primary,
                textStyle: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _startDate = DateTime(picked.year, picked.month, picked.day);
        if (_endDate.isBefore(_startDate)) _endDate = _startDate;
      } else {
        _endDate = DateTime(picked.year, picked.month, picked.day);
        if (_endDate.isBefore(_startDate)) _endDate = _startDate;
      }
    });
  }

  DateTime _dateFromDay(int day) => _startDate.add(Duration(days: (day - 1).clamp(0, 365)));

  Future<void> _loadImages() async {
    if (_loadingImages) return;
    setState(() => _loadingImages = true);
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final images = await repo.fetchPackageImages(widget.packageId);
      final picked = repo.pickRandomImage(images);
      if (!mounted) return;
      setState(() => _heroImageUrl = picked.isEmpty ? null : picked);
    } finally {
      if (mounted) setState(() => _loadingImages = false);
    }
  }

  Future<void> _generate() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      _savedPlanId = null;
      _schedule = const [];
      _costSummary = null;
    });
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final news = ref.read(newsContextProvider).items.map((e) => e.toJson()).toList();
      final generated = await repo.generate(
        packageId: widget.packageId,
        startDate: _iso(_startDate),
        endDate: _iso(_endDate),
        locationName: "Seoul",
        newsTop10: news.isEmpty ? null : news,
      );
      final normalized = generated.schedule
          .map((e) => KContentScheduleItem(
                day: e.day,
                date: e.date.isNotEmpty ? e.date : _iso(_dateFromDay(e.day)),
                time: e.time,
                place: e.place,
                title: e.title,
                description: e.description,
                tips: e.tips,
                estimatedCost: e.estimatedCost,
              ))
          .toList();
      setState(() {
        _packageMeta = generated.packageMeta;
        _places = generated.places;
        _costSummary = generated.costSummary;
        _schedule = normalized;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_saving || _schedule.isEmpty) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final fallbackMeta = <String, dynamic>{
        "package_id": widget.packageId,
        "category": "K-CONTENT",
        "title_ko": widget.packageId,
        "title_en": "K-Content package",
        "tags": "",
      };
      final res = await repo.save(
        packageMeta: _packageMeta ?? fallbackMeta,
        schedule: _schedule.map((e) => e.toJson()).toList(),
        places: _places,
        costSummary: _costSummary,
        userId: _currentAppUserId(),
        location: "K-Content",
        startDate: _iso(_startDate),
        endDate: _iso(_endDate),
      );
      setState(() => _savedPlanId = res.planId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("저장 실패: $e")),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F7FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: Text(
          "K-Content · ${widget.packageId}",
          style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("날짜 설정", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _textPrimary)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : () => _pickDate(start: true),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        ),
                        child: Text(
                          "시작일 ${_iso(_startDate)}",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : () => _pickDate(start: false),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                        ),
                        child: Text(
                          "종료일 ${_iso(_endDate)}",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _loading ? null : _generate,
                    icon: _loading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.auto_awesome),
                    label: Text(_loading ? "생성 중..." : "일정 생성"),
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // 웹과 동일하게 패키지 대표 이미지 노출
          Container(
            height: 210,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(
                colors: [KroaddyColors.primary, KroaddyColors.accent],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              image: _heroImageUrl != null
                  ? DecorationImage(
                      image: NetworkImage(_heroImageUrl!),
                      fit: BoxFit.cover,
                      onError: (_, _) {},
                    )
                  : null,
            ),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Colors.black.withValues(alpha: _heroImageUrl != null ? 0.18 : 0),
              ),
              padding: const EdgeInsets.all(16),
              alignment: Alignment.bottomLeft,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.packageId,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (_loadingImages)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text(
                        "이미지 불러오는 중...",
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C))),
            ),
          ],
          if (_schedule.isNotEmpty) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                const Text("추천 일정", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary)),
                const Spacer(),
                if (_savedPlanId != null)
                  TextButton(
                    onPressed: () => context.push("/planner/schedule"),
                    child: const Text("저장됨 · 마이플랜 보기"),
                  )
                else
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    child: Text(_saving ? "저장 중..." : "저장하기"),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ..._schedule.map(
              (item) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Day ${item.day} · ${item.date}", style: const TextStyle(fontSize: 12, color: _textSecondary)),
                    const SizedBox(height: 4),
                    Text(item.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _textPrimary)),
                    if (item.place.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text("📍 ${item.place}", style: const TextStyle(fontSize: 12, color: _primary)),
                      ),
                    if (item.description.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(item.description, style: const TextStyle(fontSize: 12, color: _textSecondary, height: 1.4)),
                      ),
                    if ((item.tips ?? "").isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text("💡 ${item.tips}", style: const TextStyle(fontSize: 11, color: _textSecondary)),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

