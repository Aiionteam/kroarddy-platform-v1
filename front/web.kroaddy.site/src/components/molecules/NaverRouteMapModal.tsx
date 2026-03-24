"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

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
  { label: string; icon: string; color: string; stroke: string }
> = {
  car: {
    label: "차량",
    icon: "🚗",
    color: "bg-indigo-500",
    stroke: "#6366f1",
  },
  walk: {
    label: "도보",
    icon: "🚶",
    color: "bg-emerald-500",
    stroke: "#10b981",
  },
  transit: {
    label: "대중교통",
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
  // Directions 5: start(1) + waypoints(최대 5) + goal(1) = 최대 7개
  const limited = coords.slice(0, 7);
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
    if (!res.ok) return null;
    const data = await res.json();
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

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `약 ${min}분`;
  return `약 ${Math.floor(min / 60)}시간 ${min % 60}분`;
}

function buildNaverTransitUrl(
  start: RouteCoord,
  goal: RouteCoord
): string {
  return `https://map.naver.com/v5/directions/${start.lng},${start.lat},${encodeURIComponent(
    start.name
  )}/${goal.lng},${goal.lat},${encodeURIComponent(goal.name)}/-/transit`;
}

export function NaverRouteMapModal({
  places,
  planName,
  onClose,
}: NaverRouteMapModalProps) {
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
  const [summary, setSummary] = useState<RouteSummary | null>(null);

  const validPlaces = places.filter((p) => p.name?.trim());
  const cfg = MODE_CONFIG[mode];

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
        // transit: 마커만 찍고 링크 제공
        const dist = totalStraightDistance(sortedCoords);
        setSummary({ distance: dist, duration: 0 });
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

  const transitStart = coordsCache?.[0];
  const transitGoal = coordsCache?.[coordsCache.length - 1];

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
                전체 경로 · {validPlaces.length}개 경유지
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
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
                <span>{c.label}</span>
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
                ? `위치 검색 중… ${resolved} / ${validPlaces.length}`
                : mode === "car"
                ? "실제 도로 경로 계산 중…"
                : "경로 그리는 중…"}
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
                  ⏱ {formatDuration(summary.duration)}
                  {mode === "car" ? " (차량 예상)" : " (도보 예상)"}
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
              <p className="text-sm text-gray-500">경로를 표시할 수 없습니다</p>
            </div>
          )}

          {/* 대중교통 오버레이 버튼 */}
          {status === "ok" && mode === "transit" && transitStart && transitGoal && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
              <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-xl">
                <p className="mb-1 text-sm font-bold text-gray-800">
                  대중교통 경로 안내
                </p>
                <p className="mb-4 text-xs text-gray-500">
                  네이버 지도에서 상세 경로를 확인하세요
                </p>
                <a
                  href={buildNaverTransitUrl(transitStart, transitGoal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-sky-600 transition-colors"
                >
                  <span>🚌</span> 네이버 지도로 보기
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ── 경유지 목록 ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0 divide-y divide-gray-50 px-4 py-2">
            {validPlaces.map((p, idx) => {
              const color = MARKER_COLORS[idx % MARKER_COLORS.length];
              const isFailed = failedNames.has(p.name);
              return (
                <div key={idx} className="flex items-center gap-3 py-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold leading-tight ${
                        isFailed
                          ? "text-gray-300 line-through"
                          : "text-gray-800"
                      }`}
                    >
                      {p.title}
                    </p>
                    <p
                      className={`text-[11px] ${
                        isFailed ? "text-gray-300" : "text-gray-400"
                      }`}
                    >
                      📍 {p.name}
                    </p>
                  </div>
                  {idx < validPlaces.length - 1 && (
                    <svg
                      className="shrink-0 text-gray-300"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
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
