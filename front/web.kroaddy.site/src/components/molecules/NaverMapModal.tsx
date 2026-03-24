"use client";

import React, { useEffect, useRef, useState } from "react";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.kroaddy.site";

interface NaverMapModalProps {
  placeName: string;
  onClose: () => void;
}

/** raster-cors 정적 지도 URL (HTTP Referer 인증 – 서비스 URL 등록 필요) */
function buildStaticMapUrl(lng: number, lat: number): string {
  const pos    = `${lng}%20${lat}`;
  const marker = `type:d|size:mid|pos:${pos}`;
  return (
    `https://maps.apigw.ntruss.com/map-static/v2/raster-cors` +
    `?w=400&h=320&center=${lng},${lat}&level=15` +
    `&markers=${marker}` +
    `&X-NCP-APIGW-API-KEY-ID=${NAVER_CLIENT_ID}`
  );
}

export function NaverMapModal({ placeName, onClose }: NaverMapModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus]             = useState<"loading" | "ok" | "error">("loading");
  const [staticMapUrl, setStaticMapUrl] = useState("");
  const [address, setAddress]           = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 백엔드 place-search (Naver 지역 검색 API – 장소명 지원)
        const res = await fetch(
          `${API_BASE}/api/v1/maps/place-search?query=${encodeURIComponent(placeName)}`
        );

        if (cancelled) return;

        if (!res.ok) { setStatus("error"); return; }

        const data = await res.json();
        const lng  = parseFloat(data.x);
        const lat  = parseFloat(data.y);

        setStaticMapUrl(buildStaticMapUrl(lng, lat));
        setAddress(data.address || "");
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  }, [placeName]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="truncate text-sm font-bold text-white">{placeName}</span>
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

        {/* 지도 영역 */}
        <div className="relative bg-gray-100" style={{ height: 320 }}>
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
              <p className="text-xs text-gray-500">지도를 불러오는 중…</p>
            </div>
          )}

          {status === "ok" && staticMapUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={staticMapUrl}
              alt={placeName}
              className="h-full w-full object-cover"
              onError={() => setStatus("error")}
            />
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
              <span className="text-3xl">🗺️</span>
              <p className="text-sm font-medium text-gray-600">정적 지도를 불러올 수 없습니다</p>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-600 transition-colors"
              >
                <span>🗺️</span> 네이버지도에서 보기
              </a>
              <p className="text-xs text-gray-400">새로 생성한 일정은 지도가 자동 표시됩니다</p>
            </div>
          )}
        </div>

        {/* 하단 – 에러 상태에선 숨김 (에러 overlay에 버튼이 있음) */}
        {status !== "error" && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
            <p className="flex-1 truncate text-xs text-gray-500">
              {address || placeName}
            </p>
            <a
              href={`https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              네이버지도로 열기 ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
