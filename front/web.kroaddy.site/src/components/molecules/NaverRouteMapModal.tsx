"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.kroaddy.site";

interface NaverRouteMapModalProps {
  places: { name: string; title: string; lat?: number; lng?: number }[];
  planName: string;
  onClose: () => void;
}

type TransportMode = "car" | "walk" | "transit";

interface RouteCoord {
  lng: number;
  lat: number;
  idx: number;
  name: string;
}

interface RouteSummary {
  distance: number; // 미터
  duration: number; // 밀리초
}

const MODE_CONFIG: Record<
  TransportMode,
  { icon: string; color: string; stroke: string }
> = {
  car: {
    icon: "🚗",
    color: "bg-indigo-500",
    stroke: "#6366f1",
  },
  walk: {
    icon: "🚶",
    color: "bg-emerald-500",
    stroke: "#10b981",
  },
  transit: {
    icon: "🚌",
    color: "bg-sky-500",
    stroke: "#0ea5e9",
  },
};

const MARKER_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
];

function loadNaverMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).naver?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("naver-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "naver-maps-sdk";
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SDK load failed"));
    document.head.appendChild(s);
  });
}

async function searchPlace(
  name: string
): Promise<{ lng: number; lat: number } | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/maps/place-search?query=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const lng = parseFloat(data.x);
    const lat = parseFloat(data.y);
    return isFinite(lng) && isFinite(lat) ? { lng, lat } : null;
  } catch {
    return null;
  }
}

async function fetchCarRoute(
  coords: RouteCoord[]
): Promise<{ path: [number, number][]; summary: RouteSummary } | null> {
  if (coords.length < 2) return null;

  // 0,0 좌표(geocoding 실패) 및 한국 범위 외 좌표 사전 제거
  const KOREA_LAT = [33.0, 38.7] as const;
  const KOREA_LNG = [124.5, 132.0] as const;
  const validCoords = coords.filter(
    (c) =>
      c.lat !== 0 && c.lng !== 0 &&
      isFinite(c.lat) && isFinite(c.lng) &&
      c.lat >= KOREA_LAT[0] && c.lat <= KOREA_LAT[1] &&
      c.lng >= KOREA_LNG[0] && c.lng <= KOREA_LNG[1]
  );

  // 동일/근접 좌표 제거 — Naver Directions API는 출발·도착 동일 좌표를 허용하지 않음
  const deduped = deduplicateCoords(validCoords);
  if (deduped.length < 2) return null; // 유효 장소 부족: 경로 없음

  // Directions 5: start(1) + waypoints(최대 5) + goal(1) = 최대 7개
  const limited = deduped.slice(0, 7);
  const start = limited[0];
  const goal = limited[limited.length - 1];
  const waypoints = limited.slice(1, -1);
  try {
    const res = await fetch(`${API_BASE}/api/v1/maps/directions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { lng: start.lng, lat: start.lat },
        goal: { lng: goal.lng, lat: goal.lat },
        waypoints: waypoints.map((w) => ({ lng: w.lng, lat: w.lat })),
      }),
    });
    // 백엔드가 Naver API 실패 시 200 + {fallback: true} 반환 → null로 처리 (직선 fallback)
    if (!res.ok) return null;
    const data = await res.json();
    if (data.fallback || !data.path?.length) return null;
    return {
      path: data.path as [number, number][],
      summary: data.summary ?? { distance: 0, duration: 0 },
    };
  } catch {
    return null;
  }
}

/** Haversine 거리(m) */
function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 50m 이내 동일 좌표를 제거한 배열 반환 (Naver Directions API 제한 대응) */
const DUPLICATE_THRESHOLD_M = 50;

function deduplicateCoords(coords: RouteCoord[]): RouteCoord[] {
  if (coords.length <= 1) return coords;
  const result: RouteCoord[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const prev = result[result.length - 1];
    if (haversine(prev.lat, prev.lng, coords[i].lat, coords[i].lng) > DUPLICATE_THRESHOLD_M) {
      result.push(coords[i]);
    }
  }
  return result;
}

/** 각 좌표의 idx → 이전 좌표 중 동일 위치(50m 이내) 여부 판별 */
function buildDuplicateSet(coords: RouteCoord[]): Set<number> {
  const dup = new Set<number>();
  for (let i = 1; i < coords.length; i++) {
    for (let j = 0; j < i; j++) {
      if (haversine(coords[i].lat, coords[i].lng, coords[j].lat, coords[j].lng) <= DUPLICATE_THRESHOLD_M) {
        dup.add(coords[i].idx);
        break;
      }
    }
  }
  return dup;
}

function totalStraightDistance(coords: RouteCoord[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversine(
      coords[i].lat,
      coords[i].lng,
      coords[i + 1].lat,
      coords[i + 1].lng
    );
  }
  return total;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function formatDuration(ms: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return t("map.duration_min", { min, defaultValue: "약 {{min}}분" });
  return t("map.duration_hour_min", {
    hour: Math.floor(min / 60),
    min: min % 60,
    defaultValue: "약 {{hour}}시간 {{min}}분",
  });
}

function buildNaverTransitUrl(
  start: RouteCoord,
  goal: RouteCoord
): string {
  return `https://map.naver.com/v5/directions/${start.lng},${start.lat},${encodeURIComponent(
    start.name
  )}/${goal.lng},${goal.lat},${encodeURIComponent(goal.name)}/-/transit`;
}

function buildNaverSearchUrl(name: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(name)}`;
}

export function NaverRouteMapModal({
  places,
  planName,
  onClose,
}: NaverRouteMapModalProps) {
  const { t } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  const [mode, setMode] = useState<TransportMode>("car");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [phase, setPhase] = useState<"geocoding" | "routing">("geocoding");
  const [resolved, setResolved] = useState(0);
  const [coordsCache, setCoordsCache] = useState<RouteCoord[] | null>(null);
  const [failedNames, setFailedNames] = useState<Set<string>>(new Set());
  const [duplicateSet, setDuplicateSet] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<RouteSummary | null>(null);

  const validPlaces = places.filter((p) => p.name?.trim());
  const cfg = MODE_CONFIG[mode];
  const modeLabel = (m: TransportMode) =>
    t(`map.mode.${m}`, {
      defaultValue:
        m === "car"
          ? "차량"
          : m === "walk"
            ? "도보"
            : "대중교통",
    });

  const renderRoute = useCallback(
    async (coords: RouteCoord[]) => {
      if (!mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const naver = (window as any).naver;

      // 기존 맵 파괴 후 재생성
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
        if (mapRef.current) mapRef.current.innerHTML = "";
      }

      const map = new naver.maps.Map(mapRef.current, {
        center: new naver.maps.LatLng(37.5665, 126.978),
        zoom: 12,
        mapTypeId: naver.maps.MapTypeId.NORMAL,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
        zoomControl: false,
      });
      mapInstanceRef.current = map;

      const sortedCoords = [...coords].sort((a, b) => a.idx - b.idx);

      // ── 마커 ─────────────────────────────────────────────────
      const latLngs = sortedCoords.map(({ lng, lat, idx, name }) => {
        const latlng = new naver.maps.LatLng(lat, lng);
        const color = MARKER_COLORS[idx % MARKER_COLORS.length];
        new naver.maps.Marker({
          position: latlng,
          map,
          title: name,
          icon: {
            content: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${color};color:#fff;font-size:13px;font-weight:700;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);">${idx + 1}</div>`,
            anchor: { x: 15, y: 15 },
          },
        });
        return latlng;
      });

      // ── 경로 폴리라인 ────────────────────────────────────────
      if (mode === "car") {
        setPhase("routing");
        const result = await fetchCarRoute(sortedCoords);
        if (result && result.path.length > 1) {
          new naver.maps.Polyline({
            map,
            path: result.path.map(
              ([lng, lat]) => new naver.maps.LatLng(lat, lng)
            ),
            strokeColor: cfg.stroke,
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          setSummary(result.summary);
        } else {
          // Directions 실패 시 직선 fallback
          new naver.maps.Polyline({
            map,
            path: latLngs,
            strokeColor: cfg.stroke,
            strokeWeight: 3,
            strokeOpacity: 0.7,
            strokeStyle: "shortdash",
          });
          const dist = totalStraightDistance(sortedCoords);
          setSummary({ distance: dist * 1.3, duration: (dist * 1.3) / 400 * 60000 });
        }
      } else if (mode === "walk") {
        new naver.maps.Polyline({
          map,
          path: latLngs,
          strokeColor: cfg.stroke,
          strokeWeight: 4,
          strokeOpacity: 0.85,
          strokeStyle: "shortdash",
        });
        const dist = totalStraightDistance(sortedCoords);
        setSummary({ distance: dist * 1.2, duration: (dist * 1.2) / 80 * 60000 });
      } else {
        // transit: 마커만 찍고 구간별 링크는 목록에서 제공
        const dist = totalStraightDistance(sortedCoords);
        setSummary({ distance: dist, duration: 0 });
        new naver.maps.Polyline({
          map,
          path: latLngs,
          strokeColor: cfg.stroke,
          strokeWeight: 3,
          strokeOpacity: 0.5,
          strokeStyle: "shortdash",
        });
      }

      // ── 뷰포트 ───────────────────────────────────────────────
      if (sortedCoords.length === 1) {
        map.setCenter(latLngs[0]);
        map.setZoom(14);
      } else {
        const lats = sortedCoords.map((c) => c.lat);
        const lngs = sortedCoords.map((c) => c.lng);
        map.fitBounds(
          new naver.maps.LatLngBounds(
            new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs)),
            new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs))
          ),
          { top: 50, right: 30, bottom: 30, left: 30 }
        );
      }

      setStatus("ok");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  // 초기 좌표 확보 (1회)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      setPhase("geocoding");
      setSummary(null);
      setResolved(0);

      try {
        await loadNaverMapsScript();
        if (cancelled) return;

        const coords: RouteCoord[] = [];
        const failed = new Set<string>();

        for (let i = 0; i < validPlaces.length; i++) {
          if (cancelled) return;
          const p = validPlaces[i];
          if (
            p.lat !== undefined &&
            p.lng !== undefined &&
            isFinite(p.lat) &&
            isFinite(p.lng)
          ) {
            coords.push({ lng: p.lng, lat: p.lat, idx: i, name: p.name });
          } else {
            const c = await searchPlace(p.name);
            if (c) coords.push({ ...c, idx: i, name: p.name });
            else failed.add(p.name);
          }
          if (!cancelled) setResolved(i + 1);
        }

        if (cancelled) return;
        setFailedNames(failed);

        if (coords.length === 0) {
          setStatus("error");
          return;
        }

        // 동일 위치 탐지 (50m 이내)
        setDuplicateSet(buildDuplicateSet(coords));
        setCoordsCache(coords);
        await renderRoute(coords);
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모드 변경 시 재렌더
  useEffect(() => {
    if (!coordsCache) return;
    setStatus("loading");
    setPhase("routing");
    setSummary(null);
    renderRoute(coordsCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  function handleOverlay(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "92vh" }}
      >
        {/* ── 헤더 ──────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg">🗺️</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{planName}</p>
              <p className="text-[11px] text-white/70">
                {t("map.total_route_stops", { defaultValue: "전체 경로 · {{count}}개 경유지", count: validPlaces.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", { defaultValue: "닫기" })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── 교통수단 탭 ────────────────────────────────────── */}
        <div className="flex shrink-0 gap-1.5 border-b border-gray-100 bg-white px-4 py-2.5">
          {(Object.keys(MODE_CONFIG) as TransportMode[]).map((m) => {
            const c = MODE_CONFIG[m];
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                  active
                    ? `${c.color} text-white shadow-sm`
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <span>{c.icon}</span>
                <span>{modeLabel(m)}</span>
              </button>
            );
          })}
        </div>

        {/* ── 로딩 배너 ─────────────────────────────────────── */}
        {status === "loading" && (
          <div className="flex shrink-0 items-center gap-2 border-b border-indigo-50 bg-indigo-50 px-4 py-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-xs text-indigo-700">
              {phase === "geocoding"
                ? t("map.searching_locations", { defaultValue: "위치 검색 중… {{resolved}} / {{total}}", resolved, total: validPlaces.length })
                : mode === "car"
                ? t("map.routing_car", { defaultValue: "실제 도로 경로 계산 중…" })
                : t("map.drawing_route", { defaultValue: "경로 그리는 중…" })}
            </p>
          </div>
        )}

        {/* ── 요약 배너 ─────────────────────────────────────── */}
        {status === "ok" && summary && mode !== "transit" && (
          <div
            className={`flex shrink-0 items-center justify-center gap-4 px-4 py-2 text-xs font-medium text-white ${cfg.color}`}
          >
            <span>📏 {formatDistance(summary.distance)}</span>
            {summary.duration > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span>
                  ⏱ {formatDuration(summary.duration, t)}
                  {mode === "car" ? ` ${t("map.car_estimate", { defaultValue: "(차량 예상)" })}` : ` ${t("map.walk_estimate", { defaultValue: "(도보 예상)" })}`}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── 지도 ──────────────────────────────────────────── */}
        <div className="relative shrink-0 bg-gray-100" style={{ height: 340 }}>
          <div ref={mapRef} className="h-full w-full" />

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50">
              <span className="text-4xl">🗺️</span>
              <p className="text-sm text-gray-500">{t("map.route_failed", { defaultValue: "경로를 표시할 수 없습니다" })}</p>
            </div>
          )}

          {/* transit: 구간 안내는 하단 목록에서 제공 */}
        </div>

        {/* ── 경유지 목록 ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0 divide-y divide-gray-50 px-4 py-2">
            {validPlaces.map((p, idx) => {
              const color = MARKER_COLORS[idx % MARKER_COLORS.length];
              const isFailed = failedNames.has(p.name);
              const isDuplicate = duplicateSet.has(idx);

              // 네이버 지도 링크 생성
              const prevCoord = coordsCache?.find((c) => c.idx === idx - 1);
              const currCoord = coordsCache?.find((c) => c.idx === idx);
              const naverUrl =
                mode === "transit" && prevCoord && currCoord
                  ? buildNaverTransitUrl(prevCoord, currCoord)
                  : buildNaverSearchUrl(p.name);
              const naverLabel =
                mode === "transit" && prevCoord && currCoord
                  ? t("map.segment_route", { defaultValue: "{{from}}→{{to}} 경로", from: idx, to: idx + 1 })
                  : t("map.view_map", { defaultValue: "지도 보기" });
              const naverIcon = mode === "transit" ? "🚌" : "📍";

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 py-2.5 ${
                    isDuplicate ? "rounded-lg bg-amber-50 px-2 -mx-2" : ""
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: isDuplicate ? "#f59e0b" : color }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p
                        className={`text-xs font-semibold leading-tight ${
                          isFailed ? "text-gray-300 line-through" : "text-gray-800"
                        }`}
                      >
                        {p.title}
                      </p>
                      {isDuplicate && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {t("map.same_place", { defaultValue: "📌 동일 위치" })}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] ${
                        isFailed ? "text-gray-300" : isDuplicate ? "text-amber-500" : "text-gray-400"
                      }`}
                    >
                      📍 {p.name}
                    </p>
                  </div>
                  {/* 네이버 지도 링크 버튼 */}
                  {!isFailed && (
                    <a
                      href={naverUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                        mode === "transit" && prevCoord && currCoord
                          ? "bg-sky-50 text-sky-600 hover:bg-sky-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      title={t("map.open_in_naver_title", { defaultValue: "{{name}} 네이버 지도로 보기", name: p.name })}
                    >
                      <span>{naverIcon}</span>
                      <span>{naverLabel}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
