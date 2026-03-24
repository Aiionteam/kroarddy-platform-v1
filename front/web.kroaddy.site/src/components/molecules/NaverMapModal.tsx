"use client";

import React, { useEffect, useRef, useState } from "react";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";

interface NaverMapModalProps {
  placeName: string;
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
    const script = document.createElement("script");
    script.id = "naver-maps-sdk";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}&submodules=geocoder`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Naver Maps SDK 로드 실패"));
    document.head.appendChild(script);
  });
}

export function NaverMapModal({ placeName, onClose }: NaverMapModalProps) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus]   = useState<"loading" | "ok" | "error">("loading");
  const [address, setAddress] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadNaverMapsScript();
        if (cancelled || !mapRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const naver = (window as any).naver;

        const mapInstance = new naver.maps.Map(mapRef.current, {
          center: new naver.maps.LatLng(37.5665, 126.978),
          zoom: 14,
          mapTypeId: naver.maps.MapTypeId.NORMAL,
        });

        naver.maps.Service.geocode(
          { query: placeName },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (geocodeStatus: string, response: any) => {
            if (cancelled) return;
            if (
              geocodeStatus !== naver.maps.Service.Status.OK ||
              !response.addresses?.length
            ) {
              setStatus("error");
              return;
            }
            const addr   = response.addresses[0];
            const latlng = new naver.maps.LatLng(parseFloat(addr.y), parseFloat(addr.x));
            mapInstance.setCenter(latlng);
            new naver.maps.Marker({ position: latlng, map: mapInstance, title: placeName });
            setAddress(addr.roadAddress || addr.jibunAddress || "");
            setStatus("ok");
          }
        );
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

        {/* 지도 */}
        <div className="relative bg-gray-100" style={{ height: 320 }}>
          <div ref={mapRef} className="h-full w-full" />
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
              <p className="text-xs text-gray-500">지도를 불러오는 중…</p>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50 p-6 text-center">
              <span className="text-3xl">🗺️</span>
              <p className="text-sm font-medium text-gray-600">위치를 찾을 수 없습니다</p>
              <p className="text-xs text-gray-400">정확한 장소명으로 다시 시도해 보세요</p>
            </div>
          )}
        </div>

        {/* 하단 */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
          <p className="flex-1 truncate text-xs text-gray-500">
            {status === "ok" ? (address || "주소 정보 없음") : placeName}
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
      </div>
    </div>
  );
}
