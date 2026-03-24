"use client";

import React, { useEffect, useRef, useState } from "react";

const PLANER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface GeocodeResult {
  x: string;
  y: string;
  address: string;
  road_address: string;
}

interface NaverMapModalProps {
  placeName: string;
  onClose: () => void;
}

export function NaverMapModal({ placeName, onClose }: NaverMapModalProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [geo, setGeo] = useState<GeocodeResult | null>(null);
  const [zoom, setZoom] = useState(15);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(
          `${PLANER_API}/api/v1/maps/geocode?query=${encodeURIComponent(placeName)}`
        );
        if (!res.ok) throw new Error("위치를 찾을 수 없습니다.");
        const data: GeocodeResult = await res.json();
        if (!cancelled) {
          setGeo(data);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [placeName]);

  // 오버레이 클릭으로 닫기
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // ESC 키로 닫기
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const mapSrc =
    geo &&
    `${PLANER_API}/api/v1/maps/static-map?lat=${geo.y}&lng=${geo.x}&w=480&h=320&zoom=${zoom}`;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">📍</span>
            <span className="truncate text-sm font-bold text-white">{placeName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            aria-label="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 지도 영역 */}
        <div className="relative bg-gray-100" style={{ height: 320 }}>
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
              <p className="text-xs text-gray-500">위치를 검색하는 중…</p>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl">🗺️</span>
              <p className="text-sm font-medium text-gray-600">위치를 찾을 수 없습니다</p>
              <p className="text-xs text-gray-400">정확한 장소명으로 다시 시도해 보세요</p>
            </div>
          )}
          {status === "ok" && mapSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mapSrc}
              alt={`${placeName} 지도`}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* 하단 정보 + 줌 컨트롤 */}
        {status === "ok" && geo && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500 truncate">
              {geo.road_address || geo.address || "주소 정보 없음"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">줌</span>
              <input
                type="range"
                min={10}
                max={20}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="w-6 text-right text-xs text-gray-500">{zoom}</span>

              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                네이버지도로 열기 ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
