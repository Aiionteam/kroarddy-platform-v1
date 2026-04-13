import "dart:math" as math;

import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_markdown/flutter_markdown.dart";
import "package:flutter_naver_map/flutter_naver_map.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:geolocator/geolocator.dart";
import "package:go_router/go_router.dart";
import "package:url_launcher/url_launcher.dart";

import "../../../core/network/api_client.dart";
import "../data/guide_answer_sanitize.dart" as sanitize;
import "../data/guide_context.dart";
import "../data/guide_map_utils.dart";
import "../data/guide_models.dart";
import "../data/guide_repository.dart";

bool _guideIsMissingInfo(String s) {
  final t = s.trim();
  if (t.isEmpty) return true;
  if (t == "정보 없음") return true;
  return t == "screens.guide_explore.info_none".tr();
}

String _guideCategoryLabel(GuideCategoryId id) {
  return switch (id) {
    GuideCategoryId.all => "screens.guide_explore.cat_all".tr(),
    GuideCategoryId.festival => "screens.guide_explore.cat_festival".tr(),
    GuideCategoryId.activity => "screens.guide_explore.cat_activity".tr(),
    GuideCategoryId.historic => "screens.guide_explore.cat_historic".tr(),
    GuideCategoryId.culture => "screens.guide_explore.cat_culture".tr(),
    GuideCategoryId.nature => "screens.guide_explore.cat_nature".tr(),
    GuideCategoryId.restaurant => "screens.guide_explore.cat_restaurant".tr(),
    GuideCategoryId.cafe => "screens.guide_explore.cat_cafe".tr(),
  };
}

String? _guideCategoryPrompt(GuideCategoryId id) {
  return switch (id) {
    GuideCategoryId.all => null,
    GuideCategoryId.festival => null,
    GuideCategoryId.activity => "screens.guide_explore.prompt_activity".tr(),
    GuideCategoryId.historic => "screens.guide_explore.prompt_historic".tr(),
    GuideCategoryId.culture => "screens.guide_explore.prompt_culture".tr(),
    GuideCategoryId.nature => "screens.guide_explore.prompt_nature".tr(),
    GuideCategoryId.restaurant => "screens.guide_explore.prompt_restaurant".tr(),
    GuideCategoryId.cafe => "screens.guide_explore.prompt_cafe".tr(),
  };
}

enum GuideCategoryId {
  all,
  festival,
  activity,
  historic,
  culture,
  nature,
  restaurant,
  cafe,
}

IconData _categoryIcon(GuideCategoryId id) => switch (id) {
      GuideCategoryId.all => Icons.grid_view_rounded,
      GuideCategoryId.festival => Icons.celebration_outlined,
      GuideCategoryId.activity => Icons.landscape_outlined,
      GuideCategoryId.historic => Icons.account_balance_outlined,
      GuideCategoryId.culture => Icons.palette_outlined,
      GuideCategoryId.nature => Icons.park_outlined,
      GuideCategoryId.restaurant => Icons.restaurant_outlined,
      GuideCategoryId.cafe => Icons.local_cafe_outlined,
    };

class _ChatMessage {
  _ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.at,
    this.useMarkdown = false,
  });

  final String id;
  final String role;
  final String content;
  final int at;
  final bool useMarkdown;
}

String _newId() =>
    "${DateTime.now().millisecondsSinceEpoch}-${UniqueKey().toString()}";

String _placesAssistantSummary(List<GuidePlaceMarkerDto> places) {
  final names =
      places.map((p) => p.name.trim()).where((s) => s.isNotEmpty).toList();
  final count = names.length;
  if (count == 0) return "screens.guide_explore.places_none".tr();
  const maxShow = 4;
  final head = names.take(maxShow).map((n) => "📍 $n").join(", ");
  final tail = count > maxShow
      ? "screens.guide_explore.places_extra".tr(namedArgs: {"n": "${count - maxShow}"})
      : "";
  return "screens.guide_explore.places_summary".tr(namedArgs: {
    "list": "$head$tail",
    "count": "$count",
  });
}

String _nearbyCategoryParam(GuideMapMarker m) {
  final c = m.category.toLowerCase();
  if (c.contains("카페") || c.contains("cafe")) return "cafe";
  if (c.contains("맛집") ||
      c.contains("음식") ||
      c.contains("식당") ||
      c.contains("restaurant")) {
    return "restaurant";
  }
  return "all";
}

String _formatDurationMs(int ms) {
  if (ms <= 0) return "";
  final minutes = (ms / 60000).round();
  if (minutes < 60) {
    return "screens.guide_explore.dur_min".tr(namedArgs: {"m": "$minutes"});
  }
  final h = minutes ~/ 60;
  final rm = minutes % 60;
  return "screens.guide_explore.dur_hr".tr(namedArgs: {"h": "$h", "rm": "$rm"});
}

String _formatKm(int meters) {
  if (meters <= 0) return "";
  final km = meters / 1000.0;
  return km >= 10 ? "${km.toStringAsFixed(0)} km" : "${km.toStringAsFixed(1)} km";
}

class GuideExplorePage extends ConsumerStatefulWidget {
  const GuideExplorePage({super.key});

  @override
  ConsumerState<GuideExplorePage> createState() => _GuideExplorePageState();
}

class _GuideExplorePageState extends ConsumerState<GuideExplorePage> {
  GuideCategoryId _activeCategory = GuideCategoryId.all;
  final List<GuideMapMarker> _markers = [];
  final List<_ChatMessage> _messages = [];
  GuideMapMarker? _selected;
  String? _lastGuideAnswer;
  bool _showGeminiNotice = false;
  bool _festivalLoading = false;
  bool _guideLoading = false;
  final TextEditingController _input = TextEditingController();
  final ScrollController _chatScroll = ScrollController();

  NaverMapController? _mapController;
  bool _cameraSmooth = false;

  ({double lat, double lng})? _userLatLng;
  GuideDirectionsResponse? _directionRoute;
  bool _directionsLoading = false;

  int _lastAskAt = 0;
  int _lastSendAttemptAt = 0;

  /// 웹과 동일 — 기본은 접힌 작은 바(「채팅 열기」)
  bool _chatPanelOpen = false;

  static const _kSeoul = NLatLng(37.5665, 126.9780);

  static const _guideMarkerIcon =
      NOverlayImage.fromAssetImage("assets/branding/guide_place_marker.png");

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ensureAuth();
      _initUserLocation();
    });
  }

  Future<void> _ensureAuth() async {
    final token = await ref.read(tokenStoreProvider).readAccessToken();
    if (!mounted) return;
    if (token == null || token.isEmpty) {
      context.go("/login");
    }
  }

  Future<void> _initUserLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      setState(() {
        _userLatLng = (lat: pos.latitude, lng: pos.longitude);
      });
      final mc = _mapController;
      if (mc != null) {
        _applyUserLocationOverlay(mc);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _input.dispose();
    _chatScroll.dispose();
    super.dispose();
  }

  bool get _busy => _festivalLoading || _guideLoading;

  /// 네이버 맵 내 위치 오버레이 (웹 파란 점과 동일 역할)
  void _applyUserLocationOverlay(NaverMapController c) {
    final lo = c.getLocationOverlay();
    final u = _userLatLng;
    if (u == null || !u.lat.isFinite || !u.lng.isFinite) {
      lo.setIsVisible(false);
      return;
    }
    lo.setIsVisible(true);
    lo.setPosition(NLatLng(u.lat, u.lng));
    lo.setBearing(0);
    lo.setSubIcon(null);
    lo.setCircleColor(const Color(0x662560EA));
  }

  /// 맵 위 채팅 바·입력줄이 차지하는 높이(장소 시트를 그 위에 띄우기 위함)
  double _mapChatReserveHeight(BuildContext context) {
    final safe = MediaQuery.paddingOf(context).bottom;
    if (!_chatPanelOpen) {
      // 하단 중앙 작은 바(웹 가이드와 유사)
      return 50 + safe + 12;
    }
    final hasBubbleArea = _messages.isNotEmpty || _guideLoading;
    const inputBar = 52.0;
    const verticalPad = 14.0;
    final listBlock = hasBubbleArea ? 176.0 : 0.0;
    return listBlock + inputBar + verticalPad + safe + 10;
  }

  Future<void> _syncMapOverlays() async {
    final c = _mapController;
    if (c == null) return;
    await c.clearOverlays();
    final overlays = <NAddableOverlay>{};
    for (final m in _markers) {
      final isSelected = _selected?.id == m.id;
      final marker = NMarker(
        id: m.id,
        position: NLatLng(m.lat, m.lng),
        icon: _guideMarkerIcon,
        iconTintColor: Colors.transparent,
        anchor: const NPoint(0.26, 1.0),
        size: Size(isSelected ? 56 : 44, isSelected ? 56 : 44),
        caption: NOverlayCaption(text: m.title),
      );
      marker.setOnTapListener((_) {
        if (!mounted) return;
        setState(() {
          _selected = m;
          _directionRoute = null;
          _directionsLoading = false;
        });
        _syncMapOverlays();
      });
      overlays.add(marker);
    }

    final route = _directionRoute;
    if (route != null &&
        route.ok &&
        route.path.length >= 2) {
      overlays.add(
        NPolylineOverlay(
          id: "guide-route",
          coords: route.path
              .map((p) => NLatLng(p.lat, p.lng))
              .toList(growable: false),
          color: const Color(0xFF6366F1),
          width: 5,
        ),
      );
    }

    if (overlays.isNotEmpty) {
      await c.addOverlayAll(overlays);
    }
    _applyUserLocationOverlay(c);
    await _fitCamera(c);
  }

  Future<void> _fitCamera(NaverMapController c) async {
    final sel = _selected;
    final smooth = _cameraSmooth;
    if (sel != null) {
      final u = NCameraUpdate.scrollAndZoomTo(
        target: NLatLng(sel.lat, sel.lng),
        zoom: 15,
      );
      _applyCameraAnim(u, smooth: smooth);
      await c.updateCamera(u);
      return;
    }
    if (_markers.length >= 2) {
      final pts = _markers.map((m) => NLatLng(m.lat, m.lng)).toList();
      final b = NLatLngBounds.from(pts);
      final u = NCameraUpdate.fitBounds(b, padding: const EdgeInsets.all(48));
      _applyCameraAnim(u, smooth: smooth);
      await c.updateCamera(u);
      return;
    }
    if (_markers.length == 1) {
      final m = _markers.first;
      final u =
          NCameraUpdate.scrollAndZoomTo(target: NLatLng(m.lat, m.lng), zoom: 14);
      _applyCameraAnim(u, smooth: smooth);
      await c.updateCamera(u);
      return;
    }
    final u = NCameraUpdate.scrollAndZoomTo(target: _kSeoul, zoom: 11);
    _applyCameraAnim(u, smooth: false);
    await c.updateCamera(u);
  }

  void _applyCameraAnim(NCameraUpdate u, {required bool smooth}) {
    if (smooth) {
      u.setAnimation(
        animation: NCameraAnimation.easing,
        duration: const Duration(milliseconds: 700),
      );
    } else {
      u.setAnimation(
        animation: NCameraAnimation.none,
        duration: const Duration(milliseconds: 1),
      );
    }
  }

  Future<void> _runGuideAsk(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    if (_busy) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastSendAttemptAt < 600) return;
    _lastSendAttemptAt = now;

    if (now - _lastAskAt < 1000) {
      if (!mounted) return;
      _pushMessage(
        _ChatMessage(
          id: _newId(),
          role: "assistant",
          content: "screens.guide_explore.rate_limit".tr(),
          at: now,
        ),
      );
      return;
    }
    _lastAskAt = now;

    setState(() {
      _showGeminiNotice = false;
      _lastGuideAnswer = null;
      _guideLoading = true;
    });
    _input.clear();
    _pushMessage(
      _ChatMessage(
        id: _newId(),
        role: "user",
        content: trimmed,
        at: now,
      ),
    );

    try {
      final ctx = await buildGuideAskContext(ref);
      final res =
          await ref.read(guideRepositoryProvider).postGuideAsk(
                question: trimmed,
                context: ctx,
              );
      final placesCount = res.places.length;
      final markers =
          placesCount > 0 ? guidePlacesToMarkers(res.places) : <GuideMapMarker>[];

      if (!mounted) return;
      setState(() {
        _guideLoading = false;
        _markers.clear();
        _markers.addAll(markers);
        _selected = null;
        _directionRoute = null;
        _lastGuideAnswer = () {
          final t = sanitize.stripPlacesJsonBlock(res.answer).trim();
          return t.isEmpty ? null : t;
        }();
        _showGeminiNotice = res.source == "gemini_search";
        _cameraSmooth = markers.isNotEmpty;
      });

      if (placesCount > 0) {
        _pushMessage(
          _ChatMessage(
            id: _newId(),
            role: "assistant",
            content: _placesAssistantSummary(res.places),
            at: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      } else {
        final raw = res.answer.trim();
        const maxLen = 360;
        final clipped =
            raw.length > maxLen ? "${raw.substring(0, maxLen).trim()}…" : raw;
        final hint = "screens.guide_explore.no_coords_hint".tr();
        _pushMessage(
          _ChatMessage(
            id: _newId(),
            role: "assistant",
            content: (clipped.isEmpty ? "screens.guide_explore.answer_failed".tr() : clipped) + hint,
            at: DateTime.now().millisecondsSinceEpoch,
            useMarkdown: true,
          ),
        );
      }

      WidgetsBinding.instance
          .addPostFrameCallback((_) => _syncMapOverlays());
    } catch (e) {
      if (!mounted) return;
      setState(() => _guideLoading = false);
      _pushMessage(
        _ChatMessage(
          id: _newId(),
          role: "assistant",
          content: e.toString(),
          at: DateTime.now().millisecondsSinceEpoch,
        ),
      );
    }
  }

  void _pushMessage(_ChatMessage m) {
    setState(() => _messages.add(m));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent + 80,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _onCategorySelect(GuideCategoryId id) async {
    setState(() {
      _activeCategory = id;
      _showGeminiNotice = false;
    });

    if (id == GuideCategoryId.festival) {
      setState(() {
        _cameraSmooth = false;
        _festivalLoading = true;
        _markers.clear();
        _selected = null;
        _directionRoute = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());

      final now = DateTime.now();
      try {
        final data = await ref.read(guideRepositoryProvider).fetchFestivals(
              year: now.year,
              month: now.month,
            );
        final markers = festivalItemsToMarkers(data.items);
        if (!mounted) return;
        setState(() {
          _festivalLoading = false;
          _markers.clear();
          _markers.addAll(markers);
          _selected = null;
        });
        _pushMessage(
          _ChatMessage(
            id: _newId(),
            role: "assistant",
            content: markers.isNotEmpty
                ? "screens.guide_explore.festival_ok".tr(namedArgs: {
                    "n": "${markers.length}",
                    "year": "${data.year}",
                    "month": "${data.month}",
                  })
                : "screens.guide_explore.festival_empty".tr(),
            at: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _festivalLoading = false;
          _markers.clear();
        });
        _pushMessage(
          _ChatMessage(
            id: _newId(),
            role: "assistant",
            content: "screens.guide_explore.festival_err".tr(namedArgs: {"error": "$e"}),
            at: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      }
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());
      return;
    }

    if (id == GuideCategoryId.all) {
      setState(() {
        _lastGuideAnswer = null;
        _cameraSmooth = false;
        _markers.clear();
        _selected = null;
        _directionRoute = null;
        _input.clear();
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());
      return;
    }

    final prompt = _guideCategoryPrompt(id);
    if (prompt != null && prompt.trim().isNotEmpty) {
      await _runGuideAsk(prompt);
    }
  }

  Future<void> _requestDrivingRoute() async {
    final sel = _selected;
    final u = _userLatLng;
    if (sel == null) return;

    if (u == null || !u.lat.isFinite || !u.lng.isFinite) {
      setState(() {
        _directionRoute = GuideDirectionsResponse.locationRequired();
        _directionsLoading = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());
      return;
    }

    setState(() => _directionsLoading = true);
    try {
      final res = await ref.read(guideRepositoryProvider).postGuideDirections(
            startLat: u.lat,
            startLng: u.lng,
            goalLat: sel.lat,
            goalLng: sel.lng,
          );
      if (!mounted) return;
      setState(() {
        _directionRoute = res;
        _directionsLoading = false;
        if (res.ok && res.path.length >= 2) {
          _cameraSmooth = true;
        }
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());
    } catch (_) {
      if (!mounted) return;
      setState(() => _directionsLoading = false);
    }
  }

  void _onSelectNearby(GuideNearbyPlaceItem item) {
    var slug = item.name
        .replaceAll(RegExp(r"\s+"), "-")
        .replaceAll(RegExp(r"[^a-zA-Z0-9가-힣\-]"), "");
    if (slug.isEmpty) slug = "place";
    slug = slug.substringClamp(0, 32);
    final id =
        "nearby-$slug-${item.lat.toStringAsFixed(4)}-${item.lng.toStringAsFixed(4)}";
    final m = GuideMapMarker(
      id: id,
      lat: item.lat,
      lng: item.lng,
      title: item.name,
      kind: GuideMarkerKind.place,
      address: item.address.trim(),
      category: item.category.trim().isNotEmpty ? item.category.trim() : "screens.guide_explore.food_category_fallback".tr(),
      description: "",
      imageUrl: item.imageUrl.trim().isNotEmpty ? item.imageUrl.trim() : null,
    );
    setState(() {
      if (!_markers.any((p) => p.id == id)) {
        _markers.add(m);
      }
      _selected = m;
      _directionRoute = null;
      _directionsLoading = false;
      _cameraSmooth = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapOverlays());
  }

  @override
  Widget build(BuildContext context) {
    final safePad = MediaQuery.paddingOf(context);
    final assistantBusy = _guideLoading;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                NaverMap(
                  options: NaverMapViewOptions(
                    contentPadding: safePad,
                    initialCameraPosition:
                        const NCameraPosition(target: _kSeoul, zoom: 11),
                    indoorEnable: true,
                    locationButtonEnable: false,
                    logoClickEnable: false,
                  ),
                  onMapReady: (c) async {
                    _mapController = c;
                    await _syncMapOverlays();
                  },
                ),
                if (_showGeminiNotice)
                  Positioned(
                    left: 12,
                    right: 12,
                    top: 12,
                    child: Material(
                      elevation: 2,
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.white.withValues(alpha: 0.92),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        child: Text(
                          "screens.guide_explore.gemini_notice".tr(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0369A1),
                          ),
                        ),
                      ),
                    ),
                  ),
                if (assistantBusy)
                  Positioned.fill(
                    child: AbsorbPointer(
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.12),
                        alignment: Alignment.center,
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 14),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const CircularProgressIndicator(strokeWidth: 2),
                                const SizedBox(width: 12),
                                Text("screens.guide_explore.loading_guide".tr()),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                if (_festivalLoading)
                  Positioned.fill(
                    child: AbsorbPointer(
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.08),
                        alignment: Alignment.center,
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 12),
                            child: Text(
                              "screens.guide_explore.loading_festival".tr(),
                              style: TextStyle(
                                color: Colors.cyan.shade800,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 8,
                  child: _ChatPanel(
                    panelOpen: _chatPanelOpen,
                    onPanelOpenChanged: (v) =>
                        setState(() => _chatPanelOpen = v),
                    messages: _messages,
                    controller: _input,
                    scrollController: _chatScroll,
                    disabled: _busy,
                    assistantLoading: assistantBusy,
                    onSend: () => _runGuideAsk(_input.text),
                  ),
                ),
                if (_selected != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: _mapChatReserveHeight(context),
                    child: _GuidePlaceSheet(
                      key: ValueKey(_selected!.id),
                      marker: _selected!,
                      detailExpanded: _chatPanelOpen,
                      guideAnswerFallback: _lastGuideAnswer,
                      drivingRoute: _directionRoute,
                      directionsLoading: _directionsLoading,
                      onRequestDrivingRoute: _requestDrivingRoute,
                      onClose: () {
                        setState(() {
                          _selected = null;
                          _directionRoute = null;
                        });
                        _syncMapOverlays();
                      },
                      onSelectNearby: _onSelectNearby,
                    ),
                  ),
              ],
            ),
          ),
          _CategoryChipBar(
            active: _activeCategory,
            disabled: _busy,
            onSelect: _onCategorySelect,
          ),
        ],
      ),
    );
  }
}

extension on String {
  String substringClamp(int start, int end) {
    if (length <= start) return "";
    if (length <= end) return substring(start);
    return substring(start, end);
  }
}

class _CategoryChipBar extends StatelessWidget {
  const _CategoryChipBar({
    required this.active,
    required this.disabled,
    required this.onSelect,
  });

  final GuideCategoryId active;
  final bool disabled;
  final void Function(GuideCategoryId id) onSelect;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 1,
      child: SizedBox(
        height: 56,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          children: GuideCategoryId.values.map((id) {
            final isOn = active == id;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _categoryIcon(id),
                      size: 16,
                      color: isOn
                          ? const Color(0xFF0284C7)
                          : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Text(_guideCategoryLabel(id)),
                  ],
                ),
                selected: isOn,
                onSelected: disabled ? null : (_) => onSelect(id),
                selectedColor: const Color(0xFFE0F2FE),
                labelStyle: TextStyle(
                  fontWeight: isOn ? FontWeight.w700 : FontWeight.w500,
                  color:
                      isOn ? const Color(0xFF0369A1) : const Color(0xFF475569),
                  fontSize: 13,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                showCheckmark: false,
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _ChatPanel extends StatelessWidget {
  const _ChatPanel({
    required this.panelOpen,
    required this.onPanelOpenChanged,
    required this.messages,
    required this.controller,
    required this.scrollController,
    required this.disabled,
    required this.assistantLoading,
    required this.onSend,
  });

  final bool panelOpen;
  final ValueChanged<bool> onPanelOpenChanged;
  final List<_ChatMessage> messages;
  final TextEditingController controller;
  final ScrollController scrollController;
  final bool disabled;
  final bool assistantLoading;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final safe = MediaQuery.paddingOf(context).bottom;
    final w = MediaQuery.sizeOf(context).width;
    final barMaxW = math.min(400.0, w * 0.92);

    Widget wrapBar(Widget child) {
      return Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: barMaxW),
            child: child,
          ),
        ),
      );
    }

    if (!panelOpen) {
      return wrapBar(
        Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(28),
          color: Colors.white.withValues(alpha: 0.96),
          shadowColor: Colors.black26,
          child: InkWell(
            onTap: () => onPanelOpenChanged(true),
            borderRadius: BorderRadius.circular(28),
            child: Padding(
              padding: EdgeInsets.fromLTRB(14, 10, 14, 10 + safe),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.keyboard_arrow_down,
                      size: 20, color: Colors.grey.shade600),
                  const SizedBox(width: 6),
                  const Icon(Icons.forum_outlined,
                      color: Color(0xFF0284C7), size: 20),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      "screens.guide_explore.chat_expand".tr(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.keyboard_arrow_up,
                      size: 18, color: Colors.grey.shade500),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final visible = messages.length <= 6
        ? messages
        : messages.sublist(messages.length - 6);

    return wrapBar(
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (visible.isNotEmpty || assistantLoading)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              constraints: const BoxConstraints(maxHeight: 176),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.95),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x14000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                  controller: scrollController,
                  itemCount: visible.length + (assistantLoading ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (assistantLoading && i == visible.length) {
                      return Padding(
                        padding: const EdgeInsets.all(8),
                        child: Row(
                          children: [
                            const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            const SizedBox(width: 8),
                            Text("screens.guide_explore.replying".tr(),
                                style: const TextStyle(fontSize: 12)),
                          ],
                        ),
                      );
                    }
                    final m = visible[i];
                    final isUser = m.role == "user";
                    return Align(
                      alignment: isUser
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        constraints: BoxConstraints(maxWidth: barMaxW * 0.92),
                        decoration: BoxDecoration(
                          color: isUser
                              ? const Color(0xFF38BDF8)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isUser
                                ? const Color(0xFF38BDF8)
                                : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: m.useMarkdown && !isUser
                            ? MarkdownBody(
                                data: m.content,
                                shrinkWrap: true,
                                styleSheet: MarkdownStyleSheet(
                                  p: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF334155),
                                    height: 1.35,
                                  ),
                                ),
                              )
                            : SelectableText(
                                m.content,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isUser
                                      ? Colors.white
                                      : const Color(0xFF334155),
                                  height: 1.35,
                                ),
                              ),
                      ),
                    );
                  },
                ),
              ),
            ),
          Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(28),
            color: Colors.white.withValues(alpha: 0.96),
            shadowColor: Colors.black26,
            child: Padding(
              padding: EdgeInsets.fromLTRB(4, 4, 6, 4 + safe),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.expand_more, size: 22),
                    tooltip: "screens.guide_explore.chat_collapse".tr(),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFFF1F5F9),
                      foregroundColor: const Color(0xFF475569),
                      visualDensity: VisualDensity.compact,
                    ),
                    onPressed: () => onPanelOpenChanged(false),
                  ),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      minLines: 1,
                      maxLines: 1,
                      enabled: !disabled,
                      textInputAction: TextInputAction.send,
                      style: const TextStyle(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: "screens.guide_explore.input_hint".tr(),
                        hintStyle: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        isDense: true,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                      ),
                      onSubmitted: disabled ? null : (_) => onSend(),
                    ),
                  ),
                  const SizedBox(width: 4),
                  FilledButton(
                    onPressed: disabled ? null : onSend,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      minimumSize: const Size(40, 40),
                      maximumSize: const Size(40, 40),
                      padding: EdgeInsets.zero,
                      shape: const CircleBorder(),
                    ),
                    child: const Icon(Icons.send_rounded, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GuidePlaceSheet extends ConsumerStatefulWidget {
  const _GuidePlaceSheet({
    super.key,
    required this.marker,
    required this.detailExpanded,
    required this.guideAnswerFallback,
    required this.drivingRoute,
    required this.directionsLoading,
    required this.onRequestDrivingRoute,
    required this.onClose,
    required this.onSelectNearby,
  });

  final GuideMapMarker marker;
  /// 채팅 패널 연동 — 접혀 있으면 시트 초기 높이를 낮춤(맵·경로 확인용)
  final bool detailExpanded;
  final String? guideAnswerFallback;
  final GuideDirectionsResponse? drivingRoute;
  final bool directionsLoading;
  final VoidCallback onRequestDrivingRoute;
  final VoidCallback onClose;
  final void Function(GuideNearbyPlaceItem item) onSelectNearby;

  @override
  ConsumerState<_GuidePlaceSheet> createState() => _GuidePlaceSheetState();
}

class _GuidePlaceSheetState extends ConsumerState<_GuidePlaceSheet> {
  GuidePlaceDetailsResponse? _details;
  List<GuideNearbyPlaceItem> _nearby = const [];
  bool _loadingDetails = true;
  String? _error;

  Future<void> _copyAddress(BuildContext context, String raw) async {
    final t = raw.trim();
    if (t.isEmpty || t == "정보 없음") return;
    await Clipboard.setData(ClipboardData(text: t));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("주소를 복사했습니다"),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  Widget _addressCopyCard(BuildContext context, String address) {
    final t = address.trim();
    if (t.isEmpty || t == "정보 없음") return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Icon(Icons.location_on,
                    color: Color(0xFF0284C7), size: 22),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10, bottom: 10),
                  child: Text(
                    t,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: Color(0xFF334155),
                    ),
                  ),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.copy_rounded, size: 20),
                tooltip: "screens.guide_explore.copy_address".tr(),
                onPressed: () => _copyAddress(context, t),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: Text(
              k,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(v, style: const TextStyle(fontSize: 13, height: 1.35)),
          ),
        ],
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final m = widget.marker;
    if (m.kind == GuideMarkerKind.festival) {
      setState(() {
        _loadingDetails = false;
        _details = null;
      });
      return;
    }

    final repo = ref.read(guideRepositoryProvider);
    setState(() {
      _loadingDetails = true;
      _error = null;
    });
    try {
      final d = await repo.fetchPlaceDetails(m.title);
      final nearby = await repo.fetchNearbyPlaces(
        x: m.lng,
        y: m.lat,
        name: m.title,
        category: _nearbyCategoryParam(m),
      );
      if (!mounted) return;
      setState(() {
        _details = d;
        _nearby = nearby.items;
        _loadingDetails = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loadingDetails = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.marker;

    return DraggableScrollableSheet(
      minChildSize: 0.13,
      maxChildSize: 0.9,
      initialChildSize: widget.detailExpanded ? 0.38 : 0.24,
      snap: true,
      snapSizes: const [0.13, 0.24, 0.28, 0.38, 0.45, 0.68, 0.88],
      builder: (context, scrollController) {
        return Material(
          elevation: 12,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          color: Colors.white,
          clipBehavior: Clip.antiAlias,
          child: CustomScrollView(
            controller: scrollController,
            physics: const ClampingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(height: 8),
                    Center(
                      child: Container(
                        width: 40,
                        height: 5,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 0, 4, 0),
                      child: Row(
                        children: [
                          const Icon(Icons.place_outlined,
                              color: Color(0xFF0284C7), size: 22),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              m.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (m.kind != GuideMarkerKind.festival)
                            IconButton(
                              onPressed: widget.directionsLoading
                                  ? null
                                  : widget.onRequestDrivingRoute,
                              icon: widget.directionsLoading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Icon(Icons.directions_car_outlined),
                              tooltip:
                                  "screens.guide_explore.driving_route".tr(),
                            ),
                          IconButton(
                            onPressed: widget.onClose,
                            icon: const Icon(Icons.close),
                            tooltip: "screens.guide_explore.close".tr(),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                  ],
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (m.kind == GuideMarkerKind.festival) ...[
                        if (m.fstvlStartDate != null &&
                            m.fstvlEndDate != null)
                          Text(
                            "screens.guide_explore.period".tr(namedArgs: {
                              "start": "${m.fstvlStartDate}",
                              "end": "${m.fstvlEndDate}",
                            }),
                            style: const TextStyle(fontSize: 13),
                          ),
                        if ((m.opar ?? "").isNotEmpty)
                          Text(
                            "screens.guide_explore.venue".tr(namedArgs: {"name": m.opar!}),
                            style: const TextStyle(fontSize: 13),
                          ),
                        if (m.description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(m.description,
                                style: const TextStyle(fontSize: 13, height: 1.4)),
                          ),
                        if ((m.homepageUrl ?? "").trim().isNotEmpty)
                          TextButton.icon(
                            onPressed: () async {
                              final u = Uri.tryParse(m.homepageUrl!.trim());
                              if (u != null) {
                                try {
                                  await launchUrl(u,
                                      mode: LaunchMode.externalApplication);
                                } catch (_) {}
                              }
                            },
                            icon: const Icon(Icons.open_in_new, size: 16),
                            label: const Text("홈페이지"),
                          ),
                        if (m.address.trim().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: _addressCopyCard(context, m.address),
                          ),
                      ] else ...[
                        if (_loadingDetails)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Center(child: CircularProgressIndicator()),
                          )
                        else if (_error != null)
                          Text(_error!,
                              style: const TextStyle(
                                  color: Color(0xFFDC2626), fontSize: 12))
                        else ...[
                          _imageBlock(m, _details),
                          const SizedBox(height: 10),
                          _addressCopyCard(
                              context, _effectiveAddress(m, _details)),
                          _kv("screens.guide_explore.category_label".tr(), _effectiveCategory(m, _details)),
                          if (m.summary != null && m.summary!.isNotEmpty)
                            Text(m.summary!,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600)),
                          if (m.recommendationPoints != null &&
                              m.recommendationPoints!.isNotEmpty)
                            ...m.recommendationPoints!.map(
                              (p) => Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text("${p.icon} ${p.text}",
                                    style: const TextStyle(fontSize: 12)),
                              ),
                            ),
                          if ((m.tip ?? "").trim().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text("💡 ${m.tip}",
                                  style: const TextStyle(fontSize: 12)),
                            ),
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              _bodyText(m),
                              style: const TextStyle(fontSize: 13, height: 1.45),
                            ),
                          ),
                          if (_nearby.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text("screens.guide_explore.nearby_title".tr(),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 120,
                              child: ListView(
                                primary: false,
                                scrollDirection: Axis.horizontal,
                                children: _nearby.map((it) {
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 10),
                                    child: InkWell(
                                      onTap: () => widget.onSelectNearby(it),
                                      child: SizedBox(
                                        width: 140,
                                        child: Card(
                                          child: Padding(
                                            padding: const EdgeInsets.all(8),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  it.name,
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                                const Spacer(),
                                                Text(
                                                  "${it.distanceM.round()}m",
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    color: Colors.grey.shade700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ],
                        _drivingSection(),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _drivingSection() {
    final r = widget.drivingRoute;
    if (widget.directionsLoading && r == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Text(
          "screens.guide_explore.driving_loading".tr(),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
        ),
      );
    }
    if (r == null) return const SizedBox.shrink();
    if (!r.ok) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              r.message ?? "screens.guide_explore.driving_unsupported".tr(),
              style: const TextStyle(fontSize: 13),
            ),
            TextButton(
              onPressed: widget.onRequestDrivingRoute,
              child: Text("common.retry".tr()),
            ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "screens.guide_explore.driving_line".tr(namedArgs: {
              "duration": _formatDurationMs(r.durationMs),
              "distance": _formatKm(r.distanceM),
            }),
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          if (r.tollFare > 0)
            Text(
              "screens.guide_explore.toll".tr(namedArgs: {"amount": "${r.tollFare}"}),
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
        ],
      ),
    );
  }

  String _bodyText(GuideMapMarker m) {
    if (m.description.trim().isNotEmpty) return m.description.trim();
    final fb = widget.guideAnswerFallback;
    if (fb != null && fb.isNotEmpty) {
      final extracted = extractPlaceSectionFromAnswer(fb, m.title);
      if (extracted.isNotEmpty) return extracted;
    }
    return "screens.guide_explore.no_detail".tr();
  }

  Widget _imageBlock(GuideMapMarker m, GuidePlaceDetailsResponse? d) {
    final url = (d?.imageUrl != null && d!.imageUrl!.isNotEmpty)
        ? d.imageUrl
        : m.imageUrl;
    if (url == null || url.isEmpty) return const SizedBox.shrink();
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        url,
        height: 140,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
      ),
    );
  }

  String _effectiveAddress(GuideMapMarker m, GuidePlaceDetailsResponse? d) {
    final a = d?.address.trim() ?? "";
    if (a.isNotEmpty && !_guideIsMissingInfo(a)) return a;
    final ma = m.address.trim();
    return ma.isNotEmpty ? ma : "screens.guide_explore.info_none".tr();
  }

  String _effectiveCategory(GuideMapMarker m, GuidePlaceDetailsResponse? d) {
    final c = d?.category.trim() ?? "";
    if (c.isNotEmpty && !_guideIsMissingInfo(c)) return c;
    return m.category.isNotEmpty ? m.category : "screens.guide_explore.info_none".tr();
  }
}
