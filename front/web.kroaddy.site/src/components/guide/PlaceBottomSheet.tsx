"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
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
import { GUIDE_CATEGORY_LABEL_DEFAULTS } from "./CategoryChipBar";
import { BottomSheet } from "./BottomSheet";

/** 네이버 API·내부 폴백에서 쓰는 ‘정보 없음’ 리터럴 (비교용) */
const NAVER_INFO_SENTINEL = "정보 없음";

function isInfoNone(v: string | null | undefined): boolean {
  const s = v?.trim() ?? "";
  return !s || s === NAVER_INFO_SENTINEL;
}

function isHttpUrl(v: string | null | undefined): boolean {
  const s = v?.trim() ?? "";
  if (!s || s === NAVER_INFO_SENTINEL) return false;
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
  const { t } = useTranslation();
  return (
    <motion.button
      type="button"
      onClick={() => onRequestDrivingRoute?.()}
      disabled={!onRequestDrivingRoute || directionsLoading}
      title={t("guide.sheet.driving_route", { defaultValue: "Driving directions" })}
      aria-label={t("guide.sheet.driving_route_aria", { defaultValue: "Show driving directions" })}
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
  const { t, i18n } = useTranslation();
  const loc = i18n.language?.replace("_", "-");
  if (directionsLoading && drivingRoute == null) {
    return (
      <p className="text-sm font-medium text-slate-600" role="status">
        {t("guide.sheet.route_loading", { defaultValue: "Loading route…" })}
      </p>
    );
  }
  if (drivingRoute == null) return null;

  if (!drivingRoute.ok) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm font-medium leading-relaxed text-slate-600">
          {drivingRoute.message?.trim() ||
            t("guide.sheet.route_unavailable", {
              defaultValue: "Driving directions are not available for this segment. Try another mode.",
            })}
        </p>
        {onRequestDrivingRoute ? (
          <div className="flex justify-end">
            <motion.button
              type="button"
              onClick={() => onRequestDrivingRoute()}
              title={t("guide.sheet.retry", { defaultValue: "Retry" })}
              aria-label={t("guide.sheet.retry_route", { defaultValue: "Retry route" })}
              whileTap={{ scale: 0.97 }}
              className="text-sm font-bold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline"
            >
              {t("guide.sheet.retry", { defaultValue: "Retry" })}
            </motion.button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <dl className="space-y-3 text-sm" aria-label={t("guide.sheet.route_summary_aria", { defaultValue: "Driving summary" })}>
      {driveTimeLabel ? (
        <div className="rounded-md bg-slate-50 px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-xs font-bold text-slate-500">
            {t("guide.sheet.drive_duration_label", { defaultValue: "Driving time" })}
          </dt>
          <dd className="mt-1 text-lg font-bold text-slate-900">{driveTimeLabel}</dd>
        </div>
      ) : null}
      {driveDistanceKm ? (
        <div className="flex items-baseline justify-between gap-3 rounded-md bg-slate-50 px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="font-bold text-slate-500">
            {t("guide.sheet.distance_label", { defaultValue: "Distance" })}
          </dt>
          <dd className="text-base font-bold text-slate-900 tabular-nums">
            {t("guide.sheet.km_suffix", { km: driveDistanceKm, defaultValue: "{{km}} km" })}
          </dd>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">
            {t("guide.sheet.fuel_label", { defaultValue: "Est. fuel" })}
          </dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.fuel_price, t, loc)}</dd>
        </div>
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">
            {t("guide.sheet.toll_label", { defaultValue: "Tolls" })}
          </dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.toll_fare, t, loc)}</dd>
        </div>
        <div className="rounded-md bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:col-span-1 sm:px-6 sm:py-5">
          <dt className="text-[11px] font-bold text-slate-500">
            {t("guide.sheet.taxi_label", { defaultValue: "Taxi (est.)" })}
          </dt>
          <dd className="mt-1 font-bold text-slate-900 tabular-nums">{formatWon(drivingRoute.taxi_fare ?? 0, t, loc)}</dd>
        </div>
      </div>
      {!driveTimeLabel && !driveDistanceKm ? (
        <p className="text-sm font-medium text-slate-500">
          {t("guide.sheet.route_detail_missing", {
            defaultValue: "Could not load detailed time and distance for this segment.",
          })}
        </p>
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
  const { t } = useTranslation();
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
          setNearbyError(
            e instanceof Error
              ? e.message
              : t("guide.sheet.nearby_load_fail", { defaultValue: "Could not load nearby places." }),
          );
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setNearbyLoading(false);
      });
    return () => ac.abort();
  }, [marker?.id, marker?.kind, marker?.lat, marker?.lng, anchorNameForNearby, nearbyCategory, t]);

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
          category: NAVER_INFO_SENTINEL,
          address: NAVER_INFO_SENTINEL,
          telephone: NAVER_INFO_SENTINEL,
          link: NAVER_INFO_SENTINEL,
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
      setShareHint(t("guide.sheet.share_ok", { defaultValue: "Shared or copied to clipboard." }));
      window.setTimeout(() => setShareHint(null), 2500);
    } catch {
      setShareHint(t("guide.sheet.share_fail", { defaultValue: "Share failed." }));
      window.setTimeout(() => setShareHint(null), 2500);
    }
  }, [marker, guideMarkdown, t]);

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
  const badge = isFest
    ? t("guide.badge_event", { defaultValue: "Event" })
    : marker?.category?.trim() || t("guide.badge_spot", { defaultValue: "Recommended place" });
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
    if (arr.length === 0) return { show: true, tags: [t("guide.keyword_default")] };
    return { show: true, tags: arr };
  }, [marker, t]);

  const driveTimeLabel = useMemo(() => {
    if (!drivingRoute?.ok) return "";
    return formatDurationMsToHoursMinutes(drivingRoute.duration_ms, t);
  }, [drivingRoute, t]);

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
        : addressLine || t("guide.info_none", { defaultValue: "No information" });

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
                  <span className="text-xs font-semibold">
                    {t("guide.sheet.image_prep", { defaultValue: "Image loading" })}
                  </span>
                </div>
              )}
              <motion.button
                type="button"
                onClick={onClose}
                title={t("common.close", { defaultValue: "Close" })}
                aria-label={t("common.close", { defaultValue: "Close" })}
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
                title={t("common.close", { defaultValue: "Close" })}
                aria-label={t("common.close", { defaultValue: "Close" })}
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
                  {t(`guide.placeholder.${visual.labelKey}`, {
                    defaultValue: visual.labelKey,
                  })}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <motion.button
                  type="button"
                  onClick={onClose}
                  title={t("common.close", { defaultValue: "Close" })}
                  aria-label={t("common.close", { defaultValue: "Close" })}
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
                    {t("guide.sheet.festival_label", { defaultValue: "Festival" })}
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
                    aria-label={t("guide.sheet.keywords_aria", { defaultValue: "Place keywords" })}
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
                aria-label={t("guide.sheet.place_info_aria", { defaultValue: "Place information" })}
              >
                {naverLoading || naverDetails == null ? (
                  <p className="text-sm font-medium text-slate-500">
                    {t("guide.sheet.info_loading", { defaultValue: "Loading information…" })}
                  </p>
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
                              {addressCopied
                                ? t("guide.sheet.address_copied", { defaultValue: "Copied" })
                                : t("guide.sheet.address_tap_copy", { defaultValue: "Tap to copy" })}
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
                            {t("guide.info_none", { defaultValue: "No information" })}
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
                            {t("guide.sheet.visit_homepage", { defaultValue: "Visit website" })}
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                            <ExternalLink className="h-5 w-5 shrink-0 text-slate-400" aria-hidden strokeWidth={2} />
                            {t("guide.info_none", { defaultValue: "No information" })}
                          </div>
                        )}
                      </li>
                    </ul>

                    {!naverDetails.naverMatched ? (
                      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-100">
                        {t("guide.sheet.naver_partial", {
                          defaultValue: "No local search match; showing partial info. Check AI tips and the map.",
                        })}
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
              <div
                className="flex flex-wrap gap-2"
                role="list"
                aria-label={t("guide.sheet.keywords_aria", { defaultValue: "Place keywords" })}
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

            {!isFest ? (
              <>
                {hasStructuredAI ? (
                  <section className="rounded-md bg-sky-50/40 p-4 shadow-sm ring-1 ring-sky-100/80">
                    <div className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
                        <Sparkles className="h-4 w-4 text-sky-600" aria-hidden strokeWidth={2} />
                        {t("guide.sheet.why_recommend", { defaultValue: "Why Kroaddy recommends this" })}
                      </p>
                      {marker.summary?.trim() ? (
                        <p className="mt-3 text-lg font-bold leading-snug tracking-tight text-slate-900">
                          {marker.summary.trim()}
                        </p>
                      ) : null}
                      {recommendationPoints.length > 0 ? (
                        <ul
                          className="mt-4 space-y-3 rounded-md bg-slate-50 p-4 shadow-sm ring-1 ring-slate-100/80"
                          aria-label={t("guide.sheet.points_aria", { defaultValue: "Highlights" })}
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
                                {descExpanded
                                  ? t("guide.sheet.desc_collapse", { defaultValue: "Show less" })
                                  : t("guide.sheet.desc_expand", { defaultValue: "Show more" })}
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
                        {t("guide.sheet.ai_why", { defaultValue: "AI recommendation" })}
                      </p>
                      <div className={`${proseGuide} mt-4`}>
                        <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
                      </div>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm font-medium text-slate-500 shadow-sm">
                    {t("guide.sheet.no_ai_desc", {
                      defaultValue: "No AI description yet. Ask again or pick another marker.",
                    })}
                  </p>
                )}

                {nearbySectionEligible ? (
                  <section
                    className="rounded-md border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100"
                    aria-label={t("guide.sheet.nearby_section_aria", { defaultValue: "Nearby restaurants and cafés" })}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        {t("guide.sheet.nearby_title", { defaultValue: "Nearby spots to visit together" })}
                      </p>
                      <div
                        className="flex gap-0.5 rounded-md bg-slate-100/90 p-1 shadow-inner ring-1 ring-slate-100/80"
                        role="group"
                        aria-label={t("guide.sheet.nearby_type_aria", { defaultValue: "Nearby place type" })}
                      >
                        {(
                          [
                            {
                              id: "all" as const,
                              label: t("guide.category.all", { defaultValue: GUIDE_CATEGORY_LABEL_DEFAULTS.all }),
                            },
                            {
                              id: "restaurant" as const,
                              label: t("guide.category.restaurant", {
                                defaultValue: GUIDE_CATEGORY_LABEL_DEFAULTS.restaurant,
                              }),
                            },
                            {
                              id: "cafe" as const,
                              label: t("guide.category.cafe", { defaultValue: GUIDE_CATEGORY_LABEL_DEFAULTS.cafe }),
                            },
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
                        {t("guide.sheet.nearby_empty", {
                          defaultValue: "No restaurants or cafés found nearby. Try another filter.",
                        })}
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
                                  {t("guide.sheet.distance_about", {
                                    dist:
                                      item.distanceM < 1000
                                        ? `${Math.round(item.distanceM)}m`
                                        : `${(item.distanceM / 1000).toFixed(1)}km`,
                                    defaultValue: "~{{dist}}",
                                  })}
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
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
                    {t("guide.sheet.est_cost", { defaultValue: "Estimated cost" })}
                  </p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{est}</p>
                </section>
              ) : null}

              {visit ? (
                <section className="rounded-md border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {t("guide.sheet.visit_duration", { defaultValue: "Visit / duration" })}
                  </p>
                  <p className="mt-2 text-sm font-medium text-gray-800">{visit}</p>
                </section>
              ) : null}

              {photo ? (
                <section className="rounded-md border border-gray-200 bg-gradient-to-br from-sky-50/80 to-white px-4 py-3.5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-sky-900">
                    {t("guide.sheet.photo_spot", { defaultValue: "Photo spot" })}
                  </p>
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
                  title={t("guide.sheet.copy_address", { defaultValue: "Copy address" })}
                  aria-label={t("guide.sheet.copy_address", { defaultValue: "Copy address" })}
                >
                  {addressCopied ? (
                    <span className="text-xs font-bold text-emerald-600">
                      {t("guide.sheet.done", { defaultValue: "Done" })}
                    </span>
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
                aria-label={t("guide.sheet.coords_aria", { defaultValue: "Event coordinates" })}
              >
                {t("guide.sheet.lat_label", { defaultValue: "Lat" })}{" "}
                <span className="font-semibold text-slate-800">{marker.lat.toFixed(5)}</span>
                {" · "}
                {t("guide.sheet.lng_label", { defaultValue: "Lng" })}{" "}
                <span className="font-semibold text-slate-800">{marker.lng.toFixed(5)}</span>
              </p>
            ) : null}

            {(marker.festival?.opar && !marker.address?.includes(marker.festival.opar)) ||
            marker.festival?.startDate ||
            marker.festival?.endDate ? (
              <section className="rounded-md border border-gray-200 bg-white px-4 py-4 shadow-sm">
                {marker.festival?.opar && !marker.address?.includes(marker.festival.opar) ? (
                  <p className="text-sm font-medium text-gray-700">
                    <span className="font-bold text-gray-900">
                      {t("guide.sheet.venue_label", { defaultValue: "Venue" })}
                    </span>{" "}
                    {marker.festival.opar}
                  </p>
                ) : null}
                {(marker.festival?.startDate || marker.festival?.endDate) && (
                  <p
                    className={`text-sm font-medium text-gray-700 ${
                      marker.festival?.opar && !marker.address?.includes(marker.festival.opar) ? "mt-2" : ""
                    }`}
                  >
                    <span className="font-bold text-gray-900">
                      {t("guide.sheet.period_label", { defaultValue: "Dates" })}
                    </span>{" "}
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">
                      {t("guide.sheet.event_info", { defaultValue: "Event details" })}
                    </p>
                    <div className={`${proseGuide} mt-4`}>
                      <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
                    </div>
                  </div>
                </section>
              ) : (
                <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm font-medium text-slate-500 shadow-sm">
                  {t("guide.sheet.event_desc_fail", {
                    defaultValue: "Could not load a description. Ask again or pick another marker.",
                  })}
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
                {t("guide.sheet.official_site", { defaultValue: "Official website" })}
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
                title={t("guide.sheet.share", { defaultValue: "Share" })}
                aria-label={t("guide.sheet.share", { defaultValue: "Share" })}
                whileTap={{ scale: 0.98 }}
                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-bold text-sky-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-sky-50 hover:text-sky-700"
              >
                <Share2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                {t("guide.sheet.share", { defaultValue: "Share" })}
              </motion.button>
            </div>
          </div>
          </>
        </div>
      ) : null}
    </BottomSheet>
  );
}
