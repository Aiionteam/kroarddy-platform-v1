"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { useGuide } from "@/hooks/useGuide";
import { AppLayout } from "@/components/organisms/AppLayout";
import { MapContainer, type MapMarker } from "@/components/guide/MapContainer";
import { PlaceBottomSheet } from "@/components/guide/PlaceBottomSheet";
import { ChatDrawer, type ChatMessage } from "@/components/guide/ChatDrawer";
import {
  CategoryChipBar,
  CATEGORY_CHAT_PROMPTS,
  type GuideCategoryId,
} from "@/components/guide/CategoryChipBar";
import { fetchFestivals, type FestivalItem } from "@/lib/api/festival";
import type { GuideNearbyPlaceItem, GuidePlaceMarker } from "@/lib/guide/types";
import { parsePlaceLatLng } from "@/lib/guide/parsePlace";
import { guideDebug } from "@/lib/guide/guideDebug";
import { stripPlacesJsonBlock } from "@/lib/guide/extractPlaceFromAnswer";
import { getCurrentPositionOrNull } from "@/lib/guide/geolocation";
import { postGuideDirections } from "@/lib/guide/guideClient";
import type { GuideDirectionsResponse } from "@/lib/guide/types";

/** 채팅창용 — 긴 answer 대신 장소 이름 목록만 */
function buildPlacesAssistantSummary(places: GuidePlaceMarker[]): string {
  const names = places.map((p) => (p.name || "").trim()).filter(Boolean);
  const count = names.length;
  if (count === 0) return "추천 장소가 없습니다.";
  const maxShow = 4;
  const head = names.slice(0, maxShow);
  const listed = head.map((n) => `📍 ${n}`).join(", ");
  const tail = count > maxShow ? ` 외 ${count - maxShow}곳` : "";
  return `${listed}${tail} 등 총 ${count}곳을 추천했어요.\n지도에서 마커를 눌러 장소별 상세 가이드를 확인해 보세요.`;
}

function parseFestivalCoord(v: string | number | null | undefined): number {
  if (v == null) return NaN;
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  const s = String(v).trim().replace(/,/g, ".");
  if (!s) return NaN;
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/** 공공데이터·게이트웨이에서 위·경도 순서가 바뀐 경우 보정 (지도·directions 검증과 동일 기준). */
function normalizeFestivalLatLng(lat: number, lng: number): { lat: number; lng: number } {
  if (!isFinite(lat) || !isFinite(lng)) return { lat, lng };
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90 && Math.abs(lng) >= 1) {
    return { lat: lng, lng: lat };
  }
  return { lat, lng };
}

function festivalItemsToMarkers(items: FestivalItem[]): MapMarker[] {
  return items
    .map((it, i) => {
      let lat = parseFestivalCoord(it.latitude);
      let lng = parseFestivalCoord(it.longitude);
      ({ lat, lng } = normalizeFestivalLatLng(lat, lng));
      return {
        id: `fest-${i}-${it.fstvlNm?.slice(0, 20) || i}`,
        lat,
        lng,
        title: it.fstvlNm || "행사",
        kind: "festival" as const,
        address: [it.rdnmadr, it.lnmadr].find((s) => s?.trim()) || it.opar || "",
        category: "행사",
        description: it.fstvlCo || it.relateInfo || "",
        festival: {
          startDate: it.fstvlStartDate,
          endDate: it.fstvlEndDate,
          opar: it.opar,
          homepageUrl: it.homepageUrl,
        },
      };
    })
    .filter((m) => isFinite(m.lat) && isFinite(m.lng) && !(m.lat === 0 && m.lng === 0));
}

function guidePlacesToMarkers(places: GuidePlaceMarker[]): MapMarker[] {
  const out: MapMarker[] = [];
  places.forEach((p, i) => {
    const ll = parsePlaceLatLng(p.lat, p.lng);
    if (!ll) return;
    const name = (p.name || "장소").trim() || "장소";
    const img = typeof p.image_url === "string" && p.image_url.trim() ? p.image_url.trim() : undefined;
    const ps = p.photo_spot;
    const kw = Array.isArray(p.keywords) ? p.keywords.filter((x) => typeof x === "string" && x.trim()) : [];
    const pts = Array.isArray(p.points)
      ? p.points
          .filter(
            (x): x is { icon: string; text: string } =>
              x != null &&
              typeof x === "object" &&
              typeof (x as { text?: unknown }).text === "string" &&
              String((x as { text: string }).text).trim().length > 0,
          )
          .slice(0, 3)
          .map((x) => ({
            icon: String((x as { icon?: unknown }).icon ?? "").slice(0, 16),
            text: String((x as { text: string }).text).trim().slice(0, 200),
          }))
      : [];
    out.push({
      id: `place-${i}-${name}-${ll.lat.toFixed(5)}-${ll.lng.toFixed(5)}`,
      lat: ll.lat,
      lng: ll.lng,
      title: name,
      address: p.address ?? "",
      category: p.category ?? "",
      summary: typeof p.summary === "string" ? p.summary.trim().slice(0, 40) : undefined,
      recommendationPoints: pts.length ? pts : undefined,
      tip: typeof p.tip === "string" ? p.tip.trim().slice(0, 240) : undefined,
      description: p.description ?? "",
      imageUrl: img,
      kind: "place",
      photoSpot: typeof ps === "string" && ps.trim() ? ps.trim() : undefined,
      estimatedCost: (p.estimated_cost ?? "").trim(),
      visitDuration: (p.duration ?? "").trim(),
      keywords: kw.slice(0, 3),
    });
  });
  return out;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const GEMINI_NOTICE =
  "사용자님의 평소 취향과 현재 환경을 분석해 AI가 새로운 장소를 추천합니다";

export default function GuidePage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const { loading: guideLoading, ask, setError } = useGuide();

  const [activeCategory, setActiveCategory] = useState<GuideCategoryId>("all");
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [festivalLoading, setFestivalLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapMarker | null>(null);
  /** 마커 시트 폴백: answer 본문에서 장소 단락 발췌 */
  const [lastGuideAnswer, setLastGuideAnswer] = useState<string | null>(null);
  const [showGeminiNotice, setShowGeminiNotice] = useState(false);
  const [mapCameraAnimation, setMapCameraAnimation] = useState<"instant" | "smooth">("instant");
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [directionRoute, setDirectionRoute] = useState<GuideDirectionsResponse | null>(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  /** 0이면 미요청 — 마커 선택 시 리셋, 버튼 클릭마다 증가해 경로 API 재실행 */
  const [directionsRequestToken, setDirectionsRequestToken] = useState(0);
  /** 연타·더블 클릭 시 중복 ask 방지 (입력 디바운스와 별도, VRAM 부하 완화) */
  const lastSendAttemptRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pos = await getCurrentPositionOrNull();
      if (!cancelled && pos && isFinite(pos.lat) && isFinite(pos.lng)) {
        setUserLatLng({ lat: pos.lat, lng: pos.lng });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selId = selectedPlace?.id;
  const goalLat = selectedPlace?.lat;
  const goalLng = selectedPlace?.lng;
  const userLat = userLatLng?.lat;
  const userLng = userLatLng?.lng;

  useEffect(() => {
    setDirectionRoute(null);
    setDirectionsRequestToken(0);
  }, [selId]);

  useEffect(() => {
    if (directionsRequestToken === 0) {
      return;
    }
    if (!selId || goalLat == null || goalLng == null) {
      setDirectionsLoading(false);
      return;
    }
    if (!isFinite(goalLat) || !isFinite(goalLng)) {
      setDirectionsLoading(false);
      return;
    }
    if (userLat == null || userLng == null || !isFinite(userLat) || !isFinite(userLng)) {
      setDirectionRoute({
        ok: false,
        path: [],
        distance_m: 0,
        duration_ms: 0,
        toll_fare: 0,
        fuel_price: 0,
        message:
          "현재 위치를 확인할 수 없어 차량 경로를 안내할 수 없어요. 위치 권한을 허용한 뒤 다시 시도해 주세요.",
      });
      setDirectionsLoading(false);
      return;
    }

    let cancelled = false;
    setDirectionsLoading(true);
    void (async () => {
      try {
        const res = await postGuideDirections({
          start_lat: userLat,
          start_lng: userLng,
          goal_lat: goalLat,
          goal_lng: goalLng,
        });
        if (!cancelled) setDirectionRoute(res);
      } finally {
        if (!cancelled) setDirectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setDirectionsLoading(false);
    };
  }, [directionsRequestToken, selId, goalLat, goalLng, userLat, userLng]);

  const requestDrivingRoute = useCallback(() => {
    setDirectionsRequestToken((n) => n + 1);
  }, []);

  const busy = festivalLoading || guideLoading;
  /** 지도 전체 오버레이는 가이드 ask 중에만 (경로 로딩은 바텀시트에서 표시) */
  const assistantGuideBusy = guideLoading;
  useEffect(() => {
    guideDebug("page.busy", { festivalLoading, guideLoading, busy });
  }, [festivalLoading, guideLoading, busy]);

  const runGuideAsk = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        guideDebug("page.runGuideAsk.abort", { reason: "empty_text" });
        return;
      }
      if (busy) {
        guideDebug("page.runGuideAsk.abort", { reason: "busy" });
        return;
      }

      const now = Date.now();
      if (now - lastSendAttemptRef.current < 600) {
        guideDebug("page.runGuideAsk.throttled", {
          deltaMs: now - lastSendAttemptRef.current,
          minMs: 600,
        });
        return;
      }
      lastSendAttemptRef.current = now;

      setShowGeminiNotice(false);
      setLastGuideAnswer(null);
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: trimmed, at: Date.now() },
      ]);

      try {
        const res = await ask(trimmed);
        const placesCount = Array.isArray(res.places) ? res.places.length : 0;
        const markers = placesCount > 0 ? guidePlacesToMarkers(res.places) : [];

        if (placesCount === 0) {
          guideDebug("page.runGuideAsk.placesEmpty", {
            source: res.source,
            message: "장소 정보를 불러오지 못했습니다",
          });
        }

        setMapMarkers(markers);
        setSelectedPlace(null);
        setLastGuideAnswer(stripPlacesJsonBlock(res.answer || "") || null);
        setShowGeminiNotice(res.source === "gemini_search");
        setMapCameraAnimation(markers.length > 0 ? "smooth" : "instant");
        setMessages((prev) => {
          const base: ChatMessage[] = [...prev];
          if (placesCount > 0) {
            base.push({
              id: newId(),
              role: "assistant",
              content: buildPlacesAssistantSummary(res.places),
              at: Date.now(),
              assistantBodyFormat: "plain",
            });
          } else {
            const raw = (res.answer || "").trim();
            const maxLen = 360;
            const clipped =
              raw.length > maxLen ? `${raw.slice(0, maxLen).trim()}…` : raw;
            const hint =
              "\n\n*지도에 표시할 좌표는 찾지 못했어요. 지명·구체적인 장소 이름을 넣어 다시 질문해 보세요.*";
            base.push({
              id: newId(),
              role: "assistant",
              content: (clipped || "답변을 가져오지 못했습니다.") + hint,
              at: Date.now(),
              assistantBodyFormat: "markdown",
            });
          }
          return base;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "가이드 응답을 가져오지 못했습니다.";
        guideDebug("page.runGuideAsk.error", { message: msg });
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: msg,
            at: Date.now(),
          },
        ]);
      }
    },
    [ask, busy],
  );

  const handleCategorySelect = useCallback(async (id: GuideCategoryId) => {
    setActiveCategory(id);
    setShowGeminiNotice(false);
    setError(null);

    if (id === "festival") {
      setMapCameraAnimation("instant");
      setFestivalLoading(true);
      setMapMarkers([]);
      try {
        const data = await fetchFestivals();
        const markers = festivalItemsToMarkers(data.items || []);
        setMapMarkers(markers);
        setSelectedPlace(null);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content:
              markers.length > 0
                ? `이번 달 행사 ${markers.length}곳을 지도에 표시했어요. (${data.year}년 ${data.month}월)`
                : "표시할 좌표가 있는 행사가 없거나 API 응답이 비었습니다.",
            at: Date.now(),
          },
        ]);
      } catch (e) {
        setMapMarkers([]);
        setSelectedPlace(null);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: `행사 정보를 불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
            at: Date.now(),
          },
        ]);
      } finally {
        setFestivalLoading(false);
      }
      return;
    }

    if (id === "all") {
      setLastGuideAnswer(null);
      setMapCameraAnimation("instant");
      setMapMarkers([]);
      setInput("");
      return;
    }

    const prompt = CATEGORY_CHAT_PROMPTS[id]?.trim();
    if (prompt) {
      await runGuideAsk(prompt);
    }
  }, [setError, runGuideAsk]);

  const handleMarkerClick = useCallback((m: MapMarker) => {
    setSelectedPlace(m);
  }, []);

  const handleSelectNearbyPlace = useCallback((item: GuideNearbyPlaceItem) => {
    const slug = item.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9가-힣-_]/g, "")
      .slice(0, 32);
    const id = `nearby-${slug || "place"}-${item.lat.toFixed(4)}-${item.lng.toFixed(4)}`;
    const m: MapMarker = {
      id,
      lat: item.lat,
      lng: item.lng,
      title: item.name,
      address: item.address?.trim() || "",
      category: item.category?.trim() || "맛집·카페",
      description: "",
      kind: "place",
      imageUrl: item.imageUrl?.trim() || undefined,
    };
    setMapMarkers((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, m]));
    setSelectedPlace(m);
    setMapCameraAnimation("smooth");
  }, []);

  const handleSend = useCallback(async () => {
    guideDebug("page.handleSend.invoked", { inputLen: input.trim().length });
    await runGuideAsk(input);
  }, [runGuideAsk, input]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout} mobileTitle="장소 추천">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50 md:h-full">
        <div className="relative z-0 flex min-h-0 flex-1 flex-col">
          {showGeminiNotice && (
            <div className="pointer-events-none absolute left-3 right-3 top-3 z-[8] rounded-md border border-gray-200 bg-white/90 px-4 py-3 text-center text-xs font-bold text-guide shadow-sm backdrop-blur-md md:left-1/2 md:right-auto md:w-[min(92vw,28rem)] md:-translate-x-1/2 md:text-sm md:font-bold">
              {GEMINI_NOTICE}
            </div>
          )}
          <MapContainer
            markers={mapMarkers}
            onMarkerClick={handleMarkerClick}
            cameraAnimation={mapCameraAnimation}
            selectedMarkerId={selectedPlace?.id ?? null}
            directionPolylinePath={
              directionsRequestToken > 0 &&
              directionRoute?.ok &&
              directionRoute.path &&
              directionRoute.path.length >= 2
                ? directionRoute.path
                : null
            }
            showSearchingOverlay={assistantGuideBusy}
            className="flex-1"
          />
          {festivalLoading && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/10">
              <div className="rounded-md border border-gray-100 bg-white px-5 py-3 text-sm font-medium text-sky-700 shadow-md">
                행사 정보 불러오는 중…
              </div>
            </div>
          )}
        </div>

        <CategoryChipBar
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          disabled={busy}
        />

        <ChatDrawer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          messages={messages}
          disabled={busy}
          assistantLoading={assistantGuideBusy}
        />

        <PlaceBottomSheet
          marker={selectedPlace}
          guideAnswerFallback={lastGuideAnswer}
          drivingRoute={directionRoute}
          directionsLoading={directionsLoading}
          onRequestDrivingRoute={requestDrivingRoute}
          onClose={() => setSelectedPlace(null)}
          onSelectNearbyPlace={handleSelectNearbyPlace}
        />
      </div>
    </AppLayout>
  );
}
