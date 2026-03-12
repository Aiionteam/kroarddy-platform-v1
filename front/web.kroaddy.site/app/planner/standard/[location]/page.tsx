"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import {
  fetchRoutes,
  fetchSchedule,
  fetchMyPlans,
  savePlan,
  type PlanRoute,
  type ScheduleItem,
} from "@/lib/api/planner";
import {
  readRoutes,
  writeRoutes,
  invalidateRoutes,
  readSchedule,
  writeSchedule,
} from "@/lib/plannerCache";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { SLUG_TO_NAME } from "../../planner-data";

const THEME_META: Record<string, { emoji: string; bg: string; text: string }> = {
  행사:   { emoji: "🎪", bg: "bg-amber-100",   text: "text-amber-700"  },
  먹거리: { emoji: "🍱", bg: "bg-green-100",   text: "text-green-700"  },
  명소:   { emoji: "🏛️", bg: "bg-blue-100",    text: "text-blue-700"   },
  럭셔리: { emoji: "💎", bg: "bg-violet-100",  text: "text-violet-700" },
  가성비: { emoji: "🪙", bg: "bg-teal-100",    text: "text-teal-700"   },
  가족:   { emoji: "👨‍👩‍👧", bg: "bg-orange-100", text: "text-orange-700" },
  커플:   { emoji: "💑", bg: "bg-pink-100",    text: "text-pink-700"   },
};
const DEFAULT_THEME = { emoji: "✈️", bg: "bg-indigo-100", text: "text-indigo-700" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function LocationPlannerPage() {
  const router = useRouter();
  const { location } = useParams<{ location: string }>();
  const { isAuthenticated, logout, accessToken } = useLoginStore();

  const locationName = SLUG_TO_NAME[location] ?? location;
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => offsetDate(1));

  const routesFetchedRef = useRef<string | null>(null);

  const [routes, setRoutes] = useState<PlanRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [routesTriggered, setRoutesTriggered] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<PlanRoute | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const loadRoutes = useCallback(async () => {
    const dedupeKey = `${location}:${startDate}:${endDate}`;
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

      const cached = readRoutes<{ routes: PlanRoute[] }>(location, startDate, endDate, existingRoutes);
      if (cached) {
        console.info("[plannerCache] 루트 캐시 히트:", dedupeKey);
        setRoutes(cached.routes);
        setRoutesLoading(false);
        return;
      }

      const res = await fetchRoutes(location, {
        startDate,
        endDate,
        userId: appUserId ?? undefined,
        existingRoutes: existingRoutes.length > 0 ? existingRoutes : undefined,
      });
      setRoutes(res.routes);
      if (res.error && res.routes.length === 0) {
        setRoutesError(res.error);
      } else if (res.routes.length > 0) {
        writeRoutes(location, startDate, endDate, existingRoutes, { routes: res.routes });
        console.info("[plannerCache] 루트 캐시 저장:", dedupeKey);
      }
    } catch (e) {
      routesFetchedRef.current = null;
      setRoutesError(e instanceof Error ? e.message : "루트를 불러오지 못했습니다.");
    } finally {
      setRoutesLoading(false);
    }
  }, [location, startDate, endDate, appUserId]);

  useEffect(() => {
    routesFetchedRef.current = null;
    setRoutesTriggered(false);
    setRoutes([]);
    setSelectedRoute(null);
    setSchedule([]);
    setSavedPlanId(null);
  }, [location]);

  const generateSchedule = useCallback(
    async (route: PlanRoute) => {
      setSelectedRoute(route);
      setSchedule([]);
      setScheduleError(null);
      setSavedPlanId(null);
      setScheduleLoading(true);
      try {
        const cached = readSchedule<{ schedule: ScheduleItem[] }>(location, route.name, startDate, endDate);
        if (cached) {
          console.info("[plannerCache] 일정 캐시 히트:", route.name);
          setSchedule(cached.schedule);
          setScheduleLoading(false);
          return;
        }

        const res = await fetchSchedule(location, route.name, { startDate, endDate });
        setSchedule(res.schedule);
        if (res.error && res.schedule.length === 0) {
          setScheduleError(res.error);
        } else if (res.schedule.length > 0) {
          writeSchedule(location, route.name, startDate, endDate, { schedule: res.schedule });
          console.info("[plannerCache] 일정 캐시 저장:", route.name);
        }
      } catch (e) {
        setScheduleError(e instanceof Error ? e.message : "일정을 불러오지 못했습니다.");
      } finally {
        setScheduleLoading(false);
      }
    },
    [location, startDate, endDate]
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
      alert(e instanceof Error ? e.message : "저장에 실패했습니다.");
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col overflow-hidden">
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
                <p className="text-xs text-gray-400 font-medium">스탠다드</p>
                <h1 className="text-xl font-bold text-gray-800">{locationName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-400 shrink-0">날짜</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
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
              <button
                onClick={loadRoutes}
                disabled={routesLoading || !startDate || !endDate}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {routesLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    생성 중…
                  </>
                ) : (
                  <>✨ 루트 생성</>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-full flex-col overflow-auto border-r border-gray-200 bg-white p-5 md:w-[40%]">
            <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              AI 추천 루트
            </h2>

            {!routesTriggered && !routesLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <span className="text-4xl">📅</span>
                <p className="text-sm font-medium text-gray-600">날짜를 설정하고<br />루트를 생성해주세요</p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
                <button
                  onClick={loadRoutes}
                  disabled={routesLoading}
                  className="mt-1 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                >
                  ✨ 루트 생성 시작
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
                  const meta = THEME_META[route.theme] ?? DEFAULT_THEME;
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
                                {route.theme}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{route.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {route.highlights.map((h) => (
                                <span key={h} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                                  {h}
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

          <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
            {!selectedRoute && !scheduleLoading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
                <span className="mb-3 text-5xl">🗺️</span>
                {routesTriggered && routes.length > 0 ? (
                  <>
                    <p className="text-base font-medium">루트를 선택해 주세요</p>
                    <p className="mt-1 text-sm">{startDate} ~ {endDate} 일정을 AI가 만들어드려요</p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-medium">날짜 선택 후 루트를 생성하세요</p>
                    <p className="mt-1 text-sm">왼쪽 상단의 ✨ 루트 생성 버튼을 눌러주세요</p>
                  </>
                )}
              </div>
            )}

            {scheduleLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
                <p className="text-sm text-gray-500">
                  AI가 <b>{selectedRoute?.name}</b> 일정을 만드는 중…
                </p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
              </div>
            )}

            {scheduleError && (
              <div className="p-5">
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{scheduleError}</p>
              </div>
            )}

            {!scheduleLoading && schedule.length > 0 && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-800">{selectedRoute?.name} — 추천 일정</h2>
                    <p className="mt-0.5 text-xs text-gray-400">{startDate} ~ {endDate}</p>
                  </div>
                  {savedPlanId ? (
                    <button
                      onClick={() => router.push("/planner/schedule")}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
                    >
                      ✅ 저장됨 · 일정관리 보기
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
                          저장 중…
                        </>
                      ) : (
                        <>💾 저장하기</>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto px-5 py-4 space-y-6">
                  {Object.entries(dayGroups).map(([day, items]) => (
                    <div key={day}>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-600">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">
                          {day}
                        </span>
                        {items[0]?.date}
                      </h3>
                      <ol className="relative border-l-2 border-indigo-100 pl-5 space-y-4">
                        {items.map((item, idx) => (
                          <li key={idx} className="relative">
                            <span className="absolute -left-[1.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700">
                              {idx + 1}
                            </span>
                            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                              <div className="flex items-center gap-2">
                                {item.time && (
                                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                                    {item.time}
                                  </span>
                                )}
                                <span className="font-semibold text-gray-900">{item.title}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-indigo-500 font-medium">📍 {item.place}</p>
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
    </div>
  );
}
