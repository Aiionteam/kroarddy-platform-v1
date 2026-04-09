"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
import { useLoginStore } from "@/store";
import { useGuide } from "@/hooks/useGuide";
import { AppLayout } from "@/components/organisms/AppLayout";
import { MapContainer, type MapMarker } from "@/components/guide/MapContainer";
import { PlaceBottomSheet } from "@/components/guide/PlaceBottomSheet";
import { ChatDrawer, type ChatMessage } from "@/components/guide/ChatDrawer";
import { CategoryChipBar, type GuideCategoryId } from "@/components/guide/CategoryChipBar";
import { fetchFestivals, type FestivalItem } from "@/lib/api/festival";
import type { GuideNearbyPlaceItem, GuidePlaceMarker } from "@/lib/guide/types";
import { parsePlaceLatLng } from "@/lib/guide/parsePlace";
import { guideDebug } from "@/lib/guide/guideDebug";
import { stripPlacesJsonBlock } from "@/lib/guide/extractPlaceFromAnswer";
import { getCurrentPositionOrNull } from "@/lib/guide/geolocation";
import { postGuideDirections } from "@/lib/guide/guideClient";
import type { GuideDirectionsResponse } from "@/lib/guide/types";

/** 채팅창용 — 긴 answer 대신 장소 이름 목록만 */
function buildPlacesAssistantSummary(
  places: GuidePlaceMarker[],
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  const names = places.map((p) => (p.name || "").trim()).filter(Boolean);
  const count = names.length;
  if (count === 0) return t("guide.places_none", { defaultValue: "No places to recommend." });
  const maxShow = 4;
  const head = names.slice(0, maxShow);
  const listed = head.map((n) => `📍 ${n}`).join(", ");
  const extra =
    count > maxShow
      ? t("guide.places_extra", { n: count - maxShow, defaultValue: ", and {{n}} more" })
      : "";
  return t("guide.places_summary", {
    listed,
    extra,
    count,
    defaultValue: "{{listed}}{{extra}} — {{count}} places recommended.\nTap a marker on the map for details.",
  });
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

function festivalItemsToMarkers(
  items: FestivalItem[],
  t: (key: string, o?: Record<string, unknown>) => string,
): MapMarker[] {
  const ev = t("guide.marker_event", { defaultValue: "Event" });
  return items
    .map((it, i) => {
      let lat = parseFestivalCoord(it.latitude);
      let lng = parseFestivalCoord(it.longitude);
      ({ lat, lng } = normalizeFestivalLatLng(lat, lng));
      return {
        id: `fest-${i}-${it.fstvlNm?.slice(0, 20) || i}`,
        lat,
        lng,
        title: it.fstvlNm || ev,
        kind: "festival" as const,
        address: [it.rdnmadr, it.lnmadr].find((s) => s?.trim()) || it.opar || "",
        category: ev,
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

function guidePlacesToMarkers(
  places: GuidePlaceMarker[],
  t: (key: string, o?: Record<string, unknown>) => string,
): MapMarker[] {
  const fallback = t("guide.marker_place", { defaultValue: "Place" });
  const out: MapMarker[] = [];
  places.forEach((p, i) => {
    const ll = parsePlaceLatLng(p.lat, p.lng);
    if (!ll) return;
    const name = (p.name || fallback).trim() || fallback;
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

export default function GuidePage() {
  const router = useRouter();
  const { t } = useTranslation();
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
        message: t("guide.directions_no_location", {
          defaultValue: "We need your location for driving directions. Allow location and try again.",
        }),
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
  }, [directionsRequestToken, selId, goalLat, goalLng, userLat, userLng, t]);

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
        const markers = placesCount > 0 ? guidePlacesToMarkers(res.places, t) : [];

        if (placesCount === 0) {
          guideDebug("page.runGuideAsk.placesEmpty", {
            source: res.source,
            message: "places_empty",
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
              content: buildPlacesAssistantSummary(res.places, t),
              at: Date.now(),
              assistantBodyFormat: "plain",
            });
          } else {
            const raw = (res.answer || "").trim();
            const maxLen = 360;
            const clipped =
              raw.length > maxLen ? `${raw.slice(0, maxLen).trim()}…` : raw;
            const hint = `\n\n*${t("guide.coords_hint", {
              defaultValue: "No mappable coordinates found. Try a clearer place name.",
            })}*`;
            base.push({
              id: newId(),
              role: "assistant",
              content:
                (clipped ||
                  t("guide.answer_empty", { defaultValue: "Could not get an answer." })) + hint,
              at: Date.now(),
              assistantBodyFormat: "markdown",
            });
          }
          return base;
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : t("guide.guide_error", { defaultValue: "Could not get a guide response." });
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
    [ask, busy, t],
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
        const markers = festivalItemsToMarkers(data.items || [], t);
        setMapMarkers(markers);
        setSelectedPlace(null);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content:
              markers.length > 0
                ? t("guide.festival_on_map", {
                    count: markers.length,
                    year: data.year,
                    month: data.month,
                    defaultValue: "Showing {{count}} events on the map ({{year}}/{{month}}).",
                  })
                : t("guide.festival_map_empty", {
                    defaultValue: "No events with coordinates, or the API returned nothing.",
                  }),
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
            content: t("guide.festival_load_error", {
              message: e instanceof Error ? e.message : String(e),
              defaultValue: "Could not load events: {{message}}",
            }),
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

    const prompt = t(`guide.prompt.${id}`, { defaultValue: "" }).trim();
    if (prompt) {
      await runGuideAsk(prompt);
    }
  }, [setError, runGuideAsk, t]);

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
      category: item.category?.trim() || t("guide.nearby_category_fallback", { defaultValue: "Restaurant · café" }),
      description: "",
      kind: "place",
      imageUrl: item.imageUrl?.trim() || undefined,
    };
    setMapMarkers((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, m]));
    setSelectedPlace(m);
    setMapCameraAnimation("smooth");
  }, [t]);

  const handleSend = useCallback(async () => {
    guideDebug("page.handleSend.invoked", { inputLen: input.trim().length });
    await runGuideAsk(input);
  }, [runGuideAsk, input]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout
      onLogout={logout}
      mobileTitle={t("guide.mobile_title", { defaultValue: "Discover" })}
    >
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50 md:h-full">
        <div className="relative z-0 flex min-h-0 flex-1 flex-col">
          {showGeminiNotice && (
            <div className="pointer-events-none absolute left-3 right-3 top-3 z-[8] rounded-md border border-gray-200 bg-white/90 px-4 py-3 text-center text-xs font-bold text-guide shadow-sm backdrop-blur-md md:left-1/2 md:right-auto md:w-[min(92vw,28rem)] md:-translate-x-1/2 md:text-sm md:font-bold">
              {t("guide.gemini_notice", {
                defaultValue: "AI suggests new places based on your preferences and context.",
              })}
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
                {t("guide.festival_loading_overlay", { defaultValue: "Loading events…" })}
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
