"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
import { getCurrentPositionOrNull } from "@/lib/guide/geolocation";
import type { GuideDirectionsBbox } from "@/lib/guide/types";
import { GuideKroaddySearchingMapOverlay } from "@/components/guide/GuideKroaddySearching";

const NAVER_CLIENT_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "8cy39wy7um";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address?: string;
  category?: string;
  /** AI 추천 사유·행사 설명 등 */
  description?: string;
  /** 구조화 요약(한 줄) */
  summary?: string;
  recommendationPoints?: Array<{ icon: string; text: string }>;
  tip?: string;
  /** 대표 이미지 (있으면 바텀 시트에 표시) */
  imageUrl?: string;
  kind?: "place" | "festival";
  festival?: {
    startDate?: string;
    endDate?: string;
    opar?: string;
    homepageUrl?: string;
  };
  /** AI/DB — 예상 경비·관람 시간·포토스팟 */
  photoSpot?: string | null;
  estimatedCost?: string;
  visitDuration?: string;
  /** AI 핵심 키워드(해시 없이) */
  keywords?: string[];
}

function loadNaverMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).naver?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("naver-maps-sdk-guide");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "naver-maps-sdk-guide";
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Naver Maps SDK load failed"));
    document.head.appendChild(s);
  });
}

function parseMarkerLatLng(mk: MapMarker): { lat: number; lng: number } | null {
  const lat = typeof mk.lat === "number" ? mk.lat : Number(mk.lat);
  const lng = typeof mk.lng === "number" ? mk.lng : Number(mk.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** 장소·축제용 — 네이버식 드롭 핀 (앵커는 좌표가 가리키는 끝점) */
function createGuidePinElement(
  kind: MapMarker["kind"],
  isSelected: boolean,
): { el: HTMLDivElement; anchor: { x: number; y: number } } {
  const w = isSelected ? 34 : 28;
  const h = Math.round(w * 1.22);
  const fill =
    kind === "festival"
      ? isSelected
        ? "#ea580c"
        : "#f97316"
      : isSelected
        ? "#6d28d9"
        : "#7c3aed";
  const strokeW = isSelected ? 2.2 : 1.6;

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = `width:${w}px;height:${h}px;display:block;`;

  wrap.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.28));" aria-hidden="true">
  <path d="M12 1.2C7.25 1.2 3.4 5.05 3.4 9.8c0 5.9 7.35 14.55 8.35 16.05.35.55 1.15.55 1.5 0 1-1.5 8.35-10.15 8.35-16.05 0-4.75-3.85-8.6-8.6-8.6z" fill="${fill}" stroke="#fff" stroke-width="${strokeW}" stroke-linejoin="round"/>
  <circle cx="12" cy="9.8" r="2.9" fill="#fff" fill-opacity="0.92"/>
</svg>`;

  return { el: wrap, anchor: { x: w / 2, y: h - 1 } };
}

export interface MapContainerProps {
  markers?: MapMarker[];
  className?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  /** 장소 마커 포커스 시 카메라 이동 방식 (gemini_search 등 부드러운 이동용) */
  cameraAnimation?: "instant" | "smooth";
  /** 클릭된 마커 — 크기·색 강조 + panTo(줌 16) */
  selectedMarkerId?: string | null;
  /** 내 위치→선택 장소 자동차 경로(네이버 Directions 폴리라인) */
  directionPolylinePath?: Array<{ lat: number; lng: number }> | null;
  /** Directions 5 summary.bbox — 출발·도착이 보이도록 카메라 맞춤 */
  directionBBox?: GuideDirectionsBbox | null;
  /** 가이드 응답·경로 계산 중 지도 중앙 로딩 (지도 SDK 준비된 뒤만) */
  showSearchingOverlay?: boolean;
}

/**
 * 전체 화면 네이버 지도 (z-index는 부모에서 조절 — 기본 레이어 1).
 * SDK 로딩 중에는 스켈레톤/스피너 표시.
 */
export function MapContainer({
  markers = [],
  className = "",
  onMarkerClick,
  cameraAnimation = "smooth",
  selectedMarkerId = null,
  directionPolylinePath = null,
  directionBBox = null,
  showSearchingOverlay = false,
}: MapContainerProps) {
  const { t } = useTranslation();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerObjsRef = useRef<unknown[]>([]);
  const markerListenerKeysRef = useRef<unknown[]>([]);
  const routePolylineRef = useRef<{ setMap: (v: unknown) => void } | null>(null);
  const infoWindowRef = useRef<{ close: () => void; open: (map: unknown, marker: unknown) => void; setContent: (html: string) => void } | null>(null);
  /** Geolocation 성공 시 좌표 — 행사 마커와 별도로 현위치 마커에 사용 */
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const userMarkerRef = useRef<{ setMap: (v: unknown) => void } | null>(null);
  const onMarkerClickRef = useRef<MapContainerProps["onMarkerClick"]>(undefined);
  onMarkerClickRef.current = onMarkerClick;
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const initMap = useCallback(async () => {
    if (!mapDivRef.current) return;
    try {
      const results = await Promise.all([
        loadNaverMapsScript(),
        getCurrentPositionOrNull(),
      ]);
      const userPos = results[1];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const naver = (window as any).naver;
      if (!naver?.maps) {
        setPhase("error");
        return;
      }
      const hasUser = userPos != null;
      userLocationRef.current = hasUser ? { lat: userPos.lat, lng: userPos.lng } : null;
      const center = hasUser
        ? new naver.maps.LatLng(userPos.lat, userPos.lng)
        : new naver.maps.LatLng(36.5, 127.9);
      const map = new naver.maps.Map(mapDivRef.current, {
        center,
        zoom: hasUser ? 15 : 7,
        mapTypeId: naver.maps.MapTypeId.NORMAL,
      });
      mapRef.current = map;
      infoWindowRef.current = new naver.maps.InfoWindow({
        borderWidth: 0,
        backgroundColor: "transparent",
        pixelOffset: new naver.maps.Point(0, -6),
      });
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void initMap();
  }, [initMap]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const naver = (window as any).naver;
      if (!naver?.maps) return;
      markerListenerKeysRef.current.forEach((key) => {
        try {
          naver.maps.Event.removeListener(key);
        } catch {
          /* ignore */
        }
      });
      markerListenerKeysRef.current = [];
      markerObjsRef.current.forEach((m) => {
        try {
          (m as { setMap: (v: unknown) => void }).setMap(null);
        } catch {
          /* ignore */
        }
      });
      markerObjsRef.current = [];
      try {
        userMarkerRef.current?.setMap(null);
      } catch {
        /* ignore */
      }
      try {
        infoWindowRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const naver = (window as any).naver;
    const map = mapRef.current as any;

    markerListenerKeysRef.current.forEach((key) => {
      try {
        naver.maps.Event.removeListener(key);
      } catch {
        /* ignore */
      }
    });
    markerListenerKeysRef.current = [];

    markerObjsRef.current.forEach((m) => {
      try {
        (m as { setMap: (v: unknown) => void }).setMap(null);
      } catch {
        /* ignore */
      }
    });
    markerObjsRef.current = [];

    try {
      routePolylineRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    routePolylineRef.current = null;

    try {
      userMarkerRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    userMarkerRef.current = null;

    try {
      infoWindowRef.current?.close();
    } catch {
      /* ignore */
    }

    const valid: MapMarker[] = [];
    for (const mk of markers) {
      const ll = parseMarkerLatLng(mk);
      if (!ll) continue;
      valid.push({ ...mk, lat: ll.lat, lng: ll.lng });
    }

    valid.forEach((mk) => {
      const pos = new naver.maps.LatLng(mk.lat, mk.lng);
      const isSelected = selectedMarkerId != null && mk.id === selectedMarkerId;
      const { el: pinEl, anchor } = createGuidePinElement(mk.kind, isSelected);
      const marker = new naver.maps.Marker({
        position: pos,
        map,
        title: mk.title,
        zIndex: isSelected ? 400 : mk.kind === "festival" ? 120 : 100,
        icon: {
          content: pinEl,
          anchor: new naver.maps.Point(anchor.x, anchor.y),
        },
      });
      markerObjsRef.current.push(marker);

      const iw = infoWindowRef.current;
      if (iw) {
        const nameHtml = `<div style="padding:6px 10px;font-size:12px;font-weight:600;color:#111827;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(mk.title)}</div>`;
        const overKey = naver.maps.Event.addListener(marker, "mouseover", () => {
          iw.setContent(nameHtml);
          iw.open(map, marker);
        });
        const outKey = naver.maps.Event.addListener(marker, "mouseout", () => {
          iw.close();
        });
        markerListenerKeysRef.current.push(overKey, outKey);
      }

      const clickCb = onMarkerClickRef.current;
      if (clickCb) {
        const clickKey = naver.maps.Event.addListener(marker, "click", () => {
          clickCb(mk);
        });
        markerListenerKeysRef.current.push(clickKey);
      }
    });

    const loc = userLocationRef.current;
    if (loc) {
      const dot = document.createElement("div");
      dot.setAttribute("aria-hidden", "true");
      dot.style.cssText =
        "width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);";
      const userMarker = new naver.maps.Marker({
        position: new naver.maps.LatLng(loc.lat, loc.lng),
        map,
        title: t("guide.map.my_location", { defaultValue: "My location" }),
        zIndex: 500,
        icon: {
          content: dot,
          anchor: new naver.maps.Point(14, 14),
        },
      });
      userMarkerRef.current = userMarker;
    }

    const smooth = cameraAnimation === "smooth";
    const selected = selectedMarkerId
      ? valid.find((m) => m.id === selectedMarkerId)
      : undefined;

    const routePts = directionPolylinePath?.filter(
      (p) => isFinite(p.lat) && isFinite(p.lng) && !(p.lat === 0 && p.lng === 0),
    );
    if (routePts && routePts.length >= 2) {
      const plPath = routePts.map((p) => new naver.maps.LatLng(p.lat, p.lng));
      const poly = new naver.maps.Polyline({
        map,
        path: plPath,
        strokeColor: "#007AFF",
        strokeWeight: 5,
        strokeOpacity: 0.92,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
      routePolylineRef.current = poly;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let b: any = null;
      const box = directionBBox;
      if (
        box &&
        box.length === 2 &&
        box.every((p) => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]))
      ) {
        const lngs = [box[0][0], box[1][0]];
        const lats = [box[0][1], box[1][1]];
        const sw = new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs));
        const ne = new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs));
        b = new naver.maps.LatLngBounds(sw, ne);
        if (loc) {
          b.extend(new naver.maps.LatLng(loc.lat, loc.lng));
        }
      }
      if (!b) {
        b = new naver.maps.LatLngBounds(plPath[0], plPath[0]);
        plPath.forEach((ll) => b!.extend(ll));
        if (loc) {
          b.extend(new naver.maps.LatLng(loc.lat, loc.lng));
        }
      }
      if (smooth && typeof map.fitBounds === "function") {
        try {
          map.fitBounds(b, { margin: 56, duration: 420 });
        } catch {
          try {
            map.fitBounds(b, 56);
          } catch {
            map.fitBounds(b);
          }
        }
      } else {
        try {
          map.fitBounds(b, 56);
        } catch {
          map.fitBounds(b);
        }
      }
      return;
    }

    if (selected && loc) {
      const b = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(selected.lat, selected.lng),
        new naver.maps.LatLng(loc.lat, loc.lng),
      );
      if (smooth && typeof map.fitBounds === "function") {
        try {
          map.fitBounds(b, { margin: 64, duration: 400 });
        } catch {
          try {
            map.fitBounds(b, 64);
          } catch {
            /* fall through */
          }
        }
      } else {
        try {
          map.fitBounds(b, 64);
        } catch {
          /* fall through */
        }
      }
    } else if (selected) {
      const c = new naver.maps.LatLng(selected.lat, selected.lng);
      const z = 16;
      if (smooth && typeof map.morph === "function") {
        try {
          map.morph(c, z, { duration: 520, easing: "easeOutCubic" });
        } catch {
          map.setCenter(c);
          map.setZoom(z);
        }
      } else if (smooth && typeof map.panTo === "function") {
        try {
          map.panTo(c, { duration: 480, easing: "easeOutCubic" });
          map.setZoom(z);
        } catch {
          map.setCenter(c);
          map.setZoom(z);
        }
      } else {
        map.setCenter(c);
        map.setZoom(z);
      }
    } else if (valid.length >= 1) {
      if (valid.length === 1) {
        const c = new naver.maps.LatLng(valid[0].lat, valid[0].lng);
        if (smooth && typeof map.morph === "function") {
          try {
            map.morph(c, 11, { duration: 480, easing: "easeOutCubic" });
          } catch {
            map.setCenter(c);
            map.setZoom(11);
          }
        } else if (smooth && typeof map.panTo === "function") {
          try {
            map.panTo(c, { duration: 450, easing: "easeOutCubic" });
            map.setZoom(11);
          } catch {
            map.setCenter(c);
            map.setZoom(11);
          }
        } else {
          map.setCenter(c);
          map.setZoom(11);
        }
      } else {
        const b = new naver.maps.LatLngBounds(
          new naver.maps.LatLng(
            Math.min(...valid.map((x) => x.lat)),
            Math.min(...valid.map((x) => x.lng))
          ),
          new naver.maps.LatLng(
            Math.max(...valid.map((x) => x.lat)),
            Math.max(...valid.map((x) => x.lng))
          )
        );
        if (smooth && typeof map.fitBounds === "function") {
          try {
            map.fitBounds(b, { margin: 48, duration: 450 });
          } catch {
            try {
              map.fitBounds(b, 48);
            } catch {
              map.fitBounds(b);
            }
          }
        } else {
          try {
            map.fitBounds(b, 48);
          } catch {
            map.fitBounds(b);
          }
        }
      }
    }
  }, [phase, markers, cameraAnimation, selectedMarkerId, directionPolylinePath, directionBBox, t]);

  return (
    <div className={`relative h-full w-full min-h-0 ${className}`}>
      <div
        ref={mapDivRef}
        className="absolute inset-0 z-[1] h-full w-full bg-gray-100"
        role="application"
        aria-label={t("guide.map.aria_map", { defaultValue: "Map" })}
      />

      {phase === "loading" && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-gray-50 to-gray-100">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
          <p className="text-sm font-medium text-gray-600">
            {t("guide.map.loading", { defaultValue: "Loading map…" })}
          </p>
          <div className="mt-4 h-32 w-[85%] max-w-md animate-pulse rounded-md bg-gray-200/80" />
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200/80" />
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-gray-100 p-6 text-center">
          <span className="text-3xl">🗺️</span>
          <p className="text-sm text-gray-600">
            {t("guide.map.load_error", { defaultValue: "Could not load the map." })}
          </p>
          <p className="text-xs text-gray-400">
            {t("guide.map.load_error_hint", {
              defaultValue: "Check your network and NEXT_PUBLIC_NAVER_MAP_CLIENT_ID.",
            })}
          </p>
        </div>
      )}

      {phase === "ready" && showSearchingOverlay ? <GuideKroaddySearchingMapOverlay /> : null}
    </div>
  );
}
