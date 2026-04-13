"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import {
  fetchRoutes,
  streamSchedule,
  fetchMyPlans,
  savePlan,
  type PlanRoute,
  type ScheduleItem,
  type CostSummary,
} from "@/lib/api/planner";
import { useNewsStore } from "@/store/slices/newsSlice";
import {
  readRoutes,
  writeRoutes,
  invalidateRoutes,
  readSchedule,
  writeSchedule,
} from "@/lib/plannerCache";
import { SLUG_TO_NAME } from "../../planner-data";
import { useTranslation } from "react-i18next";

type ThemeSlug = "event" | "food" | "spot" | "luxury" | "value" | "family" | "couple";

const THEME_SLUG_BY_LABEL: Record<string, ThemeSlug> = {
  행사: "event",
  먹거리: "food",
  명소: "spot",
  럭셔리: "luxury",
  가성비: "value",
  가족: "family",
  커플: "couple",
};

const THEME_META: Record<ThemeSlug, { emoji: string; bg: string; text: string }> = {
  event: { emoji: "🎪", bg: "bg-amber-100", text: "text-amber-700" },
  food: { emoji: "🍱", bg: "bg-green-100", text: "text-green-700" },
  spot: { emoji: "🏛️", bg: "bg-blue-100", text: "text-blue-700" },
  luxury: { emoji: "💎", bg: "bg-violet-100", text: "text-violet-700" },
  value: { emoji: "🪙", bg: "bg-teal-100", text: "text-teal-700" },
  family: { emoji: "👨‍👩‍👧", bg: "bg-orange-100", text: "text-orange-700" },
  couple: { emoji: "💑", bg: "bg-pink-100", text: "text-pink-700" },
};
const DEFAULT_THEME = { emoji: "✈️", bg: "bg-indigo-100", text: "text-indigo-700" };

const DEST_NAME_FALLBACK_EN: Record<string, string> = {
  seoul: "Seoul",
  busan: "Busan",
  daegu: "Daegu",
  incheon: "Incheon",
  gwangju: "Gwangju",
  daejeon: "Daejeon",
  ulsan: "Ulsan",
  sejong: "Sejong",
  jongno: "Jongno / Gwanghwamun",
  myeongdong: "Myeongdong / Euljiro",
  yongsan: "Yongsan / Itaewon",
  gangnam: "Gangnam / Seocho",
  haeundae: "Haeundae",
  gwangalli: "Gwangalli / Suyeong",
  gijang: "Gijang",
  songjeong: "Songjeong / Cheongsapo",
};

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const HIGHLIGHT_SLUG_BY_LABEL: Record<string, string> = {
  // Seoul
  "경복궁": "gyeongbokgung",
  "홍대": "hongdae",
  "한강공원": "hangang_park",
  "청와대": "cheongwadae",
  "인사동": "insadong",
  "명동성당": "myeongdong_cathedral",
  "을지로골목": "euljiro_alley",
  "국립중앙박물관": "national_museum_of_korea",
  "이태원": "itaewon",
  // Busan
  "해운대": "haeundae",
  "해운대해수욕장": "haeundae_beach",
  "감천마을": "gamcheon_village",
  "자갈치시장": "jagalchi_market",
  "BIFF광장": "biff_square",
  // Daegu
  "동성로": "dongseongro",
  "김광석거리": "kim_gwangseok_street",
  "수성못": "suseong_lake",
  // Incheon
  "송도": "songdo",
  "차이나타운": "chinatown",
  // Gangwon
  "강릉": "gangneung",
  "경포대": "gyeongpo",
  "안목커피거리": "anmok_coffee_street",
  "오죽헌": "ojukheon",
  "속초": "sokcho",
  "설악산": "seoraksan",
  "중앙시장": "central_market",
  // Jeju
  "한라산": "hallasan",
  "성산일출봉": "seongsan_ilchulbong",
};

function toUiKeySlug(v: string) {
  const raw = String(v || "").trim();
  if (!raw) return "unknown";

  const mapped = HIGHLIGHT_SLUG_BY_LABEL[raw];
  if (mapped) return mapped;

  const ascii = raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (ascii) return ascii;

  // Fallback for non-ascii strings (e.g., Korean) — keep deterministic but short
  const enc = encodeURIComponent(raw).replace(/%/g, "").toLowerCase();
  return `k_${enc.slice(0, 16) || "unknown"}`;
}

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function LocationPlannerPage() {
  const router = useRouter();
  const { location } = useParams<{ location: string }>();
  const { isAuthenticated, logout } = useLoginStore();
  const newsTop10 = useNewsStore((s) => s.newsTop10);
  const { t, i18n } = useTranslation();
  const isKorean = (i18n.language || "").toLowerCase().startsWith("ko");

  const locationNameRaw = SLUG_TO_NAME[location] ?? location;
  const translatedLocationName = t(`planner.dest.${location}.name`, { defaultValue: locationNameRaw });
  const locationName =
    !isKorean && translatedLocationName === locationNameRaw
      ? (DEST_NAME_FALLBACK_EN[location] ?? humanizeSlug(location))
      : translatedLocationName;
  const appUserId = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const routesFetchedRef = useRef<string | null>(null);

  const [routes, setRoutes] = useState<PlanRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [routesTriggered, setRoutesTriggered] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<PlanRoute | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  /** SSE 진행 메시지(백엔드 status 이벤트) */
  const [scheduleStreamStatus, setScheduleStreamStatus] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** false: 카카오 POI + 네이버 블로그 팁(키 설정 시) — 빠름. true: Gemini Google Search — 느림 */
  const useSearch = false;
  const [transportMode, setTransportMode] = useState<"car" | "transit" | "walk">("car");

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const loadRoutes = useCallback(async () => {
    const dedupeKey = `${location}:${startDate}:${endDate}:${useSearch}:${transportMode}`;
    if (routesFetchedRef.current === dedupeKey) return;
    routesFetchedRef.current = dedupeKey;

    setRoutesTriggered(true);
    setRoutesLoading(true);
    setRoutesError(null);
    setRoutes([]);
    setSelectedRoute(null);
    setSchedule([]);
    setSavedPlanId(null);
    try {
      let existingRoutes: string[] = [];
      if (appUserId) {
        try {
          const saved = await fetchMyPlans(appUserId);
          existingRoutes = saved.map((p) => p.route_name);
        } catch {
          // 조회 실패 시 무시
        }
      }

      const cached = readRoutes<{ routes: PlanRoute[] }>(location, startDate, endDate, existingRoutes, useSearch);
      if (cached) {
        console.info("[plannerCache] route cache hit:", dedupeKey);
        setRoutes(cached.routes);
        setRoutesLoading(false);
        return;
      }

      const res = await fetchRoutes(location, {
        startDate,
        endDate,
        userId: appUserId ?? undefined,
        existingRoutes: existingRoutes.length > 0 ? existingRoutes : undefined,
        useSearch,
        newsTop10: newsTop10.length > 0 ? newsTop10 : undefined,
        transportMode,
      });
      setRoutes(res.routes);
      if (res.error && res.routes.length === 0) {
        setRoutesError(res.error);
      } else if (res.routes.length > 0) {
        writeRoutes(location, startDate, endDate, existingRoutes, useSearch, { routes: res.routes });
        console.info("[plannerCache] route cache saved:", dedupeKey);
      }
    } catch (e) {
      routesFetchedRef.current = null;
      setRoutesError(e instanceof Error ? e.message : t("planner.standard.route_load_fail", { defaultValue: "루트를 불러오지 못했습니다." }));
    } finally {
      setRoutesLoading(false);
    }
  }, [location, startDate, endDate, appUserId, useSearch, transportMode]);

  useEffect(() => {
    routesFetchedRef.current = null;
    setRoutesTriggered(false);
    setRoutes([]);
    setSelectedRoute(null);
    setSchedule([]);
    setCostSummary(null);
    setSavedPlanId(null);
  }, [location]);

  const generateSchedule = useCallback(
    async (route: PlanRoute) => {
      setSelectedRoute(route);
      setSchedule([]);
      setCostSummary(null);
      setScheduleError(null);
      setScheduleStreamStatus(null);
      setSavedPlanId(null);
      setScheduleLoading(true);
      try {
        const cached = readSchedule<{ schedule: ScheduleItem[]; cost_summary?: CostSummary }>(location, route.name, startDate, endDate, useSearch);
        if (cached) {
          console.info("[plannerCache] schedule cache hit:", route.name);
          setSchedule(cached.schedule);
          if (cached.cost_summary) setCostSummary(cached.cost_summary);
          setScheduleLoading(false);
          return;
        }

        let merged: ScheduleItem[] = [];
        let perDayCosts: { day: number; total: string; total_krw: number }[] = [];
        let streamErr: string | null = null;
        let lastCostSummary: CostSummary | null = null;

        for await (const ev of streamSchedule(location, route.name, {
          startDate,
          endDate,
          userId: appUserId ?? undefined,
          useSearch,
          newsTop10: newsTop10.length > 0 ? newsTop10 : undefined,
          transportMode,
        })) {
          if (ev.type === "status") {
            setScheduleStreamStatus(ev.message);
          } else if (ev.type === "day") {
            merged = [...merged, ...ev.items].sort((a, b) => (a.day ?? 1) - (b.day ?? 1));
            setSchedule(merged);
            const c = ev.cost;
            perDayCosts = [...perDayCosts.filter((p) => p.day !== c.day), c];
            perDayCosts.sort((a, b) => a.day - b.day);
            const sumKrw = perDayCosts.reduce((s, p) => s + (p.total_krw || 0), 0);
            const interim: CostSummary = {
              per_day: perDayCosts.map(({ day, total }) => ({ day, total })),
              trip_total: sumKrw ? `₩${sumKrw.toLocaleString("ko-KR")}` : "…",
            };
            setCostSummary(interim);
          } else if (ev.type === "geocoded") {
            merged = ev.items;
            setSchedule(ev.items);
          } else if (ev.type === "cost_summary") {
            lastCostSummary = ev.data;
            setCostSummary(ev.data);
          } else if (ev.type === "cached") {
            merged = ev.schedule;
            lastCostSummary = ev.cost_summary ?? null;
            setSchedule(ev.schedule);
            setCostSummary(ev.cost_summary ?? null);
          } else if (ev.type === "error") {
            streamErr = ev.message;
            setScheduleError(ev.message);
          }
        }

        if (streamErr) setScheduleError(streamErr);
        else setScheduleError(null);

        if (merged.length > 0 && !lastCostSummary && perDayCosts.length > 0) {
          const sumKrw = perDayCosts.reduce((s, p) => s + (p.total_krw || 0), 0);
          lastCostSummary = {
            per_day: perDayCosts.map(({ day, total }) => ({ day, total })),
            trip_total: sumKrw ? `₩${sumKrw.toLocaleString("ko-KR")}` : "N/A",
          };
        }

        if (merged.length > 0) {
          writeSchedule(location, route.name, startDate, endDate, useSearch, {
            schedule: merged,
            cost_summary: lastCostSummary ?? undefined,
          });
          console.info("[plannerCache] schedule cache saved:", route.name);
        }
      } catch (e) {
        setScheduleError(e instanceof Error ? e.message : t("planner.standard.schedule_load_fail", { defaultValue: "일정을 불러오지 못했습니다." }));
      } finally {
        setScheduleLoading(false);
        setScheduleStreamStatus(null);
      }
    },
    [location, startDate, endDate, appUserId, useSearch, transportMode, t, newsTop10]
  );

  const handleSavePlan = useCallback(async () => {
    if (!selectedRoute || schedule.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const res = await savePlan({
        location,
        routeName: selectedRoute.name,
        startDate,
        endDate,
        schedule,
        userId: appUserId ?? undefined,
      });
      setSavedPlanId(res.plan_id);
      invalidateRoutes(location);
      routesFetchedRef.current = null;
    } catch (e) {
      alert(e instanceof Error ? e.message : t("planner.standard.save_fail", { defaultValue: "저장에 실패했습니다." }));
    } finally {
      setIsSaving(false);
    }
  }, [selectedRoute, schedule, location, startDate, endDate, appUserId, isSaving]);

  if (!isAuthenticated) return null;

  const dayGroups = schedule.reduce<Record<number, ScheduleItem[]>>((acc, item) => {
    (acc[item.day] ??= []).push(item);
    return acc;
  }, {});

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col md:overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              >
                ←
              </button>
              <div>
                <p className="text-xs text-gray-400 font-medium">{t("planner.standard.mode_label", { defaultValue: "스탠다드" })}</p>
                <h1 className="text-xl font-bold text-gray-800">{locationName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-400 shrink-0">{t("planner.standard.date", { defaultValue: "날짜" })}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    // 종료일이 시작일보다 이전인 경우에만 시작일과 동일하게 조정 (당일치기 허용)
                    if (endDate < newStart) {
                      setEndDate(newStart);
                    }
                    routesFetchedRef.current = null;
                    setRoutes([]);
                    setRoutesTriggered(false);
                    setSelectedRoute(null);
                    setSchedule([]);
                    setSavedPlanId(null);
                  }}
                  className="bg-transparent text-sm text-gray-700 outline-none"
                />
                <span className="text-gray-300">~</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    routesFetchedRef.current = null;
                    setRoutes([]);
                    setRoutesTriggered(false);
                    setSelectedRoute(null);
                    setSchedule([]);
                    setSavedPlanId(null);
                  }}
                  className="bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>

              {/* 이동수단 선택 */}
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                {(
                  [
                    { value: "car",     label: t("planner.standard.mode_car", { defaultValue: "🚗 자가용" }) },
                    { value: "transit", label: t("planner.standard.mode_transit", { defaultValue: "🚇 대중교통" }) },
                    { value: "walk",    label: t("planner.standard.mode_walk", { defaultValue: "🚶 도보" }) },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTransportMode(value);
                      routesFetchedRef.current = null;
                      setRoutes([]);
                      setRoutesTriggered(false);
                      setSelectedRoute(null);
                      setSchedule([]);
                      setSavedPlanId(null);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      transportMode === value
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={loadRoutes}
                disabled={routesLoading || !startDate || !endDate}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {routesLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t("planner.standard.generating_loading", { defaultValue: "정확한 정보 검색 중…" })}
                  </>
                ) : (
                  <>{t("planner.standard.generate_route", { defaultValue: "✨ 루트 생성" })}</>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden">
          <div className="flex w-full flex-col border-b border-gray-200 bg-white p-5 md:w-[40%] md:overflow-auto md:border-b-0 md:border-r">
            <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t("planner.standard.ai_recommended_routes", { defaultValue: "AI 추천 루트" })}
            </h2>

            {!routesTriggered && !routesLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <span className="text-4xl">📅</span>
                <p className="text-sm font-medium text-gray-600">{t("planner.standard.set_date_and_generate", { defaultValue: "날짜를 설정하고\n루트를 생성해주세요" })}</p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
                <button
                  onClick={loadRoutes}
                  disabled={routesLoading}
                  className="mt-1 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                >
                  {t("planner.standard.start_generate", { defaultValue: "✨ 루트 생성 시작" })}
                </button>
              </div>
            )}

            {routesLoading && (
              <ul className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 rounded bg-gray-200" />
                        <div className="h-3 w-3/4 rounded bg-gray-100" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {routesError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{routesError}</p>
            )}

            {!routesLoading && routesTriggered && (
              <ul className="space-y-3">
                {routes.map((route) => {
                  const isActive = selectedRoute?.name === route.name;
                  const themeSlug = THEME_SLUG_BY_LABEL[route.theme] ?? toUiKeySlug(route.theme);
                  const meta =
                    (themeSlug in THEME_META
                      ? THEME_META[themeSlug as ThemeSlug]
                      : undefined) ?? DEFAULT_THEME;
                  return (
                    <li key={route.name}>
                      <button
                        onClick={() => generateSchedule(route)}
                        disabled={scheduleLoading}
                        className={`w-full rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
                          isActive
                            ? "border-indigo-400 bg-indigo-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-2xl">{meta.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{route.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}>
                                {t(`planner.standard.theme.${themeSlug}`, { defaultValue: route.theme })}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{route.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {route.highlights.map((h) => (
                                <span key={h} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                                  {t(`planner.standard.highlight.${toUiKeySlug(h)}`, { defaultValue: h })}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col bg-gray-50 md:flex-1 md:overflow-hidden">
            {!selectedRoute && !scheduleLoading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
                <span className="mb-3 text-5xl">🗺️</span>
                {routesTriggered && routes.length > 0 ? (
                  <>
                    <p className="text-base font-medium">{t("planner.standard.pick_route", { defaultValue: "루트를 선택해 주세요" })}</p>
                    <p className="mt-1 text-sm">{t("planner.standard.range_hint", { defaultValue: "{{start}} ~ {{end}} 일정을 AI가 만들어드려요", start: startDate, end: endDate })}</p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-medium">{t("planner.standard.select_date_then_generate", { defaultValue: "날짜 선택 후 루트를 생성하세요" })}</p>
                    <p className="mt-1 text-sm">{t("planner.standard.generate_hint", { defaultValue: "왼쪽 상단의 ✨ 루트 생성 버튼을 눌러주세요" })}</p>
                  </>
                )}
              </div>
            )}

            {scheduleLoading && schedule.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
                <p className="text-sm text-gray-500">
                  {t("planner.standard.making_schedule", { defaultValue: "AI가 <b>{{name}}</b> 일정을 만드는 중…", name: selectedRoute?.name ?? "", interpolation: { escapeValue: false } })}
                </p>
                {scheduleStreamStatus && (
                  <p className="max-w-sm text-center text-xs text-indigo-500">{scheduleStreamStatus}</p>
                )}
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
              </div>
            )}

            {scheduleError && (
              <div className="p-5">
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{scheduleError}</p>
              </div>
            )}

            {schedule.length > 0 && (
              <div className="flex flex-col md:flex-1 md:overflow-hidden">
                {scheduleLoading && (
                  <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-2">
                    <div className="flex items-center gap-2 text-xs text-amber-900">
                      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-400 border-t-amber-700" />
                      <span>
                        {scheduleStreamStatus ||
                          t("planner.standard.stream_finishing", { defaultValue: "좌표·경로 정리 중…" })}
                      </span>
                    </div>
                  </div>
                )}
                <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-gray-800">{t("planner.standard.recommended_schedule_title", { defaultValue: "{{name}} — 추천 일정", name: selectedRoute?.name ?? "" })}</h2>
                      <p className="mt-0.5 text-xs text-gray-400">{startDate} ~ {endDate}</p>
                    </div>
                    {savedPlanId ? (
                      <button
                        onClick={() => router.push("/planner/schedule")}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
                      >
                          {t("planner.standard.saved_goto_schedule", { defaultValue: "✅ 저장됨 · 일정관리 보기" })}
                      </button>
                    ) : (
                      <button
                        onClick={handleSavePlan}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                      >
                        {isSaving ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              {t("common.saving", { defaultValue: "저장 중…" })}
                          </>
                        ) : (
                            <>{t("planner.standard.save_plan", { defaultValue: "💾 저장하기" })}</>
                        )}
                      </button>
                    )}
                  </div>
                  {costSummary && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400">{t("planner.standard.total_cost", { defaultValue: "예상 총 경비" })}</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-sm font-bold text-emerald-600">
                        💰 {costSummary.trip_total}
                      </span>
                      {costSummary.per_day.map((d) => (
                        <span key={d.day} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            {t("planner.standard.cost_per_day", { defaultValue: "Day{{day}} {{total}}", day: d.day, total: d.total })}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="overflow-auto px-5 py-4 space-y-6 md:flex-1">
                  {Object.entries(dayGroups).map(([day, items]) => (
                    <div key={day}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-600">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">
                            {day}
                          </span>
                          {items[0]?.date}
                        </h3>
                        {costSummary?.per_day.find((d) => d.day === Number(day)) && (
                          <span className="text-xs font-medium text-emerald-600">
                            {t("planner.standard.subtotal", { total: costSummary.per_day.find((d) => d.day === Number(day))!.total, defaultValue: "소계 {{total}}" })}
                          </span>
                        )}
                      </div>
                      <ol className="relative border-l-2 border-indigo-100 pl-5 space-y-4">
                        {items.map((item, idx) => (
                          <li key={idx} className="relative">
                            <span className="absolute -left-[1.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700">
                              {idx + 1}
                            </span>
                            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.time && (
                                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                                      {item.time}
                                    </span>
                                  )}
                                  <span className="font-semibold text-gray-900 truncate">{item.title}</span>
                                </div>
                                {item.estimated_cost && (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                    {item.estimated_cost}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-indigo-500 font-medium">📍 {item.place}</p>
                              {item.business_hours && (
                                <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600 leading-relaxed">
                                  🕐 {item.business_hours}
                                </p>
                              )}
                              <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                              {item.tips && (
                                <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                  💡 {item.tips}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
