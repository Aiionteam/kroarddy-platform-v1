"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { useNewsStore } from "@/store/slices/newsSlice";
import { AppLayout } from "@/components/organisms/AppLayout";
import {
  generateKContent,
  saveKContent,
  type KContentResponse,
} from "@/service/k_content/k_content";
import { HeroBanner } from "@/components/k-content/HeroBanner";
import {
  fetchPackageImages,
  K_CONTENT_PLACEHOLDER_IMAGE,
  pickRandomImage,
} from "@/constants/k-content-images";
import { getAppUserIdFromToken } from "@/lib/api/auth";

type KScheduleItem = {
  day: number;
  date: string;
  time?: string;
  place: string;
  title: string;
  description: string;
  tips?: string;
  estimated_cost?: string;
  source?: "db" | "external";
};

type KCostSummary = {
  per_day: { day: number; total: string }[];
  trip_total: string;
};

type KPackageMeta = {
  package_id: string;
  category?: string;
  title_ko?: string;
  title_en?: string;
  tags?: string;
};

const CATALOG: Record<string, { title_ko: string; title_en: string; tags: string }> = {
  KPOP_01: { title_ko: "BTS: 영원한 화양연화", title_en: "BTS: The Eternal Youth", tags: "BTS, ARMY, Gangnam, HYBE" },
  KPOP_02: { title_ko: "블랙핑크: 힙&럭셔리", title_en: "BLACKPINK: Born Pink Luxury", tags: "BLACKPINK, YG, Luxury, Trend" },
  KPOP_03: { title_ko: "세븐틴&스키즈: 퍼포먼스 에너지", title_en: "SEVENTEEN & Stray Kids: Performance Energy", tags: "SEVENTEEN, Stray Kids, JYP, Performance" },
  KPOP_04: { title_ko: "뉴진스&아이브: 하이틴 서울", title_en: "NewJeans & IVE: Gen Z Trend", tags: "NewJeans, IVE, Y2K, Seongsu, Hannam" },
  KPOP_05: { title_ko: "SM: 광야 익스프레스", title_en: "SM: Kwangya Express", tags: "SM, aespa, NCT, Kwangya, Seongsu" },
  KPOP_06: { title_ko: "아이돌 직접 체험하기", title_en: "Experience: Become a Star", tags: "Experience, Dance, Recording, Idol-life" },
  KPOP_07: { title_ko: "홍대: 팬덤 문화의 중심", title_en: "Hongdae: Heart of Fandom", tags: "Hongdae, Busking, Album, Fans" },
  KPOP_08: { title_ko: "K-OST & 감성 힐링 서울", title_en: "K-OST & Healing: The Voice of Korea", tags: "IU, OST, Healing, Retro, Seoul" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\.\s?/g, "/").replace(/\/$/, "");
}

function countHangul(text: string) {
  return (text.match(/[가-힣]/g) ?? []).length;
}
function countLatin(text: string) {
  return (text.match(/[A-Za-z]/g) ?? []).length;
}
function looksKorean(text: string) {
  return countHangul(text) > countLatin(text);
}
function looksEnglish(text: string) {
  return countLatin(text) > countHangul(text);
}
function splitMixedSegments(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/\n+|\s+\|\s+|\s+\/\s+| · |\.\s+(?=[A-Z가-힣])/g)
    .map((s) => s.trim())
    .filter(Boolean);
}
function localizeTip(raw: string | undefined, lang: "ko" | "en"): string {
  const text = (raw ?? "").trim();
  if (!text) return "";

  const hasKo = countHangul(text) > 0;
  const hasEn = countLatin(text) > 0;
  if (!(hasKo && hasEn)) return text;

  const segments = splitMixedSegments(text);

  if (segments.length > 1) {
    const picked = [...segments].sort((a, b) => {
      const aScore = lang === "ko" ? countHangul(a) : countLatin(a);
      const bScore = lang === "ko" ? countHangul(b) : countLatin(b);
      return bScore - aScore;
    })[0];
    if (picked) return picked;
  }

  if (lang === "ko") {
    return text.replace(/\([^)]*[A-Za-z][^)]*\)/g, "").trim();
  }
  return text.replace(/\([^)]*[가-힣][^)]*\)/g, "").trim();
}
function normalizeDescription(raw: string | undefined, lang: "ko" | "en"): string {
  const text = (raw ?? "").trim();
  if (!text) return "";

  const cleaned = text
    .replace(/\(description_en\)/gi, "")
    .replace(/description_en\s*:\s*/gi, "")
    .replace(/must_do_en\s*:\s*/gi, "|")
    .replace(/\s+/g, " ")
    .trim();

  const segments = splitMixedSegments(cleaned);
  if (segments.length === 0) return cleaned;

  const byLang = segments.filter((s) => (lang === "ko" ? looksKorean(s) : looksEnglish(s)));
  if (byLang.length > 0) return byLang[0];
  return segments[0];
}
function getLocalizedDescription(opts: {
  description?: string;
  tips?: string;
  place: string;
  source?: "db" | "external";
  lang: "ko" | "en";
}) {
  const normalized = normalizeDescription(opts.description, opts.lang);

  // 한국어 사용자 + DB 항목인 경우 영어 설명을 노출하지 않고 한국어 문장으로 보정
  if (opts.lang === "ko" && opts.source === "db" && looksEnglish(normalized)) {
    const tipKo = localizeTip(opts.tips, "ko");
    if (tipKo && looksKorean(tipKo)) return tipKo;
    return `${opts.place}에서 즐길 수 있는 추천 스팟입니다.`;
  }
  return normalized;
}

function parseResponse(res: KContentResponse, startDate: string): {
  packageMeta: KPackageMeta | null;
  schedule: KScheduleItem[];
  costSummary: KCostSummary | null;
} {
  const metaRaw = (res.package_meta ?? {}) as Record<string, unknown>;
  const packageMeta: KPackageMeta = {
    package_id: typeof metaRaw.package_id === "string" ? metaRaw.package_id : "",
    category: typeof metaRaw.category === "string" ? metaRaw.category : undefined,
    title_ko: typeof metaRaw.title_ko === "string" ? metaRaw.title_ko : undefined,
    title_en: typeof metaRaw.title_en === "string" ? metaRaw.title_en : undefined,
    tags: typeof metaRaw.tags === "string" ? metaRaw.tags : undefined,
  };

  const placesRaw = Array.isArray(res.places) ? res.places : [];
  const sourceByName = new Map<string, "db" | "external">();
  for (const p of placesRaw) {
    const row = p as Record<string, unknown>;
    const src = row.source === "db" ? "db" : "external";
    const ko = typeof row.name_ko === "string" ? row.name_ko : "";
    const en = typeof row.name_en === "string" ? row.name_en : "";
    if (ko) sourceByName.set(ko, src);
    if (en) sourceByName.set(en, src);
  }

  const itemsRaw = Array.isArray(res.schedule) ? res.schedule : [];
  const schedule: KScheduleItem[] = itemsRaw.map((item, idx) => {
    const row = item as Record<string, unknown>;
    const day = typeof row.day === "number" ? row.day : Number(row.day) || 1;
    const d = new Date(startDate);
    d.setDate(d.getDate() + (day - 1));
    const date = d.toISOString().slice(0, 10);
    const place = typeof row.place === "string" ? row.place : "";
    return {
      day,
      date,
      time: typeof row.time === "string" ? row.time : undefined,
      place,
      title: typeof row.title === "string" ? row.title : `일정 ${idx + 1}`,
      description: typeof row.description === "string" ? row.description : "",
      tips: typeof row.tips === "string" ? row.tips : undefined,
      estimated_cost: typeof row.estimated_cost === "string" ? row.estimated_cost : undefined,
      source: sourceByName.get(place) ?? "external",
    };
  });

  const costRaw = (res.cost_summary ?? null) as Record<string, unknown> | null;
  const perDay = Array.isArray(costRaw?.per_day)
    ? (costRaw?.per_day as Array<Record<string, unknown>>).map((d) => ({
        day: typeof d.day === "number" ? d.day : Number(d.day) || 0,
        total: typeof d.total === "string" ? d.total : "",
      })).filter((d) => d.day > 0 && d.total)
    : [];
  const tripTotal = typeof costRaw?.trip_total === "string" ? costRaw.trip_total : "";
  const costSummary = perDay.length > 0 || tripTotal ? { per_day: perDay, trip_total: tripTotal } : null;

  return { packageMeta, schedule, costSummary };
}

export default function KContentPackagePage() {
  const router = useRouter();
  const { packageId } = useParams<{ packageId: string }>();
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const newsTop10 = useNewsStore((s) => s.newsTop10);
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => offsetDate(1));

  const [schedule, setSchedule] = useState<KScheduleItem[]>([]);
  const [costSummary, setCostSummary] = useState<KCostSummary | null>(null);
  const [packageMeta, setPackageMeta] = useState<KPackageMeta | null>(null);
  const [places, setPlaces] = useState<Record<string, unknown>[]>([]);

  const [triggered, setTriggered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const [heroImage, setHeroImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (window.localStorage.getItem("i18nextLng") || "").toLowerCase();
    const htmlLang = (document.documentElement.lang || "").toLowerCase();
    const browserLang = (window.navigator.language || "").toLowerCase();
    const effective = stored || htmlLang || browserLang;
    setLang(effective.startsWith("ko") ? "ko" : "en");
  }, []);

  useEffect(() => {
    if (!packageId) return;
    const run = async () => {
      const images = await fetchPackageImages(packageId);
      setHeroImage(pickRandomImage(images) ?? K_CONTENT_PLACEHOLDER_IMAGE);
    };
    run();
  }, [packageId]);

  const generateSchedule = useCallback(async () => {
    if (!packageId || loading) return;
    setTriggered(true);
    setLoading(true);
    setError(null);
    setSchedule([]);
    setCostSummary(null);
    setSavedPlanId(null);
    try {
      const res = await generateKContent(
        packageId,
        { travel_start_date: startDate, travel_end_date: endDate },
        { startDate, endDate, locationName: "Seoul", newsTop10: newsTop10.length > 0 ? newsTop10 : undefined }
      );
      const parsed = parseResponse(res, startDate);
      setSchedule(parsed.schedule);
      setCostSummary(parsed.costSummary);
      if (parsed.packageMeta?.package_id) setPackageMeta(parsed.packageMeta);
      setPlaces(Array.isArray(res.places) ? (res.places as Record<string, unknown>[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packageId, loading, startDate, endDate]);

  const selectedMeta = packageMeta ?? (packageId ? {
    package_id: packageId,
    category: "K-CONTENT",
    title_ko: CATALOG[packageId]?.title_ko,
    title_en: CATALOG[packageId]?.title_en,
    tags: CATALOG[packageId]?.tags,
  } : null);

  const handleSavePlan = useCallback(async () => {
    if (schedule.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const fallbackMeta: Record<string, unknown> = {
        package_id: packageId,
        category: "K-POP",
        title_ko: selectedMeta?.title_ko ?? packageId,
        title_en: selectedMeta?.title_en ?? "K-Content package",
        tags: selectedMeta?.tags ?? "",
      };
      const payloadMeta = (packageMeta as unknown as Record<string, unknown>) ?? fallbackMeta;
      const saveSchedule = schedule.map((item) => ({ ...item })) as Record<string, unknown>[];
      const saveCostSummary = costSummary as unknown as Record<string, unknown> | null;

      const res = await saveKContent({
        packageMeta: payloadMeta,
        schedule: saveSchedule,
        places,
        costSummary: saveCostSummary,
        userId: appUserId ?? undefined,
        location: "K-Content",
        startDate,
        endDate,
      });
      setSavedPlanId(res.plan_id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [
    schedule,
    isSaving,
    packageId,
    selectedMeta?.title_ko,
    selectedMeta?.title_en,
    selectedMeta?.tags,
    packageMeta,
    costSummary,
    places,
    appUserId,
    startDate,
    endDate,
  ]);

  const dayGroups = useMemo(() => {
    return schedule.reduce<Record<number, KScheduleItem[]>>((acc, item) => {
      (acc[item.day] ??= []).push(item);
      return acc;
    }, {});
  }, [schedule]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col md:overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/planner/k-content")}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              >
                ←
              </button>
              <div>
                <p className="text-xs text-gray-400 font-medium">K-Content</p>
                <h1 className="text-xl font-bold text-gray-800">{selectedMeta?.title_ko ?? packageId}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-400 shrink-0">날짜</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (endDate < newStart) setEndDate(newStart);
                  }}
                  className="bg-transparent text-sm text-gray-700 outline-none"
                />
                <span className="text-gray-300">~</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>
              <button
                onClick={generateSchedule}
                disabled={loading || !startDate || !endDate}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    생성 중…
                  </>
                ) : (
                  <>✨ 일정 생성</>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden">
          <div className="flex w-full flex-col border-b border-gray-200 bg-white p-4 sm:p-5 md:w-[40%] md:overflow-auto md:border-b-0 md:border-r">
            <div className="mb-4">
              <HeroBanner
                title={selectedMeta?.title_ko ?? packageId}
                subtitle={selectedMeta?.title_en ?? "K-Content package"}
                ctaLabel=""
                backgroundImage={heroImage ?? undefined}
                cardStyleText
              />
            </div>
            <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              AI 추천 일정
            </h2>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="mt-0.5 text-xl sm:text-2xl">🎬</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{selectedMeta?.title_ko ?? packageId}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                      K-POP
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 sm:text-sm">{selectedMeta?.title_en ?? "K-Content package"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(selectedMeta?.tags ?? "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {!triggered && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <span className="text-4xl">📅</span>
                <p className="text-sm font-medium text-gray-600">날짜를 설정하고<br />일정을 생성해주세요</p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
                <button
                  onClick={generateSchedule}
                  disabled={loading}
                  className="mt-1 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                >
                  ✨ 일정 생성 시작
                </button>
              </div>
            )}

            {loading && (
              <ul className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
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

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex flex-col bg-gray-50 md:flex-1 md:overflow-hidden">
            {!triggered && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
                <span className="mb-3 text-5xl">🗺️</span>
                <p className="text-base font-medium">날짜 선택 후 일정을 생성하세요</p>
                <p className="mt-1 text-sm">상단의 ✨ 일정 생성 버튼을 눌러주세요</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
                <p className="text-sm text-gray-500">
                  AI가 <b>{selectedMeta?.title_ko ?? packageId}</b> 일정을 만드는 중…
                </p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
              </div>
            )}

            {!loading && triggered && schedule.length > 0 && (
              <div className="flex flex-col md:flex-1 md:overflow-hidden">
                <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-gray-800">{selectedMeta?.title_ko ?? packageId} — 추천 일정</h2>
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
                  {costSummary && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400">예상 총 경비</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-sm font-bold text-emerald-600">
                        💰 {costSummary.trip_total}
                      </span>
                      {costSummary.per_day.map((d) => (
                        <span key={d.day} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          Day{d.day} {d.total}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="overflow-auto px-4 py-4 space-y-6 sm:px-5 md:flex-1">
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
                            소계 {costSummary.per_day.find((d) => d.day === Number(day))!.total}
                          </span>
                        )}
                      </div>
                      <ol className="relative border-l-2 border-indigo-100 pl-5 space-y-4">
                        {items.map((item, idx) => (
                          <li key={idx} className="relative">
                            <span className="absolute -left-[1.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700">
                              {idx + 1}
                            </span>
                            {item.source === "db" && (
                              <span className="absolute -top-2 left-3 z-10 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-purple-700 shadow-sm">
                                K-roaddy PICK
                              </span>
                            )}
                            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.time && (
                                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                                      {item.time}
                                    </span>
                                  )}
                                  <span className="font-semibold text-gray-900 truncate">{item.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {item.estimated_cost && (
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                      {item.estimated_cost}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="mt-0.5 text-xs text-indigo-500 font-medium">📍 {item.place}</p>
                              <p className="mt-1 text-sm text-gray-600">
                                {getLocalizedDescription({
                                  description: item.description,
                                  tips: item.tips,
                                  place: item.place || item.title,
                                  source: item.source,
                                  lang,
                                })}
                              </p>
                              {localizeTip(item.tips, lang) && (
                                <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                  💡 {localizeTip(item.tips, lang)}
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

            {!loading && triggered && !error && schedule.length === 0 && (
              <div className="p-5">
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  생성된 일정이 없습니다. 다시 시도해 주세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

