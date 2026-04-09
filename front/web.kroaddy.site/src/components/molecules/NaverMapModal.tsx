"use client";

import React, { useEffect, useRef, useState } from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.kroaddy.site";

const ZOOM_MIN = 6;   // 전국 수준
const ZOOM_MAX = 19;  // 건물 수준
const ZOOM_DEFAULT = 15;

interface NaverMapModalProps {
  placeName: string;
  /** Gemini/Geocoding으로 확보한 좌표 – 있으면 API 호출 없이 즉시 정적 지도 표시 */
  lat?: number;
  lng?: number;
  onClose: () => void;
}

/** raster-cors 정적 지도 URL – scale=2(레티나)로 고화질 */
function buildStaticMapUrl(lng: number, lat: number, level: number): string {
  const pos    = `${lng}%20${lat}`;
  const marker = `type:d|size:mid|pos:${pos}`;
  return (
    `https://maps.apigw.ntruss.com/map-static/v2/raster-cors` +
    `?w=600&h=480&center=${lng},${lat}&level=${level}&scale=2` +
    `&markers=${marker}` +
    `&X-NCP-APIGW-API-KEY-ID=${NAVER_CLIENT_ID}`
  );
}

export function NaverMapModal({ placeName, lat, lng, onClose }: NaverMapModalProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus]       = useState<"loading" | "ok" | "error">("loading");
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress]     = useState("");
  const [zoom, setZoom]           = useState(ZOOM_DEFAULT);

  // 좌표 확보 (초기 1회)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // ── 저장된 좌표가 있으면 즉시 사용 ───────────────────────
      if (lat !== undefined && lng !== undefined && isFinite(lat) && isFinite(lng)) {
        setCoords({ lat, lng });
        setStatus("ok");
        return;
      }

      // ── 좌표 없으면 백엔드 place-search 호출 ─────────────────
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/maps/place-search?query=${encodeURIComponent(placeName)}`
        );
        if (cancelled) return;
        if (!res.ok) { setStatus("error"); return; }
        const data = await res.json();
        const resLng = parseFloat(data.x);
        const resLat = parseFloat(data.y);
        if (!isFinite(resLng) || !isFinite(resLat)) { setStatus("error"); return; }
        setCoords({ lat: resLat, lng: resLng });
        setAddress(data.address || "");
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  }, [placeName, lat, lng]);

  // ESC 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  const staticMapUrl =
    status === "ok" && coords
      ? buildStaticMapUrl(coords.lng, coords.lat, zoom)
      : "";

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
            aria-label={t("common.close", { defaultValue: "닫기" })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 지도 영역 */}
        <div className="relative bg-gray-100" style={{ height: 360 }}>
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
              <p className="text-xs text-gray-500">{t("map.loading", { defaultValue: "지도를 불러오는 중…" })}</p>
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
              <p className="text-sm font-medium text-gray-600">{t("map.static_failed", { defaultValue: "정적 지도를 불러올 수 없습니다" })}</p>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-600 transition-colors"
              >
                <span>🗺️</span> {t("map.open_in_naver", { defaultValue: "네이버지도에서 보기" })}
              </a>
              <p className="text-xs text-gray-400">{t("map.note_new_schedule", { defaultValue: "새로 생성한 일정은 지도가 자동 표시됩니다" })}</p>
            </div>
          )}

          {/* 확대/축소 버튼 – 지도 우측 하단 오버레이 */}
          {status === "ok" && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
                disabled={zoom >= ZOOM_MAX}
                aria-label={t("map.zoom_in", { defaultValue: "확대" })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-md hover:bg-white disabled:opacity-30 transition-colors text-lg font-bold leading-none"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 1))}
                disabled={zoom <= ZOOM_MIN}
                aria-label={t("map.zoom_out", { defaultValue: "축소" })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-md hover:bg-white disabled:opacity-30 transition-colors text-lg font-bold leading-none"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom(ZOOM_DEFAULT)}
                aria-label={t("map.zoom_reset", { defaultValue: "기본 배율" })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-md hover:bg-white transition-colors text-[10px] font-semibold"
              >
                ⊙
              </button>
            </div>
          )}
        </div>

        {/* 하단 – 에러 상태에선 숨김 */}
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
              {t("map.open_in_naver_with_arrow", { defaultValue: "네이버지도로 열기 ↗" })}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
