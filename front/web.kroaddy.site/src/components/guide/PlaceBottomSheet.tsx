"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import {
  Camera,
  Copy,
  ExternalLink,
  Lightbulb,
  Loader2,
  MapPin,
  Phone,
  Route,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { formatFestivalDate } from "@/lib/api/festival";
import { extractPlaceSectionFromAnswer } from "@/lib/guide/extractPlaceFromAnswer";
import { formatDurationMsToHoursMinutes, formatWon } from "@/lib/guide/formatRoute";
import { getPlacePlaceholderVisual } from "@/lib/guide/placeCategoryPlaceholder";
import {
  fetchGuideNearbyPlaces,
  fetchGuidePlaceDetails,
  type GuideNearbyCategory,
} from "@/lib/guide/guideClient";
import type {
  GuideDirectionsResponse,
  GuideNearbyPlaceItem,
  GuidePlaceDetailsResponse,
} from "@/lib/guide/types";
import type { MapMarker } from "./MapContainer";
import { BottomSheet } from "./BottomSheet";

const NAVER_INFO_NONE = "정보 없음";

function isInfoNone(v: string | null | undefined): boolean {
  const t = v?.trim() ?? "";
  return !t || t === NAVER_INFO_NONE;
}

function isHttpUrl(v: string | null | undefined): boolean {
  const s = v?.trim() ?? "";
  if (!s || s === NAVER_INFO_NONE) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface PlaceBottomSheetProps {
  marker: MapMarker | null;
  onClose: () => void;
  /** 직전 ask의 answer(PLACES_JSON 제거됨). description 보강·단락 발췌용 */
  guideAnswerFallback?: string | null;
  /** 네이버 Directions 5 — 자동차 경로 요약(요청 후에만 채워짐) */
  drivingRoute?: GuideDirectionsResponse | null;
  /** 자동차 경로 API 로딩 */
  directionsLoading?: boolean;
  /** 자동차 경로 보기 — 지도 경로선·이동 정보는 이 콜백 이후에만 */
  onRequestDrivingRoute?: () => void;
  /** 주변 맛집·카페 카드 선택 시 상세 컨텍스트 전환 */
  onSelectNearbyPlace?: (place: GuideNearbyPlaceItem) => void;
}

/** 장소명/행사명 줄 오른쪽 — 탭 시에만 경로 요청 */
function DrivingRouteToolbarButton({
  directionsLoading,
  onRequestDrivingRoute,
  className = "",
}: {
  directionsLoading: boolean;
  onRequestDrivingRoute?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onRequestDrivingRoute?.()}
      disabled={!onRequestDrivingRoute || directionsLoading}
      title="자동차 경로"
      aria-label="자동차 경로 보기"
      whileTap={{ scale: 0.97 }}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-sky-600 shadow-sm ring-1 ring-slate-100/80 transition hover:border-sky-200 hover:bg-sky-50/60 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {directionsLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        <Route className="h-5 w-5" strokeWidth={2} aria-hidden />
      )}
    </motion.button>
  );
}

/** 같은 카드 안 — 응답 수신 후(또는 로딩 중) 이동 요약 */
function DrivingRouteDetailsBody({
  drivingRoute,
  directionsLoading,
  onRequestDrivingRoute,
  driveTimeLabel,
  driveDistanceKm,
}: {
  drivingRoute: GuideDirectionsResponse | null;
  directionsLoading: boolean;
  onRequestDrivingRoute?: () => void;
  driveTimeLabel: string;
  driveDistanceKm: string;
}) {
  if (directionsLoading && drivingRoute == null) {
    return (
      <p className="text-sm font-medium text-slate-600" role="status">
        경로를 불러오는 중…
      </p>
    );
  }
  if (drivingRoute == null) return null;

  if (!drivingRoute.ok) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm font-medium leading-relaxed text-slate-600">
          {drivingRoute.message?.trim() ||
            "자동차 경로를 지원하지 않는 구간입니다. 다른 이동 수단을 이용해 보세요."}
        </p>
        {onRequestDrivingRoute ? (
          <div className="flex justify-end">
            <motion.button
              type="button"
              onClick={() => onRequestDrivingRoute()}
              title="다시 시도"
              aria-label="경로 다시 시도"
              whileTap={{ scale: 0.97 }}
              className="text-sm font-bold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline"
            >
              다시 시도
            </motion.button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <dl className="space-y-3 text-sm" aria-label="자동차 경로 안내">
      {driveTimeLabel ? (
        <div className="rounded-md bg-slate-50 px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-xs font-bold text-slate-500">자동차 이동 시 소요 시간</dt>
          <dd className="mt-1 text-lg font-bold text-slate-900">{driveTimeLabel}</dd>
        </div>
      ) : null}
      {driveDistanceKm ? (
        <div className="flex items-baseline justify-between gap-3 rounded-md bg-slate-50 px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="font-bold text-slate-500">예상 거리</dt>
          <dd className="text-base font-bold text-slate-900 tabular-nums">{driveDistanceKm}km</dd>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">예상 유류비</dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.fuel_price)}</dd>
        </div>
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">통행료</dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.toll_fare)}</dd>
        </div>
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:col-span-1 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">택시 요금(추정)</dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.taxi_fare ?? 0)}</dd>
        </div>
      </div>
      {!driveTimeLabel && !driveDistanceKm ? (
        <p className="text-sm font-medium text-slate-500">이 구간의 상세 시간·거리 정보를 가져오지 못했어요.</p>
      ) : null}
    </dl>
  );
}

async function sharePlaceCard(title: string, body: string): Promise<void> {
  const text = [title, body].filter(Boolean).join("\n\n").slice(0, 2000);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      /* 사용자 취소 등 */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  }
}

/**
 * 장소/행사 상세 — 마커 클릭 시 AI 가이드 + 자동차 경로 요약
 */
export function PlaceBottomSheet({
  marker,
  onClose,
  guideAnswerFallback = null,
  drivingRoute = null,
  directionsLoading = false,
  onRequestDrivingRoute,
  onSelectNearbyPlace,
}: PlaceBottomSheetProps) {
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [naverDetails, setNaverDetails] = useState<GuidePlaceDetailsResponse | null>(null);
  const [naverLoading, setNaverLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [nearbyCategory, setNearbyCategory] = useState<GuideNearbyCategory>("all");
  const [nearbyItems, setNearbyItems] = useState<GuideNearbyPlaceItem[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  useEffect(() => {
    setDescExpanded(false);
    setNearbyCategory("all");
  }, [marker?.id]);

  const anchorNameForNearby = useMemo(() => {
    if (!marker || marker.kind === "festival") return "";
    const nt = naverDetails?.title?.trim();
    if (nt && !isInfoNone(nt)) return nt;
    return (marker.title || "").trim();
  }, [marker, naverDetails?.title]);

  const nearbySectionEligible = useMemo(() => {
    if (!marker || marker.kind === "festival") return false;
    if (!(anchorNameForNearby || "").trim()) return false;
    const lat = marker.lat;
    const lng = marker.lng;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (lat === 0 && lng === 0) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return false;
    }
    return true;
  }, [marker, anchorNameForNearby]);

  useEffect(() => {
    if (!marker || marker.kind === "festival") {
      setNearbyItems([]);
      setNearbyLoading(false);
      setNearbyError(null);
      return;
    }
    if (!anchorNameForNearby) {
      setNearbyItems([]);
      setNearbyLoading(false);
      setNearbyError(null);
      return;
    }
    const lat = marker.lat;
    const lng = marker.lng;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (lat === 0 && lng === 0) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      setNearbyItems([]);
      setNearbyLoading(false);
      setNearbyError(null);
      return;
    }
    const ac = new AbortController();
    setNearbyLoading(true);
    setNearbyItems([]);
    setNearbyError(null);
    void fetchGuideNearbyPlaces(
      { x: lng, y: lat, name: anchorNameForNearby, category: nearbyCategory },
      ac.signal,
    )
      .then((res) => {
        if (!ac.signal.aborted) setNearbyItems(Array.isArray(res.items) ? res.items : []);
      })
      .catch((e) => {
        if (!ac.signal.aborted) {
          setNearbyItems([]);
          setNearbyError(e instanceof Error ? e.message : "주변 장소를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setNearbyLoading(false);
      });
    return () => ac.abort();
  }, [marker?.id, marker?.kind, marker?.lat, marker?.lng, anchorNameForNearby, nearbyCategory]);

  useEffect(() => {
    if (!marker || marker.kind === "festival") {
      setNaverDetails(null);
      setNaverLoading(false);
      return;
    }
    const ac = new AbortController();
    setNaverDetails(null);
    setNaverLoading(true);
    void fetchGuidePlaceDetails(marker.title, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setNaverDetails(d);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setNaverDetails({
          title: marker.title,
          category: NAVER_INFO_NONE,
          address: NAVER_INFO_NONE,
          telephone: NAVER_INFO_NONE,
          link: NAVER_INFO_NONE,
          imageUrl: null,
          naverMatched: false,
        });
      })
      .finally(() => {
        if (!ac.signal.aborted) setNaverLoading(false);
      });
    return () => ac.abort();
  }, [marker?.id, marker?.kind, marker?.title]);

  const guideMarkdown = useMemo(() => {
    if (!marker) return "";
    const isFest = marker.kind === "festival";
    const desc = (marker.description || "").trim();
    if (isFest) return desc;

    const fb = (guideAnswerFallback || "").trim();
    const extracted = fb ? extractPlaceSectionFromAnswer(fb, marker.title).trim() : "";

    if (desc.length >= 100) return desc;
    if (desc && extracted && extracted.length > desc.length + 40) {
      return `${desc}\n\n---\n\n${extracted}`;
    }
    if (desc) return desc;
    return extracted;
  }, [marker, guideAnswerFallback]);

  const onShare = useCallback(async () => {
    if (!marker) return;
    const body = guideMarkdown || marker.description?.trim() || marker.address?.trim() || "";
    try {
      await sharePlaceCard(marker.title, body);
      setShareHint("공유했거나 클립보드에 복사했어요.");
      window.setTimeout(() => setShareHint(null), 2500);
    } catch {
      setShareHint("공유에 실패했습니다.");
      window.setTimeout(() => setShareHint(null), 2500);
    }
  }, [marker, guideMarkdown]);

  const primaryAddress = useMemo(() => {
    const n = naverDetails?.address?.trim();
    if (n && !isInfoNone(n)) return n;
    return marker?.address?.trim() ?? "";
  }, [naverDetails?.address, marker?.address]);

  const copyAddress = useCallback(async () => {
    const addr = primaryAddress;
    if (!addr || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(addr);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [primaryAddress]);

  const isFest = marker?.kind === "festival";
  const badge = isFest ? "행사" : marker?.category?.trim() || "추천 장소";
  const visual = getPlacePlaceholderVisual(marker?.category, marker?.kind);
  const festHeroImageUrl = isFest ? marker?.imageUrl?.trim() || "" : "";
  const hasGuide = Boolean(guideMarkdown);
  const recommendationPoints = marker?.recommendationPoints ?? [];
  const hasStructuredAI =
    !isFest &&
    (Boolean(marker?.summary?.trim()) ||
      recommendationPoints.length > 0 ||
      Boolean(marker?.tip?.trim()));
  const longDescMarkdown = useMemo(() => {
    if (!marker || marker.kind === "festival") return "";
    const d = (marker.description || "").trim();
    if (d) return d;
    return guideMarkdown.trim();
  }, [marker, guideMarkdown]);
  const longDescNeedsToggle = longDescMarkdown.trim().length > 200;
  const est = marker?.estimatedCost?.trim();
  const visit = marker?.visitDuration?.trim();
  const photo = marker?.photoSpot?.trim();

  const displayNaverTitle =
    !isFest && naverDetails?.title?.trim() ? naverDetails.title.trim() : marker?.title ?? "";

  const keywordTagsForUi = useMemo(() => {
    if (!marker) return { show: false as const, tags: [] as string[] };
    const raw = marker.keywords;
    const arr = Array.isArray(raw)
      ? raw
          .map((k) => String(k).trim().replace(/^#+/, "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (marker.kind === "festival") {
      if (arr.length === 0) return { show: false, tags: [] };
      return { show: true, tags: arr };
    }
    if (arr.length === 0) return { show: true, tags: ["추천장소"] };
    return { show: true, tags: arr };
  }, [marker]);

  const driveTimeLabel = useMemo(() => {
    if (!drivingRoute?.ok) return "";
    return formatDurationMsToHoursMinutes(drivingRoute.duration_ms);
  }, [drivingRoute]);

  const driveDistanceKm =
    drivingRoute?.ok && drivingRoute.distance_m > 0
      ? (drivingRoute.distance_m / 1000).toFixed(1)
      : "";

  const proseGuide =
    "prose prose-sm max-w-none text-gray-700 " +
    "prose-headings:mb-2 prose-headings:mt-3 prose-headings:font-bold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm " +
    "prose-p:my-2.5 prose-p:text-[15px] prose-p:font-medium prose-p:leading-[1.65] " +
    "prose-ul:my-2 prose-ol:my-2 prose-li:text-[15px] prose-li:font-medium prose-li:leading-relaxed " +
    "prose-strong:font-bold prose-strong:text-guide " +
    "prose-hr:my-4 prose-hr:border-gray-200";

  const addressLine = !isFest && naverDetails?.address != null ? naverDetails.address : "";
  const telephoneLine = !isFest && naverDetails?.telephone != null ? naverDetails.telephone : "";
  const linkLine = !isFest && naverDetails?.link != null ? naverDetails.link : "";
  const addressDisplay =
    !isFest && !isInfoNone(addressLine)
      ? addressLine
      : !isFest && marker?.address?.trim()
        ? marker.address.trim()
        : addressLine || NAVER_INFO_NONE;

  return (
    <BottomSheet
      open={marker != null}
      onClose={onClose}
      titleId="place-sheet-title"
      mobileMaxHeight="min(78vh,560px)"
    >
      {marker ? (
        <div className="flex flex-col pb-[max(env(safe-area-inset-bottom),1rem)] md:pb-8">
          <>
          {!isFest ? (
            <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-md bg-slate-200 md:mx-4 md:mt-3 md:rounded-md">
              {naverLoading || naverDetails == null ? (
                <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />
              ) : naverDetails.imageUrl?.trim() ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={naverDetails.imageUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
                  <Camera className="h-10 w-10 opacity-60" strokeWidth={1.5} aria-hidden />
                  <span className="text-xs font-semibold">이미지 준비 중</span>
                </div>
              )}
              <motion.button
                type="button"
                onClick={onClose}
                title="닫기"
                aria-label="닫기"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md bg-gray-900/40 text-white shadow-sm backdrop-blur-md transition hover:bg-gray-900/55"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </motion.button>
            </div>
          ) : festHeroImageUrl ? (
            <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-md bg-gray-100 md:mx-4 md:mt-3 md:h-56 md:rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={festHeroImageUrl} alt="" className="h-full w-full object-cover" />
              <motion.button
                type="button"
                onClick={onClose}
                title="닫기"
                aria-label="닫기"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md bg-gray-900/40 text-white shadow-sm backdrop-blur-md transition hover:bg-gray-900/55"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </motion.button>
            </div>
          ) : (
            <div
              className={`flex h-12 w-full shrink-0 items-center justify-between gap-2 rounded-b-md px-4 shadow-sm ${
                isFest
                  ? "border-b border-amber-400/35 bg-gradient-to-r from-orange-400 to-amber-300"
                  : "border-b border-gray-200 bg-guide/8"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xl drop-shadow" aria-hidden>
                  {visual.emoji}
                </span>
                <span
                  className={`truncate text-[11px] font-bold uppercase tracking-wider ${
                    isFest ? "text-white/95" : "text-guide"
                  }`}
                >
                  {visual.shortLabel}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <motion.button
                  type="button"
                  onClick={onClose}
                  title="닫기"
                  aria-label="닫기"
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 480, damping: 28 }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition ${
                    isFest ? "text-white hover:bg-white/15" : "text-gray-600 hover:bg-gray-200/80"
                  }`}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-5 px-4 pt-4 md:px-6 md:pt-6">
            {isFest ? (
              <div className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-600 shadow-sm">
                    {badge}
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-900">
                    Festival
                  </span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <h2
                    id="place-sheet-title"
                    className="min-w-0 flex-1 text-2xl font-bold leading-tight tracking-tight text-slate-900 md:text-[1.65rem]"
                  >
                    {marker.title}
                  </h2>
                  <DrivingRouteToolbarButton
                    directionsLoading={directionsLoading}
                    onRequestDrivingRoute={onRequestDrivingRoute}
                    className="shrink-0"
                  />
                </div>
                {keywordTagsForUi.show ? (
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="list"
                    aria-label="장소 키워드"
                  >
                    {keywordTagsForUi.tags.map((kw, i) => (
                      <span
                        key={`${kw}-${i}`}
                        role="listitem"
                        className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                ) : null}
                {directionsLoading || drivingRoute != null ? (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <DrivingRouteDetailsBody
                      drivingRoute={drivingRoute}
                      directionsLoading={directionsLoading}
                      onRequestDrivingRoute={onRequestDrivingRoute}
                      driveTimeLabel={driveTimeLabel}
                      driveDistanceKm={driveDistanceKm}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isFest ? (
              <section
                className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100"
                aria-label="장소 정보"
              >
                {naverLoading || naverDetails == null ? (
                  <p className="text-sm font-medium text-slate-500">정보를 불러오는 중…</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2
                          id="place-sheet-title"
                          className="text-2xl font-bold leading-tight tracking-tight text-slate-900 md:text-[1.65rem]"
                        >
                          {displayNaverTitle}
                        </h2>
                        {!isInfoNone(naverDetails.category) ? (
                          <span className="text-xs font-medium text-slate-500">
                            {naverDetails.category}
                          </span>
                        ) : null}
                      </div>
                      <DrivingRouteToolbarButton
                        directionsLoading={directionsLoading}
                        onRequestDrivingRoute={onRequestDrivingRoute}
                        className="shrink-0"
                      />
                    </div>

                    <ul className="mt-5 flex flex-col gap-4">
                      <li>
                        <motion.button
                          type="button"
                          onClick={() => void copyAddress()}
                          disabled={!primaryAddress}
                          whileTap={primaryAddress ? { scale: 0.99 } : undefined}
                          className="flex w-full items-start gap-3 rounded-md text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MapPin
                            className="mt-0.5 h-5 w-5 shrink-0 text-sky-600"
                            aria-hidden
                            strokeWidth={2}
                          />
                          <span className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-slate-800">
                            {addressDisplay}
                          </span>
                          {primaryAddress ? (
                            <span className="shrink-0 text-[11px] font-bold text-sky-600">
                              {addressCopied ? "복사됨" : "탭하여 복사"}
                            </span>
                          ) : null}
                        </motion.button>
                      </li>
                      <li>
                        {!isInfoNone(telephoneLine) ? (
                          <a
                            href={`tel:${telephoneLine.replace(/\s/g, "")}`}
                            className="flex items-center gap-3 text-sm font-bold text-sky-700 transition hover:text-sky-800"
                          >
                            <Phone className="h-5 w-5 shrink-0 text-sky-600" aria-hidden strokeWidth={2} />
                            {telephoneLine}
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                            <Phone className="h-5 w-5 shrink-0 text-slate-400" aria-hidden strokeWidth={2} />
                            {NAVER_INFO_NONE}
                          </div>
                        )}
                      </li>
                      <li>
                        {isHttpUrl(linkLine) ? (
                          <a
                            href={linkLine}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline"
                          >
                            <ExternalLink className="h-5 w-5 shrink-0 text-sky-600" aria-hidden strokeWidth={2} />
                            홈페이지 방문
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                            <ExternalLink className="h-5 w-5 shrink-0 text-slate-400" aria-hidden strokeWidth={2} />
                            {NAVER_INFO_NONE}
                          </div>
                        )}
                      </li>
                    </ul>

                    {!naverDetails.naverMatched ? (
                      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-100">
                        지역 검색 결과가 없어 일부만 표시할 수 있어요. AI 추천과 지도 정보를 함께 참고해 주세요.
                      </p>
                    ) : null}

                    {directionsLoading || drivingRoute != null ? (
                      <div className="mt-5 border-t border-slate-100 pt-5">
                        <DrivingRouteDetailsBody
                          drivingRoute={drivingRoute}
                          directionsLoading={directionsLoading}
                          onRequestDrivingRoute={onRequestDrivingRoute}
                          driveTimeLabel={driveTimeLabel}
                          driveDistanceKm={driveDistanceKm}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            {!isFest && keywordTagsForUi.show ? (
              <div className="flex flex-wrap gap-2" role="list" aria-label="장소 키워드">
                {keywordTagsForUi.tags.map((kw, i) => (
                  <span
                    key={`${kw}-${i}`}
                    role="listitem"
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            ) : null}

            {!isFest ? (
              <>
                {hasStructuredAI ? (
                  <section className="rounded-md bg-sky-50/40 p-4 shadow-sm ring-1 ring-sky-100/80">
                    <div className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
                        <Sparkles className="h-4 w-4 text-sky-600" aria-hidden strokeWidth={2} />
                        Kroaddy의 추천 사유
                      </p>
                      {marker.summary?.trim() ? (
                        <p className="mt-3 text-lg font-bold leading-snug tracking-tight text-slate-900">
                          {marker.summary.trim()}
                        </p>
                      ) : null}
                      {recommendationPoints.length > 0 ? (
                        <ul
                          className="mt-4 space-y-3 rounded-md bg-slate-50 p-4 shadow-sm ring-1 ring-slate-100/80"
                          aria-label="추천 포인트"
                        >
                          {recommendationPoints.map((pt, i) => (
                            <li key={`${pt.text}-${i}`} className="flex items-start gap-3 text-sm font-medium text-slate-800">
                              <span className="shrink-0 text-lg leading-none" aria-hidden>
                                {pt.icon?.trim() || "•"}
                              </span>
                              <span className="min-w-0 leading-relaxed">{pt.text}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {marker.tip?.trim() ? (
                        <div className="mt-4 flex gap-3 rounded-md border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm">
                          <Lightbulb
                            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <p className="text-sm font-semibold leading-relaxed text-amber-950">{marker.tip.trim()}</p>
                        </div>
                      ) : null}
                      {longDescMarkdown.trim() ? (
                        <div className="mt-4">
                          {longDescNeedsToggle ? (
                            <>
                              {descExpanded ? (
                                <div
                                  className={`${proseGuide} text-sm text-slate-600 prose-p:text-[14px] prose-p:leading-relaxed`}
                                >
                                  <ReactMarkdown>{longDescMarkdown}</ReactMarkdown>
                                </div>
                              ) : null}
                              <motion.button
                                type="button"
                                onClick={() => setDescExpanded((v) => !v)}
                                whileTap={{ scale: 0.98 }}
                                className="mt-2 w-full rounded-md bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-200/80"
                              >
                                {descExpanded ? "상세 설명 접기" : "상세 설명 더보기"}
                              </motion.button>
                            </>
                          ) : (
                            <div
                              className={`${proseGuide} text-sm text-slate-500 prose-p:text-[13px] prose-p:leading-relaxed`}
                            >
                              <ReactMarkdown>{longDescMarkdown}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : hasGuide ? (
                  <section className="rounded-md bg-sky-50/40 p-4 shadow-sm ring-1 ring-sky-100/80">
                    <div className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
                        <Sparkles className="h-4 w-4 text-sky-600" aria-hidden strokeWidth={2} />
                        Kroaddy의 AI 추천 사유
                      </p>
                      <div className={`${proseGuide} mt-4`}>
                        <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
                      </div>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm font-medium text-slate-500 shadow-sm">
                    이 장소에 대한 AI 설명이 아직 없어요. 질문을 다시 보내 보시거나 다른 마커를 선택해 보세요.
                  </p>
                )}

                {nearbySectionEligible ? (
                  <section
                    className="rounded-md border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100"
                    aria-label="주변 맛집과 카페"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        함께 가기 좋은 근처 장소
                      </p>
                      <div
                        className="flex gap-0.5 rounded-md bg-slate-100/90 p-1 shadow-inner ring-1 ring-slate-100/80"
                        role="group"
                        aria-label="주변 장소 유형"
                      >
                        {(
                          [
                            { id: "all" as const, label: "전체" },
                            { id: "restaurant" as const, label: "맛집" },
                            { id: "cafe" as const, label: "카페" },
                          ] as const
                        ).map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setNearbyCategory(id)}
                            className={`rounded px-2.5 py-1.5 text-[11px] font-bold transition ${
                              nearbyCategory === id
                                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {nearbyError ? (
                      <p className="rounded-md bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-100">
                        {nearbyError}
                      </p>
                    ) : null}
                    {!nearbyLoading && !nearbyError && nearbyItems.length === 0 ? (
                      <p className="text-center text-xs font-medium text-slate-500">
                        이 근처에서 맛집·카페 검색 결과가 없어요. 다른 필터를 눌러 보세요.
                      </p>
                    ) : null}
                    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin]">
                      {nearbyLoading && nearbyItems.length === 0 && !nearbyError
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={`sk-${i}`}
                              className="h-48 w-40 shrink-0 snap-start overflow-hidden rounded-md bg-slate-100 shadow-sm ring-1 ring-slate-200/80"
                              aria-hidden
                            >
                              <div className="h-32 w-full animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]" />
                              <div className="space-y-2 p-2.5">
                                <div className="h-3.5 w-[75%] animate-pulse rounded bg-slate-200" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/80" />
                              </div>
                            </div>
                          ))
                        : nearbyItems.map((item) => (
                            <motion.button
                              key={`${item.name}-${item.lat}-${item.lng}`}
                              type="button"
                              whileTap={onSelectNearbyPlace ? { scale: 0.97 } : undefined}
                              disabled={!onSelectNearbyPlace}
                              onClick={() => onSelectNearbyPlace?.(item)}
                              className={`h-48 w-40 shrink-0 snap-start overflow-hidden rounded-md bg-white text-left shadow-sm ring-1 ring-slate-200/80 transition ${
                                onSelectNearbyPlace
                                  ? "hover:ring-sky-200 hover:shadow-md"
                                  : "cursor-default opacity-90"
                              }`}
                            >
                              <div className="relative h-32 w-full bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex h-16 flex-col justify-center gap-0.5 px-2 py-1.5">
                                <p className="line-clamp-2 text-xs font-bold leading-snug text-slate-900">
                                  {item.name}
                                </p>
                                <p className="text-[10px] font-medium tabular-nums text-slate-500">
                                  약 {item.distanceM < 1000 ? `${Math.round(item.distanceM)}m` : `${(item.distanceM / 1000).toFixed(1)}km`}
                                </p>
                              </div>
                            </motion.button>
                          ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            <div className="flex flex-col gap-3">
              {est ? (
                <section className="rounded-md border border-gray-200 bg-gradient-to-br from-amber-50/90 to-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">예상 경비</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{est}</p>
                </section>
              ) : null}

              {visit ? (
                <section className="rounded-md border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">관람·체류</p>
                  <p className="mt-2 text-sm font-medium text-gray-800">{visit}</p>
                </section>
              ) : null}

              {photo ? (
                <section className="rounded-md border border-gray-200 bg-gradient-to-br from-sky-50/80 to-white px-4 py-3.5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-sky-900">포토스팟</p>
                  <p className="mt-2 text-sm font-medium text-gray-800">{photo}</p>
                </section>
              ) : null}
            </div>

            {isFest && marker.address?.trim() ? (
              <div className="flex items-start gap-4 rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden strokeWidth={2} />
                <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-slate-600">
                  {marker.address.trim()}
                </p>
                <motion.button
                  type="button"
                  onClick={() => void copyAddress()}
                  whileTap={{ scale: 0.95 }}
                  className="shrink-0 rounded-md bg-slate-50 p-2.5 text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-sky-50 hover:text-sky-700"
                  title="주소 복사"
                  aria-label="주소 복사"
                >
                  {addressCopied ? (
                    <span className="text-xs font-bold text-emerald-600">완료</span>
                  ) : (
                    <Copy className="h-[18px] w-[18px]" aria-hidden strokeWidth={2} />
                  )}
                </motion.button>
              </div>
            ) : null}

            {isFest &&
            Number.isFinite(marker.lat) &&
            Number.isFinite(marker.lng) &&
            !(marker.lat === 0 && marker.lng === 0) &&
            Math.abs(marker.lat) <= 90 &&
            Math.abs(marker.lng) <= 180 ? (
              <p
                className="rounded-md bg-slate-50 px-4 py-3 text-xs font-medium tabular-nums text-slate-600 ring-1 ring-slate-100"
                aria-label="행사 위치 좌표"
              >
                위도 <span className="font-semibold text-slate-800">{marker.lat.toFixed(5)}</span>
                {" · "}
                경도 <span className="font-semibold text-slate-800">{marker.lng.toFixed(5)}</span>
              </p>
            ) : null}

            {(marker.festival?.opar && !marker.address?.includes(marker.festival.opar)) ||
            marker.festival?.startDate ||
            marker.festival?.endDate ? (
              <section className="rounded-md border border-gray-200 bg-white px-4 py-4 shadow-sm">
                {marker.festival?.opar && !marker.address?.includes(marker.festival.opar) ? (
                  <p className="text-sm font-medium text-gray-700">
                    <span className="font-bold text-gray-900">개최</span> {marker.festival.opar}
                  </p>
                ) : null}
                {(marker.festival?.startDate || marker.festival?.endDate) && (
                  <p
                    className={`text-sm font-medium text-gray-700 ${
                      marker.festival?.opar && !marker.address?.includes(marker.festival.opar) ? "mt-2" : ""
                    }`}
                  >
                    <span className="font-bold text-gray-900">기간</span>{" "}
                    {formatFestivalDate(marker.festival?.startDate || "")} ~{" "}
                    {formatFestivalDate(marker.festival?.endDate || "")}
                  </p>
                )}
              </section>
            ) : null}

            {isFest ? (
              hasGuide ? (
                <section className="rounded-md bg-amber-50/50 p-4 shadow-sm ring-1 ring-amber-100/80">
                  <div className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">행사 안내</p>
                    <div className={`${proseGuide} mt-4`}>
                      <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
                    </div>
                  </div>
                </section>
              ) : (
                <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm font-medium text-slate-500 shadow-sm">
                  이 장소에 대한 설명을 불러오지 못했습니다. 질문을 다시 보내 보시거나 다른 마커를 선택해 보세요.
                </p>
              )
            ) : null}

            {marker.festival?.homepageUrl ? (
              <a
                href={marker.festival.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 underline-offset-4 hover:text-sky-700 hover:underline"
              >
                공식 홈페이지
              </a>
            ) : null}

            {shareHint ? (
              <p className="w-full text-center text-xs font-medium text-sky-700" role="status">
                {shareHint}
              </p>
            ) : null}

            <div className="w-full pb-1 pt-1">
              <motion.button
                type="button"
                onClick={onShare}
                title="공유하기"
                aria-label="공유하기"
                whileTap={{ scale: 0.98 }}
                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-bold text-sky-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-sky-50 hover:text-sky-700"
              >
                <Share2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                공유하기
              </motion.button>
            </div>
          </div>
          </>
        </div>
      ) : null}
    </BottomSheet>
  );
}
