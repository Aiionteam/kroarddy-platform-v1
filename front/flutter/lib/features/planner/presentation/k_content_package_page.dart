import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/config/app_env.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../../home/state/news_context.dart";
import "../data/k_content_constants.dart";
import "../data/k_content_generate_parser.dart";
import "../data/k_content_repository.dart";

import "k_content_package_widgets.dart";

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
  bool _loadingPackageMeta = false;
  bool _triggered = false;
  String? _error;
  int? _savedPlanId;
  String? _heroImageUrl;
  Map<String, dynamic>? _packageDetail;
  Map<String, dynamic>? _packageMeta;
  List<Map<String, dynamic>> _places = const [];
  Map<String, dynamic>? _costSummary;
  List<Map<String, dynamic>> _scheduleRows = const [];

  String _foodRegionTab = "ALL";
  ({String name, String description})? _selectedMarket;
  String? _selectedCafeVibe;
  final TextEditingController _cafeKeywordController = TextEditingController();
  String _convenienceTab = "trending";
  String? _selectedBrand;
  String? _selectedConvenienceVibe;
  final TextEditingController _convenienceSearchController = TextEditingController();
  final Set<String> _checkedIngredients = {};

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, now.day);
    _endDate = _startDate.add(const Duration(days: 1));
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await Future.wait([_loadImages(), _loadPackageDetail()]);
    });
  }

  @override
  void dispose() {
    _cafeKeywordController.dispose();
    _convenienceSearchController.dispose();
    super.dispose();
  }

  String get _pid => widget.packageId;
  bool get _isKFoodMarket => _pid == "KF_MARKET";
  bool get _isKFoodCafeVibe => _pid.toUpperCase() == "KF_CAFE";
  bool get _isKFoodConvenience => _pid.toUpperCase() == "KF_CONVENIENCE";

  static String _stringField(Map<String, dynamic>? m, String key) {
    final v = m?[key];
    if (v == null) return "";
    return v.toString().trim();
  }

  String _webAsset(String path) {
    final base = AppEnv.webBaseUrl.replaceAll(RegExp(r"/+$"), "");
    final p = path.startsWith("/") ? path : "/$path";
    return "$base$p";
  }

  String? _heroFallbackUrl() {
    final k = _pid.toUpperCase();
    if (k == "KF_CAFE") return _webAsset("/k_content/k-food/KF_CAFE/rawkkim-1P7C9MaRzgU-unsplash.jpg");
    if (k == "KF_CONVENIENCE") return _webAsset("/k_content/k-food/KF_CONVENIENCE/business_gs25_img02.jpg");
    return null;
  }

  Map<String, dynamic> _selectedMeta() {
    final pid = _pid;
    final d = _packageDetail;
    if (d != null && (d["package_id"] != null || d["title_ko"] != null || d["title_en"] != null)) {
      return {
        "package_id": d["package_id"]?.toString() ?? pid,
        "category": d["category"] ?? inferCategoryFromPackageId(pid),
        "title_ko": d["title_ko"],
        "title_en": d["title_en"],
        "tags": d["tags"],
      };
    }
    if (pid == "KF_MARKET") {
      return {
        "package_id": pid,
        "category": "KFOOD",
        "title_ko": "screens.k_content.detail.meta_kf_market_title_ko".tr(),
        "title_en": "Traditional markets & street food across Korea",
        "tags": "screens.k_content.detail.meta_kf_market_tags".tr(),
      };
    }
    if (pid.toUpperCase() == "KF_CAFE") {
      return {
        "package_id": pid,
        "category": "KFOOD",
        "title_ko": "screens.k_content.detail.meta_kf_cafe_title_ko".tr(),
        "title_en": "K-dessert and vibe-matched cafe tour",
        "tags": "screens.k_content.detail.meta_kf_cafe_tags".tr(),
      };
    }
    if (pid.toUpperCase() == "KF_CONVENIENCE") {
      return {
        "package_id": pid,
        "category": "KFOOD",
        "title_ko": "screens.k_content.detail.meta_kf_convenience_title_ko".tr(),
        "title_en":
            "From sold-out new arrivals to your own secret recipes, become a convenience-store modisumer!",
        "tags": "screens.k_content.detail.meta_kf_convenience_tags".tr(),
      };
    }
    return {
      "package_id": pid,
      "category": inferCategoryFromPackageId(pid),
      "title_ko": pid,
      "title_en": "K-Content package",
      "tags": "",
    };
  }

  String _selectedMetaTitle(BuildContext context) {
    final m = _selectedMeta();
    final isKo = context.locale.languageCode == "ko";
    final ko = m["title_ko"]?.toString() ?? "";
    final en = m["title_en"]?.toString() ?? "";
    if (isKo) {
      if (ko.isNotEmpty) return ko;
      if (en.isNotEmpty) return en;
    } else {
      if (en.isNotEmpty) return en;
      if (ko.isNotEmpty) return ko;
    }
    return _pid;
  }

  String _subtitleEnLine() {
    final m = _selectedMeta();
    return m["title_en"]?.toString().isNotEmpty == true ? m["title_en"].toString() : "K-Content package";
  }

  List<String> _parseTags(String? tags) {
    final raw = (tags ?? "").trim();
    if (raw.isEmpty) return [];
    if (raw.contains(",")) {
      return raw.split(",").map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    }
    return raw.split(RegExp(r"\s+")).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  }

  String _brandLabel(String brand) {
    if (brand == "SEVENELEVEN") return "screens.k_content.detail.brand_seven".tr();
    if (brand == "EMART24") return "screens.k_content.detail.brand_emart24".tr();
    return brand;
  }

  bool _mainGenerateDisabled() {
    if (_loading) return true;
    if (_isKFoodMarket && _selectedMarket == null) return true;
    if (_isKFoodCafeVibe && _selectedCafeVibe == null && _cafeKeywordController.text.trim().isEmpty) {
      return true;
    }
    if (_isKFoodConvenience) {
      final kw = _convenienceSearchController.text.trim();
      if (_convenienceTab == "trending" && _selectedBrand == null && kw.isEmpty) return true;
      if (_convenienceTab == "recipe" && _selectedConvenienceVibe == null && kw.isEmpty) return true;
    }
    return false;
  }

  Future<void> _loadPackageDetail() async {
    if (_loadingPackageMeta) return;
    setState(() => _loadingPackageMeta = true);
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final d = await repo.fetchPackage(_pid);
      if (!mounted) return;
      setState(() => _packageDetail = d);
    } catch (_) {
      // 웹과 같이 API 실패 시 폴백 메타만 사용
    } finally {
      if (mounted) setState(() => _loadingPackageMeta = false);
    }
  }

  Future<void> _loadImages() async {
    if (_loadingImages) return;
    setState(() => _loadingImages = true);
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final images = await repo.fetchPackageImages(_pid);
      var picked = repo.pickRandomImage(images);
      if (picked.isEmpty) picked = _heroFallbackUrl() ?? "";
      if (!mounted) return;
      setState(() => _heroImageUrl = picked.isEmpty ? null : picked);
    } finally {
      if (mounted) setState(() => _loadingImages = false);
    }
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

  Map<String, dynamic> _fallbackPackageMeta() {
    final m = _selectedMeta();
    return {
      "package_id": m["package_id"] ?? _pid,
      "category": m["category"] ?? inferCategoryFromPackageId(_pid),
      "title_ko": m["title_ko"]?.toString().isNotEmpty == true ? m["title_ko"] : _pid,
      "title_en": m["title_en"]?.toString().isNotEmpty == true ? m["title_en"] : "K-Content package",
      "tags": m["tags"]?.toString() ?? "",
    };
  }

  Future<void> _generateSchedule({
    String locationName = "Seoul",
    String? keyword,
    String? pickedVibe,
  }) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _triggered = true;
      _error = null;
      _savedPlanId = null;
      _scheduleRows = const [];
      _costSummary = null;
    });
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final news = ref.read(newsContextProvider).items.map((e) => e.toJson()).toList();
      final userProfile = <String, dynamic>{
        "travel_start_date": _iso(_startDate),
        "travel_end_date": _iso(_endDate),
        if (keyword != null && keyword.trim().isNotEmpty) "keyword": keyword.trim(),
        if (pickedVibe != null && pickedVibe.trim().isNotEmpty) "pickedVibe": pickedVibe.trim(),
      };
      final gen = await repo.generate(
        packageId: _pid,
        startDate: _iso(_startDate),
        endDate: _iso(_endDate),
        locationName: locationName,
        newsTop10: news.isEmpty ? null : news,
        userProfile: userProfile,
      );
      final parsed = parseKContentGenerateResponse(
        res: gen.rawJson,
        startDateIso: _iso(_startDate),
        fallbackScheduleTitlePrefix: "screens.k_content.detail.schedule_item_default".tr(),
      );
      if (!mounted) return;
      setState(() {
        _scheduleRows = parsed.schedule;
        _packageMeta = parsed.packageMeta ?? gen.packageMeta ?? _packageMeta;
        _costSummary = parsed.costSummary ?? gen.costSummary;
        _places = gen.places;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onHeaderGenerate() {
    if (_mainGenerateDisabled()) return;
    if (_isKFoodMarket) {
      _handleKFoodMarketGenerate();
      return;
    }
    if (_isKFoodCafeVibe) {
      _handleKFoodCafeGenerate();
      return;
    }
    if (_isKFoodConvenience) {
      _handleKFoodConvenienceGenerate();
      return;
    }
    _generateSchedule();
  }

  void _handleKFoodMarketGenerate() {
    final m = _selectedMarket;
    if (m == null) return;
    _generateSchedule(locationName: m.name, keyword: m.name);
  }

  void _handleKFoodCafeGenerate() {
    final isKo = context.locale.languageCode == "ko";
    final v = kCafeVibes.where((e) => e.id == _selectedCafeVibe).firstOrNull;
    String? vibePart;
    if (v != null) {
      final label = isKo ? v.labelKo : v.labelEn;
      final desc = isKo ? v.descriptionKo : v.descriptionEn;
      vibePart = "$label — $desc";
    }
    final trimmed = _cafeKeywordController.text.trim();
    String? keyword;
    if (trimmed.isNotEmpty) {
      keyword = vibePart != null
          ? "$vibePart | ${"screens.k_content.detail.cafe_place_hint".tr()}: $trimmed"
          : trimmed;
    } else {
      keyword = vibePart;
    }
    if (keyword == null || keyword.isEmpty) return;
    _generateSchedule(
      locationName: trimmed.isNotEmpty ? trimmed : "Seoul",
      keyword: keyword,
      pickedVibe: _selectedCafeVibe,
    );
  }

  void _handleKFoodConvenienceGenerate() {
    final isEn = context.locale.languageCode != "ko";
    final brandPrefix = isEn ? "brand" : "브랜드";
    final productPrefix = isEn ? "product" : "상품";
    final extraPrefix = isEn ? "extra request" : "추가요청";
    final kw = _convenienceSearchController.text.trim();
    if (_convenienceTab == "trending") {
      final trendKeyword = [
        "trending",
        "screens.k_content.detail.convenience_trending_label".tr(),
        if (_selectedBrand != null) "$brandPrefix:${_brandLabel(_selectedBrand!)}",
        if (kw.isNotEmpty) "$productPrefix:$kw",
      ].where((e) => e.isNotEmpty).join(" | ");
      _generateSchedule(
        locationName: _selectedBrand != null ? _brandLabel(_selectedBrand!) : "Seoul",
        keyword: trendKeyword,
      );
      return;
    }
    final vibe = kConvenienceRecipeVibes.where((e) => e.id == _selectedConvenienceVibe).firstOrNull;
    final isKo = context.locale.languageCode == "ko";
    final recipeKeyword = [
      "recipe",
      if (vibe != null) (isKo ? vibe.labelKo : vibe.labelEn),
      if (vibe != null) (isKo ? vibe.descriptionKo : vibe.descriptionEn),
      if (kw.isNotEmpty) "$extraPrefix:$kw",
    ].where((e) => e.toString().isNotEmpty).join(" | ");
    _generateSchedule(locationName: "Seoul", keyword: recipeKeyword, pickedVibe: _selectedConvenienceVibe);
  }

  List<({String title, String brand, List<String> tags})> _convenienceTrendingCards() {
    if (_scheduleRows.isEmpty) {
      final brandFallback = _selectedBrand ?? "GS25";
      return [
        (
          title: "screens.k_content.detail.trending_card_1_title".tr(),
          brand: brandFallback,
          tags: [
            "screens.k_content.detail.trending_tag_new".tr(),
            "screens.k_content.detail.trending_tag_soldout".tr(),
          ],
        ),
        (
          title: "screens.k_content.detail.trending_card_2_title".tr(),
          brand: "CU",
          tags: [
            "screens.k_content.detail.trending_tag_review".tr(),
            "screens.k_content.detail.trending_tag_repurchase".tr(),
          ],
        ),
      ];
    }
    return _scheduleRows.take(4).map((item) {
      final title = _stringField(item, "title").isNotEmpty
          ? _stringField(item, "title")
          : (_stringField(item, "place").isNotEmpty ? _stringField(item, "place") : "screens.k_content.detail.trending_default_title".tr());
      final brand = _selectedBrand != null ? _brandLabel(_selectedBrand!) : (_stringField(item, "place").isNotEmpty ? _stringField(item, "place") : _brandLabel("GS25"));
      return (
        title: title,
        brand: brand,
        tags: [
          "screens.k_content.detail.trending_tag_new".tr(),
          "screens.k_content.detail.trending_tag_soldout".tr(),
        ],
      );
    }).toList();
  }

  String _convenienceRecipeTitle() {
    if (_scheduleRows.isNotEmpty) {
      final t0 = _stringField(_scheduleRows.first, "title");
      if (t0.isNotEmpty) return t0;
    }
    final vibe = kConvenienceRecipeVibes.where((e) => e.id == _selectedConvenienceVibe).firstOrNull;
    if (vibe != null) {
      final label = context.locale.languageCode == "ko" ? vibe.labelKo : vibe.labelEn;
      return "screens.k_content.detail.recipe_title_with_vibe".tr(namedArgs: {"vibe": label});
    }
    return "screens.k_content.detail.recipe_title_default".tr();
  }

  List<String> _convenienceShoppingList() {
    if (_scheduleRows.isEmpty) {
      return [
        "screens.k_content.detail.shop_ramen".tr(),
        "screens.k_content.detail.shop_kimbap".tr(),
        "screens.k_content.detail.shop_cheese".tr(),
        "screens.k_content.detail.shop_sparkling".tr(),
      ];
    }
    return _scheduleRows
        .take(5)
        .map((e) => _stringField(e, "place").isNotEmpty ? _stringField(e, "place") : _stringField(e, "title"))
        .where((e) => e.isNotEmpty)
        .toList();
  }

  List<String> _convenienceCookingSteps() {
    if (_scheduleRows.isEmpty) {
      return [
        "screens.k_content.detail.cook_step_1".tr(),
        "screens.k_content.detail.cook_step_2".tr(),
        "screens.k_content.detail.cook_step_3".tr(),
      ];
    }
    return _scheduleRows.take(3).toList().asMap().entries.map((e) {
      final desc = _stringField(e.value, "description");
      final title = _stringField(e.value, "title");
      return "${e.key + 1}. ${desc.isNotEmpty ? desc : title}";
    }).toList();
  }

  Future<void> _save() async {
    if (_saving || _scheduleRows.isEmpty) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(kContentRepositoryProvider);
      final meta = Map<String, dynamic>.from(_fallbackPackageMeta());
      if (_packageMeta != null) {
        meta.addAll(_packageMeta!);
      }
      final res = await repo.save(
        packageMeta: meta,
        schedule: _scheduleRows,
        places: _places,
        costSummary: _costSummary,
        userId: _currentAppUserId(),
        location: "K-Content",
        startDate: _iso(_startDate),
        endDate: _iso(_endDate),
      );
      if (mounted) setState(() => _savedPlanId = res.planId);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("screens.k_content.save_failed".tr(namedArgs: {"error": "$e"}))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Map<int, List<Map<String, dynamic>>> _dayGroups() {
    final acc = <int, List<Map<String, dynamic>>>{};
    for (final row in _scheduleRows) {
      final day = (row["day"] is num) ? (row["day"] as num).toInt() : int.tryParse(row["day"]?.toString() ?? "") ?? 1;
      acc.putIfAbsent(day, () => []).add(row);
    }
    final keys = acc.keys.toList()..sort();
    return {for (final k in keys) k: acc[k]!};
  }

  @override
  Widget build(BuildContext context) {
    final meta = _selectedMeta();
    final metaTitle = _selectedMetaTitle(context);
    final tags = _parseTags(meta["tags"]?.toString());
    final lang = context.locale.languageCode == "ko" ? "ko" : "en";
    final descriptionFallback = "screens.k_content.detail.description_fallback".tr();

    return Scaffold(
      backgroundColor: const Color(0xFFF8F7FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _textPrimary),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go("/planner");
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              "screens.k_content.detail.small_header".tr(),
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
            ),
            Text(
              metaTitle,
              style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Center(
              child: Text(
                "${_iso(_startDate)} ~ ${_iso(_endDate)}",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _dateAndGenerateCard(context),
          const SizedBox(height: 12),
          _heroBanner(context, metaTitle),
          const SizedBox(height: 16),
          Text(
            "screens.k_content.detail.ai_recommended".tr(),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),
          _metaSummaryCard(context, meta, metaTitle, tags),
          if (_isKFoodMarket) ...[
            const SizedBox(height: 16),
            _kFoodMarketSection(context),
          ],
          if (_isKFoodCafeVibe) ...[
            const SizedBox(height: 16),
            _kFoodCafeSection(context),
          ],
          if (_isKFoodConvenience) ...[
            const SizedBox(height: 16),
            _kFoodConvenienceSection(context),
          ],
          if (!_triggered &&
              !_loading &&
              !_isKFoodMarket &&
              !_isKFoodCafeVibe &&
              !_isKFoodConvenience) ...[
            const SizedBox(height: 20),
            Center(
              child: Column(
                children: [
                  Text("📅", style: TextStyle(fontSize: 36, color: Colors.grey.shade400)),
                  const SizedBox(height: 8),
                  Text(
                    "screens.k_content.detail.empty_hint".tr(),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "${_iso(_startDate)} ~ ${_iso(_endDate)}",
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _loading ? null : () => _generateSchedule(),
                    icon: const Icon(Icons.auto_awesome, size: 18),
                    label: Text("screens.k_content.detail.start_generate".tr()),
                    style: FilledButton.styleFrom(backgroundColor: KroaddyColors.primary),
                  ),
                ],
              ),
            ),
          ],
          if (_loading) ...[
            const SizedBox(height: 20),
            const Center(child: CircularProgressIndicator()),
            const SizedBox(height: 8),
            Text(
              "screens.k_content.detail.making_schedule".tr(namedArgs: {"title": metaTitle}),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: _textSecondary),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C))),
            ),
          ],
          if (!_loading && _triggered && _scheduleRows.isEmpty && _error == null) ...[
            const SizedBox(height: 16),
            Text(
              "screens.k_content.detail.no_schedule".tr(),
              style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
            ),
          ],
          if (!_loading && _scheduleRows.isNotEmpty) ...[
            const SizedBox(height: 16),
            _scheduleResultHeader(context, metaTitle),
            if (_isKFoodConvenience) _convenienceResultBody(context) else _standardScheduleBody(context, lang, descriptionFallback),
          ],
        ],
      ),
    );
  }

  Widget _dateAndGenerateCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("screens.k_content.date_settings".tr(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _textPrimary)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _loading ? null : () => _pickDate(start: true),
                  child: Text("screens.k_content.start_date".tr(namedArgs: {"date": _iso(_startDate)}), overflow: TextOverflow.ellipsis),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: _loading ? null : () => _pickDate(start: false),
                  child: Text("screens.k_content.end_date".tr(namedArgs: {"date": _iso(_endDate)}), overflow: TextOverflow.ellipsis),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: (_loading || _mainGenerateDisabled()) ? null : _onHeaderGenerate,
              icon: _loading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.auto_awesome),
              label: Text(_loading ? "screens.k_content.generating".tr() : "screens.k_content.detail.generate_btn".tr()),
              style: FilledButton.styleFrom(backgroundColor: KroaddyColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroBanner(BuildContext context, String metaTitle) {
    final sub = _subtitleEnLine();
    final effective = (_heroImageUrl != null && _heroImageUrl!.isNotEmpty) ? _heroImageUrl! : _heroFallbackUrl();
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(colors: [KroaddyColors.primary, KroaddyColors.accent]),
        image: effective != null
            ? DecorationImage(image: NetworkImage(effective), fit: BoxFit.cover, onError: (_, _) {})
            : null,
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.black.withValues(alpha: effective != null ? 0.22 : 0),
        ),
        padding: const EdgeInsets.all(16),
        alignment: Alignment.bottomLeft,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(metaTitle, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(sub, style: const TextStyle(color: Colors.white70, fontSize: 13)),
            if (_loadingImages)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text("screens.k_content.image_loading".tr(), style: const TextStyle(color: Colors.white70, fontSize: 11)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _metaSummaryCard(BuildContext context, Map<String, dynamic> meta, String metaTitle, List<String> tags) {
    final emoji = _isKFoodMarket ? "🍜" : (_isKFoodCafeVibe ? "☕" : (_isKFoodConvenience ? "🏪" : "🎬"));
    final cat = categoryBadgeText(meta["category"]?.toString());
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 28)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(metaTitle, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: _textPrimary))),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(999)),
                      child: Text(cat, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF4338CA))),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(_subtitleEnLine(), style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                if (tags.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: tags
                          .map(
                            (t) => Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4)),
                              child: Text(t, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                            ),
                          )
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static const _regionTabs = ["ALL", "SEOUL", "GANGWON", "JEONLA", "GYEONGSANG", "JEJU"];

  String _regionTabLabel(String tab) {
    switch (tab) {
      case "ALL":
        return "screens.k_content.detail.region_tab_all".tr();
      case "SEOUL":
        return "screens.k_content.detail.region_tab_seoul".tr();
      case "GANGWON":
        return "screens.k_content.detail.region_tab_gangwon".tr();
      case "JEONLA":
        return "screens.k_content.detail.region_tab_jeonla".tr();
      case "GYEONGSANG":
        return "screens.k_content.detail.region_tab_gyeongsang".tr();
      case "JEJU":
        return "screens.k_content.detail.region_tab_jeju".tr();
      default:
        return tab;
    }
  }

  Widget _kFoodMarketSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("screens.k_content.detail.region_select".tr(), style: _sectionLabelStyle),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _regionTabs.map((tab) {
            final active = _foodRegionTab == tab;
            final label = _regionTabLabel(tab);
            return ChoiceChip(
              label: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? Colors.white : _textSecondary)),
              selected: active,
              onSelected: _loading ? null : (v) => setState(() => _foodRegionTab = tab),
              selectedColor: KroaddyColors.primary,
              backgroundColor: Colors.white,
            );
          }).toList(),
        ),
        const SizedBox(height: 12),
        Text("screens.k_content.detail.traditional_market".tr(), style: _sectionLabelStyle),
        const SizedBox(height: 8),
        LayoutBuilder(
          builder: (context, c) {
            final w = (c.maxWidth - 8) / 2;
            final markets = marketsForRegionTab(_foodRegionTab);
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: markets.map((m) {
                final sel = _selectedMarket?.name == m.name;
                return SizedBox(
                  width: w.clamp(120, 400),
                  child: Material(
                    color: sel ? const Color(0xFFEEF2FF) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: _loading ? null : () => setState(() => _selectedMarket = (name: m.name, description: m.description)),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: sel ? KroaddyColors.primary : Colors.grey.shade200, width: sel ? 2 : 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                            const SizedBox(height: 4),
                            Text(m.description, style: TextStyle(fontSize: 11, color: Colors.grey.shade600, height: 1.25)),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_loading || _selectedMarket == null) ? null : _handleKFoodMarketGenerate,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF59E0B)),
            child: Text("screens.k_content.detail.market_generate".tr()),
          ),
        ),
      ],
    );
  }

  TextStyle get _sectionLabelStyle => TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.4);

  Widget _kFoodCafeSection(BuildContext context) {
    final isKo = context.locale.languageCode == "ko";
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("screens.k_content.detail.cafe_question".tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _textPrimary)),
        const SizedBox(height: 6),
        Text("screens.k_content.detail.cafe_hint".tr(), style: TextStyle(fontSize: 13, color: Colors.grey.shade600, height: 1.35)),
        const SizedBox(height: 12),
        Text("screens.k_content.detail.vibe_grid".tr(), style: _sectionLabelStyle),
        const SizedBox(height: 8),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.15,
          children: kCafeVibes.map((v) {
            final sel = _selectedCafeVibe == v.id;
            final label = isKo ? v.labelKo : v.labelEn;
            final desc = isKo ? v.descriptionKo : v.descriptionEn;
            return Material(
              color: sel ? const Color(0xFFEEF2FF) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                onTap: _loading ? null : () => setState(() => _selectedCafeVibe = v.id),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: sel ? KroaddyColors.primary : Colors.grey.shade200, width: sel ? 2 : 1),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(label, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: sel ? KroaddyColors.primary : _textPrimary)),
                      const SizedBox(height: 4),
                      Text(desc, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, height: 1.2, color: sel ? const Color(0xFF4338CA) : Colors.grey.shade600)),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 12),
        Text("screens.k_content.detail.search_bar".tr(), style: _sectionLabelStyle),
        const SizedBox(height: 6),
        TextField(
          controller: _cafeKeywordController,
          enabled: !_loading,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: "screens.k_content.detail.cafe_placeholder".tr(),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_loading || (_selectedCafeVibe == null && _cafeKeywordController.text.trim().isEmpty)) ? null : _handleKFoodCafeGenerate,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
            child: Text("screens.k_content.detail.cafe_generate".tr()),
          ),
        ),
      ],
    );
  }

  Widget _kFoodConvenienceSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(colors: [Color(0xFFD1FAE5), Color(0xFFE0F2FE), Color(0xFFEDE9FE)]),
          ),
          child: Row(
            children: [
              Expanded(
                child: _convTabBtn("trending", "screens.k_content.detail.conv_tab_trending".tr(), Icons.local_fire_department),
              ),
              Expanded(
                child: _convTabBtn("recipe", "screens.k_content.detail.conv_tab_recipe".tr(), Icons.science_outlined),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (_convenienceTab == "trending") ...[
          Text("screens.k_content.detail.convenience_q".tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Text("screens.k_content.detail.quick_selection".tr(), style: _sectionLabelStyle),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: kConvenienceBrands.map((b) {
              final sel = _selectedBrand == b;
              return ChoiceChip(
                label: Text(_brandLabel(b)),
                selected: sel,
                onSelected: _loading ? null : (v) => setState(() => _selectedBrand = b),
                selectedColor: const Color(0xFFFFE4E6),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Text("screens.k_content.detail.search_bar".tr(), style: _sectionLabelStyle),
          TextField(
            controller: _convenienceSearchController,
            enabled: !_loading,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: "screens.k_content.detail.trending_placeholder".tr(),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ] else ...[
          Text("screens.k_content.detail.recipe_q".tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.4,
            children: kConvenienceRecipeVibes.map((v) {
              final sel = _selectedConvenienceVibe == v.id;
              final isKo = context.locale.languageCode == "ko";
              return Material(
                color: sel ? const Color(0xFFF5F3FF) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () => setState(() => _selectedConvenienceVibe = v.id),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: sel ? const Color(0xFFA78BFA) : Colors.grey.shade200, width: sel ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(isKo ? v.labelKo : v.labelEn, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text(isKo ? v.descriptionKo : v.descriptionEn, style: TextStyle(fontSize: 10, color: Colors.grey.shade600, height: 1.2)),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Text("screens.k_content.detail.extra_keywords".tr(), style: _sectionLabelStyle),
          TextField(
            controller: _convenienceSearchController,
            enabled: !_loading,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: "screens.k_content.detail.recipe_placeholder".tr(),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: (_loading || (_selectedConvenienceVibe == null && _convenienceSearchController.text.trim().isEmpty))
                  ? null
                  : _handleKFoodConvenienceGenerate,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
              child: Text("screens.k_content.detail.recipe_generate_btn".tr()),
            ),
          ),
        ],
      ],
    );
  }

  Widget _convTabBtn(String id, String label, IconData icon) {
    final active = _convenienceTab == id;
    return Padding(
      padding: const EdgeInsets.all(4),
      child: FilledButton.tonal(
        onPressed: _loading ? null : () => setState(() => _convenienceTab = id),
        style: FilledButton.styleFrom(
          backgroundColor: active ? KroaddyColors.primary : Colors.white,
          foregroundColor: active ? Colors.white : _textPrimary,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18),
            const SizedBox(width: 4),
            Flexible(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }

  Widget _scheduleResultHeader(BuildContext context, String metaTitle) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "screens.k_content.detail.recommended_schedule_title".tr(namedArgs: {"title": metaTitle}),
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: _textPrimary),
                    ),
                    Text("${_iso(_startDate)} ~ ${_iso(_endDate)}", style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                  ],
                ),
              ),
              if (_savedPlanId != null)
                TextButton(
                  onPressed: () => context.push("/planner/schedule"),
                  child: Text("screens.k_content.detail.saved_goto_schedule".tr()),
                )
              else
                FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(backgroundColor: KroaddyColors.primary),
                  child: Text(_saving ? "common.saving".tr() : "screens.k_content.detail.save_plan".tr()),
                ),
            ],
          ),
          if (_costSummary != null && _costSummary!["trip_total"] != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                Text("screens.k_content.detail.total_cost".tr(), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(999)),
                  child: Text("💰 ${_costSummary!["trip_total"]}", style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF059669))),
                ),
                ...(() {
                  final pd = _costSummary!["per_day"];
                  if (pd is! List) return <Widget>[];
                  return pd.map<Widget>((d) {
                    if (d is! Map) return const SizedBox.shrink();
                    final day = d["day"];
                    final total = d["total"]?.toString() ?? "";
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(999)),
                      child: Text(
                        "screens.k_content.detail.cost_per_day".tr(namedArgs: {"day": "$day", "total": total}),
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                      ),
                    );
                  }).toList();
                })(),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _convenienceResultBody(BuildContext context) {
    if (_convenienceTab == "trending") {
      final cards = _convenienceTrendingCards();
      return Column(
        children: cards.map((c) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFFEDD5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(c.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFCFFAFE), borderRadius: BorderRadius.circular(999)),
                        child: Text(c.brand, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0E7490))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 4,
                    children: c.tags
                        .map(
                          (t) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFFFE4E6), borderRadius: BorderRadius.circular(999)),
                            child: Text(t, style: const TextStyle(fontSize: 10, color: Color(0xFFBE123C))),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {},
                      child: Text("screens.k_content.detail.find_nearby_store".tr()),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      );
    }
    final steps = _convenienceCookingSteps();
    final shop = _convenienceShoppingList();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFEDE9FE)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_convenienceRecipeTitle(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text("screens.k_content.detail.recipe_hashtags".tr(), style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED))),
            const SizedBox(height: 12),
            Text("screens.k_content.detail.shopping_list_title".tr(), style: _sectionLabelStyle),
            ...shop.map((item) {
              final checked = _checkedIngredients.contains(item);
              return CheckboxListTile(
                dense: true,
                value: checked,
                title: Text(item, style: TextStyle(decoration: checked ? TextDecoration.lineThrough : null, color: checked ? Colors.grey : _textPrimary)),
                onChanged: (v) {
                  setState(() {
                    if (v == true) {
                      _checkedIngredients.add(item);
                    } else {
                      _checkedIngredients.remove(item);
                    }
                  });
                },
              );
            }),
            const SizedBox(height: 8),
            Text("screens.k_content.detail.cooking_steps_title".tr(), style: _sectionLabelStyle),
            ...steps.map((s) => Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Text(s, style: const TextStyle(fontSize: 13, height: 1.35)),
                  ),
                )),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(10)),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: "${"screens.k_content.detail.challenge_location".tr()}: ", style: const TextStyle(fontWeight: FontWeight.w700)),
                    TextSpan(text: "screens.k_content.detail.challenge_location_desc".tr()),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _standardScheduleBody(BuildContext context, String lang, String descriptionFallback) {
    final groups = _dayGroups();
    return Column(
      children: groups.entries.map((e) {
        final day = e.key;
        final items = e.value;
        final dayDate = items.isNotEmpty ? _stringField(items.first, "date") : "";
        Map<String, dynamic>? sub;
        final pd = _costSummary?["per_day"];
        if (pd is List) {
          for (final x in pd) {
            if (x is! Map) continue;
            final m = Map<String, dynamic>.from(x);
            final d = m["day"];
            final di = d is num ? d.toInt() : int.tryParse(d?.toString() ?? "");
            if (di == day) {
              sub = m;
              break;
            }
          }
        }

        return Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: KroaddyColors.primary,
                    child: Text("$day", style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 8),
                  Text(dayDate, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF4F46E5))),
                  const Spacer(),
                  if (sub != null)
                    Text(
                      "screens.k_content.detail.subtotal".tr(namedArgs: {"total": sub["total"]?.toString() ?? ""}),
                      style: const TextStyle(fontSize: 11, color: Color(0xFF059669), fontWeight: FontWeight.w600),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              ...items.asMap().entries.map((ie) {
                return Padding(
                  padding: const EdgeInsets.only(left: 8, bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 22,
                        alignment: Alignment.topCenter,
                        child: CircleAvatar(
                          radius: 10,
                          backgroundColor: const Color(0xFFC7D2FE),
                          child: Text("${ie.key + 1}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF3730A3))),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: KContentItineraryCard(
                          packageId: _pid,
                          item: ie.value,
                          lang: lang,
                          descriptionFallback: descriptionFallback,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      }).toList(),
    );
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
