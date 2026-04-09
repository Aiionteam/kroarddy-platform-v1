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

const _geminiNotice =
    "사용자님의 평소 취향과 현재 환경을 분석해 AI가 새로운 장소를 추천합니다";

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

const Map<GuideCategoryId, String> _categoryLabels = {
  GuideCategoryId.all: "전체",
  GuideCategoryId.festival: "행사",
  GuideCategoryId.activity: "K-액티비티",
  GuideCategoryId.historic: "역사/유적",
  GuideCategoryId.culture: "로컬문화",
  GuideCategoryId.nature: "자연/힐링",
  GuideCategoryId.restaurant: "맛집",
  GuideCategoryId.cafe: "카페",
};

const Map<GuideCategoryId, String> _categoryChatPrompts = {
  GuideCategoryId.activity: "K-액티비티로 즐길 만한 여행지를 추천해줘",
  GuideCategoryId.historic: "한국의 역사·유적 명소를 추천해줘",
  GuideCategoryId.culture: "로컬 문화를 체험할 수 있는 곳을 추천해줘",
  GuideCategoryId.nature: "자연과 힐링을 즐길 수 있는 여행지를 추천해줘",
  GuideCategoryId.restaurant: "지역 맛집을 추천해줘",
  GuideCategoryId.cafe: "분위기 좋은 카페를 추천해줘",
};

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
  if (count == 0) return "추천 장소가 없습니다.";
  const maxShow = 4;
  final head = names.take(maxShow).map((n) => "📍 $n").join(", ");
  final tail = count > maxShow ? " 외 ${count - maxShow}곳" : "";
  return "$head$tail 등 총 $count곳을 추천했어요.\n지도에서 마커를 눌러 장소별 상세 가이드를 확인해 보세요.";
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
  if (minutes < 60) return "약 $minutes분";
  final h = minutes ~/ 60;
  final rm = minutes % 60;
  return "약 $h시간 $rm분";
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

  /// 웹 ChatDrawer — 기본 펼침
  bool _chatPanelOpen = true;

  static const _kSeoul = NLatLng(37.5665, 126.9780);

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
      return 56 + safe + 10;
    }
    final hasBubbleArea = _messages.isNotEmpty || _guideLoading;
    const inputBar = 62.0;
    const verticalPad = 20.0;
    final listBlock = hasBubbleArea ? 176.0 : 0.0;
    return listBlock + inputBar + verticalPad + safe + 8;
  }

  Future<void> _syncMapOverlays() async {
    final c = _mapController;
    if (c == null) return;
    await c.clearOverlays();
    final overlays = <NAddableOverlay>{};
    for (final m in _markers) {
      final marker = NMarker(
        id: m.id,
        position: NLatLng(m.lat, m.lng),
        caption: NOverlayCaption(text: m.title),
        iconTintColor: _selected?.id == m.id
            ? const Color(0xFF0EA5E9)
            : Colors.transparent,
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
          content: "요청이 너무 빈번합니다. 1초 후 다시 시도해 주세요.",
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
        const hint =
            "\n\n*지도에 표시할 좌표는 찾지 못했어요. 지명·구체적인 장소 이름을 넣어 다시 질문해 보세요.*";
        _pushMessage(
          _ChatMessage(
            id: _newId(),
            role: "assistant",
            content: (clipped.isEmpty ? "답변을 가져오지 못했습니다." : clipped) + hint,
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
                ? "이번 달 행사 ${markers.length}곳을 지도에 표시했어요. (${data.year}년 ${data.month}월)"
                : "표시할 좌표가 있는 행사가 없거나 API 응답이 비었습니다.",
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
            content: "행사 정보를 불러오지 못했습니다: $e",
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

    final prompt = _categoryChatPrompts[id];
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
      category: item.category.trim().isNotEmpty ? item.category.trim() : "맛집·카페",
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
                          _geminiNotice,
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
                        child: const Card(
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                                horizontal: 20, vertical: 14),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                CircularProgressIndicator(strokeWidth: 2),
                                SizedBox(width: 12),
                                Text("가이드 응답 생성 중…"),
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
                              "행사 정보 불러오는 중…",
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
                  left: 10,
                  right: 10,
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
                    Text(_categoryLabels[id] ?? id.name),
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
    if (!panelOpen) {
      return Material(
        elevation: 6,
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.92),
        shadowColor: Colors.black26,
        child: InkWell(
          onTap: () => onPanelOpenChanged(true),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 14 + safe),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.forum_outlined,
                    color: Color(0xFF0284C7), size: 22),
                const SizedBox(width: 8),
                const Text(
                  "채팅·장소 설명 열기",
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(width: 6),
                Icon(Icons.keyboard_arrow_up,
                    size: 20, color: Colors.grey.shade500),
              ],
            ),
          ),
        ),
      );
    }

    final visible = messages.length <= 6
        ? messages
        : messages.sublist(messages.length - 6);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (visible.isNotEmpty || assistantLoading)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            constraints: const BoxConstraints(maxHeight: 176),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(12),
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
              borderRadius: BorderRadius.circular(11),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                controller: scrollController,
                itemCount: visible.length + (assistantLoading ? 1 : 0),
                itemBuilder: (context, i) {
                  if (assistantLoading && i == visible.length) {
                    return const Padding(
                      padding: EdgeInsets.all(8),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text("응답 작성 중…", style: TextStyle(fontSize: 12)),
                        ],
                      ),
                    );
                  }
                  final m = visible[i];
                  final isUser = m.role == "user";
                  return Align(
                    alignment:
                        isUser ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.sizeOf(context).width * 0.82,
                      ),
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
          borderRadius: BorderRadius.circular(14),
          color: Colors.white.withValues(alpha: 0.92),
          shadowColor: Colors.black26,
          child: Padding(
            padding: EdgeInsets.fromLTRB(6, 6, 8, 6 + safe),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.expand_more, size: 26),
                  tooltip: "채팅·장소 설명 접기",
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    foregroundColor: const Color(0xFF475569),
                  ),
                  onPressed: () => onPanelOpenChanged(false),
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    enabled: !disabled,
                    decoration: InputDecoration(
                      hintText: "장소에 대해 물어보세요",
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.5),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                    ),
                    onSubmitted: disabled ? null : (_) => onSend(),
                  ),
                ),
                const SizedBox(width: 6),
                FilledButton(
                  onPressed: disabled ? null : onSend,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Icon(Icons.send_rounded, size: 20),
                ),
              ],
            ),
          ),
        ),
      ],
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
  /// 채팅 패널과 연동 — `false`면 한 줄 요약만(지도·경로 확인용)
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
                tooltip: "주소 복사",
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

    if (!widget.detailExpanded) {
      return Material(
        elevation: 12,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        color: Colors.white,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(6, 2, 4, 8),
            child: Row(
              children: [
                const Icon(Icons.place_outlined,
                    color: Color(0xFF0284C7), size: 22),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    m.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
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
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.directions_car_outlined),
                    tooltip: "자동차 경로",
                  ),
                IconButton(
                  onPressed: widget.onClose,
                  icon: const Icon(Icons.close),
                  tooltip: "닫기",
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Material(
      elevation: 12,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      color: Colors.white,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.48,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const SizedBox(width: 12),
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
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.directions_car_outlined),
                    tooltip: "자동차 경로",
                  ),
                IconButton(
                  onPressed: widget.onClose,
                  icon: const Icon(Icons.close),
                  tooltip: "닫기",
                ),
              ],
            ),
            const Divider(height: 1),
            Flexible(
              child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (m.kind == GuideMarkerKind.festival) ...[
                        if (m.fstvlStartDate != null &&
                            m.fstvlEndDate != null)
                          Text(
                            "기간: ${m.fstvlStartDate} ~ ${m.fstvlEndDate}",
                            style: const TextStyle(fontSize: 13),
                          ),
                        if ((m.opar ?? "").isNotEmpty)
                          Text("장소: ${m.opar}", style: const TextStyle(fontSize: 13)),
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
                          _kv("카테고리", _effectiveCategory(m, _details)),
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
                            const Text("주변 맛집·카페",
                                style: TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 120,
                              child: ListView(
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
        ),
      );
  }

  Widget _drivingSection() {
    final r = widget.drivingRoute;
    if (widget.directionsLoading && r == null) {
      return const Padding(
        padding: EdgeInsets.only(top: 12),
        child: Text("경로를 불러오는 중…",
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
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
              r.message ??
                  "자동차 경로를 지원하지 않는 구간입니다. 다른 이동 수단을 이용해 보세요.",
              style: const TextStyle(fontSize: 13),
            ),
            TextButton(
              onPressed: widget.onRequestDrivingRoute,
              child: const Text("다시 시도"),
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
            "자동차 이동: ${_formatDurationMs(r.durationMs)} · ${_formatKm(r.distanceM)}",
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          if (r.tollFare > 0)
            Text("통행료 약 ${r.tollFare}원",
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
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
    return "상세 설명이 없습니다.";
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
    if (a.isNotEmpty && a != "정보 없음") return a;
    return m.address.trim().isNotEmpty ? m.address : "정보 없음";
  }

  String _effectiveCategory(GuideMapMarker m, GuidePlaceDetailsResponse? d) {
    final c = d?.category.trim() ?? "";
    if (c.isNotEmpty && c != "정보 없음") return c;
    return m.category.isNotEmpty ? m.category : "정보 없음";
  }
}
