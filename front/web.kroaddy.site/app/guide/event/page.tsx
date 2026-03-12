"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import {
  fetchFestivals,
  formatFestivalDate,
  getCachedFestivals,
  getStaleCachedFestivals,
  prefetchFestivals,
  type FestivalItem,
  type FestivalsResponse,
} from "@/lib/api/festival";
import { EventCalendar } from "@/components/event/EventCalendar";

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}
function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

function toInt(s: string): number {
  if (!s || s.length < 8) return 0;
  return parseInt(s.replace(/\D/g, "").slice(0, 8), 10) || 0;
}

function getFestivalsForDay(
  year: number,
  month: number,
  day: number,
  items: FestivalItem[]
): FestivalItem[] {
  const d = year * 10000 + month * 100 + day;
  return items.filter((it) => {
    const s = toInt(it.fstvlStartDate);
    const e = toInt(it.fstvlEndDate) || s || 99991231;
    return s > 0 && d >= s && d <= e;
  });
}

export default function EventPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<FestivalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const goPrev = useCallback(() => {
    const [ny, nm] = prevMonth(year, month);
    setYear(ny);
    setMonth(nm);
    setSelectedDay(null);
  }, [year, month]);

  const goNext = useCallback(() => {
    const [ny, nm] = nextMonth(year, month);
    setYear(ny);
    setMonth(nm);
    setSelectedDay(null);
  }, [year, month]);

  const load = useCallback(async () => {
    // ① 신선 캐시 → 즉시 표시, 요청 없음
    const fresh = getCachedFestivals(year, month);
    if (fresh) {
      setData(fresh);
      setError(fresh.error && !fresh.noData ? fresh.error : null);
      setLoading(false);
      return;
    }

    // ② stale 캐시 → 즉시 표시 후 백그라운드 갱신 (로딩 스피너 없음)
    const stale = getStaleCachedFestivals(year, month);
    if (stale) {
      setData(stale);
      setLoading(false);
      // 백그라운드에서 조용히 갱신
      fetchFestivals(year, month)
        .then((res) => {
          setData(res);
          setError(res.error && !res.noData ? res.error : null);
        })
        .catch(() => { /* stale 데이터 유지, 에러 표시 안 함 */ });
      return;
    }

    // ③ 캐시 없음 → 로딩 스피너 표시 후 API 호출
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFestivals(year, month);
      setData(res);
      if (res.error && !res.noData) setError(res.error);
    } catch (e) {
      setData(null);
      const raw = e instanceof Error ? e.message : "";
      const isConnectionError =
        raw.includes("Server disconnected") ||
        raw.includes("Failed to fetch") ||
        raw.includes("NetworkError") ||
        raw.includes("서버에 연결할 수 없습니다");
      setError(
        isConnectionError
          ? "행사 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
          : (raw || "행사 목록을 불러오지 못했습니다.")
      );
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated, load]);

  // 인접 월 프리페치 — 현재 달 로드 완료와 무관하게 즉시 시작
  useEffect(() => {
    if (!isAuthenticated) return;
    const [py, pm] = prevMonth(year, month);
    const [ny, nm] = nextMonth(year, month);
    // 약간의 딜레이로 현재 달 요청이 먼저 나가도록 양보
    const t = setTimeout(() => {
      prefetchFestivals(py, pm);
      prefetchFestivals(ny, nm);
    }, 300);
    return () => clearTimeout(t);
  }, [isAuthenticated, year, month]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const allItems = data?.items ?? [];
  const dayItems = selectedDay
    ? getFestivalsForDay(year, month, selectedDay, allItems)
    : allItems;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">행사추천</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                전국문화축제표준데이터 기반 · 날짜를 클릭하면 그날의 행사를 볼 수 있어요
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-full border border-gray-300 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none"
                aria-label="이전 달"
              >
                ←
              </button>
              <span className="min-w-[6rem] text-center text-base font-semibold text-gray-800">
                {year}년 {month}월
              </span>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full border border-gray-300 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none"
                aria-label="다음 달"
              >
                →
              </button>
            </div>
          </div>
        </header>

        {/* 바디 */}
        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* 왼쪽: 캘린더 (데이터 없어도 뼈대 즉시 렌더) */}
          <div className="flex w-full flex-col overflow-auto p-4 md:w-[55%] lg:w-[50%]">
            <EventCalendar
              year={year}
              month={month}
              items={allItems}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            {!loading && allItems.length > 0 && (
              <p className="mt-2 text-right text-xs text-gray-400">
                ● 행사 있음 · 날짜 클릭 시 해당일 행사만 표시
              </p>
            )}
          </div>

          {/* 오른쪽: 행사 목록 */}
          <div className="flex flex-1 flex-col overflow-hidden border-l border-gray-200 bg-white">
            {/* 목록 헤더 */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
              <span className="text-sm font-medium text-gray-700">
                {selectedDay
                  ? `${year}년 ${month}월 ${selectedDay}일 행사`
                  : `${year}년 ${month}월 전체 행사`}
              </span>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {loading ? "…" : `${dayItems.length}건`}
              </span>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="ml-2 text-xs text-gray-400 underline hover:text-gray-600"
                >
                  전체 보기
                </button>
              )}
            </div>

            {/* 목록 스크롤 영역 */}
            <div className="flex-1 overflow-auto px-4 py-3">
              {error && (
                <p className="mb-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* 로딩 스켈레톤 */}
              {loading && (
                <ul className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li
                      key={i}
                      className="animate-pulse rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 rounded bg-gray-200" />
                          <div className="h-3 w-1/3 rounded bg-gray-100" />
                          <div className="h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && dayItems.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  {data?.noData
                    ? "해당 기간에 등록된 행사가 없습니다."
                    : selectedDay
                    ? "이 날 진행 중인 행사가 없습니다."
                    : "행사가 없습니다."}
                </p>
              )}
              {!loading && (
                <ul className="space-y-3">
                  {dayItems.map((item: FestivalItem, i: number) => (
                    <FestivalCard key={`${item.fstvlNm}-${i}`} item={item} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FestivalCard({ item }: { item: FestivalItem }) {
  const start = formatFestivalDate(item.fstvlStartDate);
  const end = formatFestivalDate(item.fstvlEndDate);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm">
          🎉
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-gray-900">
            {item.fstvlNm || "(제목 없음)"}
          </h3>
          {(start || end) && (
            <p className="mt-0.5 text-xs text-indigo-600">
              {start}
              {start && end && " ~ "}
              {end}
            </p>
          )}
          {item.opar && (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
              <span className="text-xs">📍</span>
              {item.opar}
            </p>
          )}
          {item.rdnmadr && (
            <p className="mt-0.5 truncate text-xs text-gray-400">
              {item.rdnmadr}
            </p>
          )}
          {item.fstvlCo && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
              {item.fstvlCo}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {item.homepageUrl && (
              <a
                href={item.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-500 hover:underline"
              >
                홈페이지 →
              </a>
            )}
            {item.phoneNumber && (
              <span className="text-xs text-gray-400">
                📞 {item.phoneNumber}
              </span>
            )}
            {item.mnnstNm && (
              <span className="text-xs text-gray-400">
                주관: {item.mnnstNm}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
