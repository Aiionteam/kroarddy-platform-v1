"use client";

import React, { useEffect, useRef, useState } from "react";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";

interface NaverRouteMapModalProps {
  places: { name: string; title: string }[];
  planName: string;
  onClose: () => void;
}

// window.naver는 src/types/naver-maps.d.ts 에서 any로 선언됨

function loadNaverMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).naver?.maps) { resolve(); return; }
    const existing = document.getElementById("naver-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id    = "naver-maps-sdk";
    s.src   = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}&submodules=geocoder`;
    s.async = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("SDK load failed"));
    document.head.appendChild(s);
  });
}

const MARKER_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#eab308","#22c55e","#14b8a6",
];

export function NaverRouteMapModal({ places, planName, onClose }: NaverRouteMapModalProps) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus]         = useState<"loading" | "ok" | "error">("loading");
  const [resolved, setResolved]     = useState(0);
  const [failedNames, setFailedNames] = useState<Set<string>>(new Set());

  const validPlaces = places.filter((p) => p.name?.trim());

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadNaverMapsScript();
        if (cancelled || !mapRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const naver = (window as any).naver;

        const map = new naver.maps.Map(mapRef.current, {
          center: new naver.maps.LatLng(37.5665, 126.978),
          zoom: 12,
          mapTypeId: naver.maps.MapTypeId.NORMAL,
        });

        const coords: { lat: number; lng: number; idx: number; name: string }[] = [];
        const failed = new Set<string>();

        for (let i = 0; i < validPlaces.length; i++) {
          if (cancelled) return;
          const placeName = validPlaces[i].name;

          await new Promise<void>((res) => {
            naver.maps.Service.geocode(
              { query: placeName },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (stat: string, resp: any) => {
                if (stat === naver.maps.Service.Status.OK && resp.addresses?.length) {
                  const a = resp.addresses[0];
                  coords.push({ lat: parseFloat(a.y), lng: parseFloat(a.x), idx: i, name: placeName });
                } else {
                  failed.add(placeName);
                }
                if (!cancelled) setResolved(i + 1);
                res();
              }
            );
          });
        }

        if (cancelled) return;
        setFailedNames(failed);

        if (coords.length === 0) { setStatus("error"); return; }

        const latLngs = coords.map(({ lat, lng, idx, name }) => {
          const latlng = new naver.maps.LatLng(lat, lng);
          const color  = MARKER_COLORS[idx % MARKER_COLORS.length];
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

        if (latLngs.length > 1) {
          new naver.maps.Polyline({
            map,
            path: latLngs,
            strokeColor: "#6366f1",
            strokeWeight: 3,
            strokeOpacity: 0.75,
            strokeStyle: "shortdash",
          });
        }

        if (coords.length === 1) {
          map.setCenter(latLngs[0]);
          map.setZoom(14);
        } else {
          const lats = coords.map((c) => c.lat);
          const lngs = coords.map((c) => c.lng);
          map.fitBounds(
            new naver.maps.LatLngBounds(
              new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs)),
              new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs))
            ),
            { top: 40, right: 30, bottom: 40, left: 30 }
          );
        }

        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
        style={{ maxHeight: "90vh" }}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg">🗺️</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{planName}</p>
              <p className="text-[11px] text-white/70">전체 경로 · {validPlaces.length}개 경유지</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 로딩 배너 */}
        {status === "loading" && (
          <div className="flex shrink-0 items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-xs text-indigo-700">위치 검색 중… {resolved} / {validPlaces.length}</p>
          </div>
        )}

        {/* 지도 */}
        <div className="relative shrink-0 bg-gray-100" style={{ height: 360 }}>
          <div ref={mapRef} className="h-full w-full" />
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50">
              <span className="text-4xl">🗺️</span>
              <p className="text-sm text-gray-500">경로를 표시할 수 없습니다</p>
            </div>
          )}
        </div>

        {/* 경유지 목록 */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 px-4 py-3">
            {validPlaces.map((p, idx) => {
              const color    = MARKER_COLORS[idx % MARKER_COLORS.length];
              const isFailed = failedNames.has(p.name);
              return (
                <div key={idx} className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${isFailed ? "text-gray-300 line-through" : "text-gray-800"}`}>
                      {p.title}
                    </p>
                    <p className={`text-[11px] ${isFailed ? "text-gray-300" : "text-gray-400"}`}>
                      📍 {p.name}
                    </p>
                  </div>
                  {idx < validPlaces.length - 1 && (
                    <svg className="shrink-0 text-gray-300" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
