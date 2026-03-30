"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { useNewsStore } from "@/store/slices/newsSlice";
import { AppLayout } from "@/components/organisms/AppLayout";
import {
  fetchKContentPackage,
  generateKContent,
  saveKContent,
  type KContentResponse,
} from "@/service/k_content/k_content";
import { HeroBanner } from "@/components/k-content/HeroBanner";
import {
  fetchPackageImages,
  K_CONTENT_KF_CAFE_FALLBACK_IMAGE,
  K_CONTENT_PLACEHOLDER_IMAGE,
  pickRandomImage,
} from "@/constants/k-content-images";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { ItineraryCard } from "@/components/k-content/ItineraryCard";
import { K_FOOD_MARKET_LIST } from "../constants";

type FoodRegionKey = keyof typeof K_FOOD_MARKET_LIST;
type FoodRegionTab = "ALL" | FoodRegionKey;

const K_FOOD_REGION_TABS: { id: FoodRegionTab; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "SEOUL", label: "서울" },
  { id: "GANGWON", label: "강원" },
  { id: "JEONLA", label: "전라" },
  { id: "GYEONGSANG", label: "경상" },
  { id: "JEJU", label: "제주" },
];

const CAFE_VIBES = [
  {
    id: "industrial_raw",
    label: "Industrial/Raw",
    descriptionKo: "거친 콘크리트와 철제의 힙한 감성",
  },
  {
    id: "traditional_zen",
    label: "Traditional/Zen",
    descriptionKo: "한옥과 나무가 주는 고요한 휴식",
  },
  {
    id: "nature_botanical",
    label: "Nature/Botanical",
    descriptionKo: "초록 식물과 햇살이 가득한 공간",
  },
  {
    id: "retro_newtro",
    label: "Retro/Newtro",
    descriptionKo: "응답하라 감성, 빈티지한 골목 투어",
  },
  {
    id: "modern_minimal",
    label: "Modern/Minimal",
    descriptionKo: "세련된 무채색과 현대적인 조형미",
  },
] as const;

type CafeVibeId = (typeof CAFE_VIBES)[number]["id"];
type ConvenienceTab = "trending" | "recipe";
type ConvenienceVibeId =
  | "spicy_fire"
  | "sweet_salty"
  | "diet_healthy"
  | "night_snack"
  | "hangover"
  | "luxury_meal";

const CONVENIENCE_BRANDS = ["GS25", "CU", "세븐일레븐", "이마트24"] as const;
const CONVENIENCE_RECIPE_VIBES: {
  id: ConvenienceVibeId;
  label: string;
  descriptionKo: string;
}[] = [
  { id: "spicy_fire", label: "화끈한 매운맛", descriptionKo: "스트레스 날리는 매콤 챌린지" },
  { id: "sweet_salty", label: "단짠의 정석", descriptionKo: "달콤함과 짭짤함의 밸런스" },
  { id: "diet_healthy", label: "편의점 다이어트", descriptionKo: "가볍고 든든한 헬시 조합" },
  { id: "night_snack", label: "심야 야식", descriptionKo: "늦은 밤 소확행 야식 레시피" },
  { id: "hangover", label: "해장 꿀조합", descriptionKo: "숙취 케어 특화 조합" },
  { id: "luxury_meal", label: "가성비 정찬", descriptionKo: "편의점 프리미엄 한 끼" },
];

const HERO_IMAGE_FALLBACK_BY_PACKAGE: Record<string, string> = {
  KF_CAFE: K_CONTENT_KF_CAFE_FALLBACK_IMAGE,
};

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
  /** API가 주는 경우(없으면 일정 카드에서 일차 내 순번으로 계산)*/
  order?: number;
  is_twist?: boolean;
  vibe_reason?: string;
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

function inferCategoryFromPackageId(packageId: string | undefined): string {
  if (!packageId) return "KCONTENT";
  const ref = packageId.toUpperCase();
  if (ref.startsWith("KPOP_")) return "KPOP";
  // KD 네임스페이스에는 DRAMA/MOVIE가 함께 존재하므로 fallback 매핑을 분리한다.
  if (ref === "KD_05" || ref === "KD_12") return "KMOVIE";
  if (ref.startsWith("KD_")) return "KDRAMA";
  if (ref.startsWith("KF_")) return "KFOOD";
  return "KCONTENT";
}

function toCategoryBadgeText(category?: string): string {
  const c = (category ?? "").toUpperCase();
  if (c === "KPOP") return "K-POP";
  if (c === "KDRAMA") return "K-DRAMA";
  if (c === "KMOVIE") return "K-MOVIE";
  if (c === "KFOOD") return "K-FOOD";
  return "K-CONTENT";
}

function parseTags(tags?: string): string[] {
  const raw = (tags ?? "").trim();
  if (!raw) return [];
  if (raw.includes(",")) {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

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
    const orderRaw = row.order;
    const order =
      typeof orderRaw === "number"
        ? orderRaw
        : typeof orderRaw === "string" && orderRaw.trim() !== ""
          ? Number(orderRaw) || undefined
          : undefined;
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
      order,
      is_twist: row.is_twist === true,
      vibe_reason: typeof row.vibe_reason === "string" ? row.vibe_reason : undefined,
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
  const { isAuthenticated, logout } = useLoginStore();
  const newsTop10 = useNewsStore((s) => s.newsTop10);
  const appUserId = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;

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

  const isKFoodMarket = packageId === "KF_MARKET";
  const isKFoodCafeVibe = packageId?.toUpperCase() === "KF_CAFE";
  const isKFoodConvenience = packageId?.toUpperCase() === "KF_CONVENIENCE";
  const [foodRegionTab, setFoodRegionTab] = useState<FoodRegionTab>("ALL");
  const [selectedMarket, setSelectedMarket] = useState<{ name: string; description: string } | null>(null);
  const [selectedCafeVibe, setSelectedCafeVibe] = useState<CafeVibeId | null>(null);
  const [cafeKeyword, setCafeKeyword] = useState("");
  const [activeTab, setActiveTab] = useState<ConvenienceTab>("trending");
  const [selectedBrand, setSelectedBrand] = useState<(typeof CONVENIENCE_BRANDS)[number] | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<ConvenienceVibeId | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);

  const foodMarketsForTab = useMemo(() => {
    if (foodRegionTab === "ALL") {
      return (Object.keys(K_FOOD_MARKET_LIST) as FoodRegionKey[]).flatMap((key) =>
        K_FOOD_MARKET_LIST[key].map((m) => ({ ...m, regionKey: key }))
      );
    }
    return K_FOOD_MARKET_LIST[foodRegionTab].map((m) => ({ ...m, regionKey: foodRegionTab }));
  }, [foodRegionTab]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    setSelectedMarket(null);
  }, [foodRegionTab]);

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
      const packageKey = packageId.toUpperCase();
      const images = await fetchPackageImages(packageId);
      setHeroImage(
        pickRandomImage(images) ??
          HERO_IMAGE_FALLBACK_BY_PACKAGE[packageKey] ??
          K_CONTENT_PLACEHOLDER_IMAGE
      );
      const detail = await fetchKContentPackage(packageId);
      if (detail) {
        setPackageMeta({
          package_id: detail.package_id,
          category: detail.category,
          title_ko: detail.title_ko ?? undefined,
          title_en: detail.title_en,
          tags: detail.tags ?? undefined,
        });
      }
    };
    run().catch(() => {
      // 상세 메타 조회 실패 시 fallback UI 유지
    });
  }, [packageId]);

  const generateSchedule = useCallback(
    async (overrides?: {
      locationName?: string;
      keyword?: string;
      pickedVibe?: string | null;
    }) => {
      if (!packageId || loading) return;
      if (isKFoodMarket && !overrides?.locationName) return;

      setTriggered(true);
      setLoading(true);
      setError(null);
      setSchedule([]);
      setCostSummary(null);
      setSavedPlanId(null);
      try {
        const locationName = overrides?.locationName ?? "Seoul";
        const keyword = overrides?.keyword ?? overrides?.locationName;
        const picked =
          overrides?.pickedVibe != null && String(overrides.pickedVibe).trim() !== ""
            ? String(overrides.pickedVibe).trim()
            : undefined;

        const res = await generateKContent(
          packageId,
          {
            travel_start_date: startDate,
            travel_end_date: endDate,
            ...(keyword ? { keyword } : {}),
            ...(picked ? { pickedVibe: picked } : {}),
          },
          {
            startDate,
            endDate,
            locationName,
            newsTop10: newsTop10.length > 0 ? newsTop10 : undefined,
          }
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
    },
    [packageId, loading, startDate, endDate, isKFoodMarket, newsTop10]
  );

  const handleKFoodMarketGenerate = useCallback(() => {
    if (!selectedMarket) return;
    void generateSchedule({
      locationName: selectedMarket.name,
      keyword: selectedMarket.name,
    });
  }, [selectedMarket, generateSchedule]);

  const handleKFoodCafeGenerate = useCallback(() => {
    const v = CAFE_VIBES.find((item) => item.id === selectedCafeVibe);
    const vibePart =
      v != null ? `${v.label} — ${v.descriptionKo}` : "";
    const trimmedKeyword = cafeKeyword.trim();
    const keyword = trimmedKeyword
      ? vibePart
        ? `${vibePart} | 카페·장소 힌트: ${trimmedKeyword}`
        : trimmedKeyword
      : vibePart;
    if (!keyword) return;
    void generateSchedule({
      locationName: trimmedKeyword || "Seoul",
      keyword,
      pickedVibe: selectedCafeVibe ?? undefined,
    });
  }, [selectedCafeVibe, cafeKeyword, generateSchedule]);

  const handleKFoodConvenienceGenerate = useCallback(() => {
    if (activeTab === "trending" && !selectedBrand && !searchKeyword.trim()) return;
    if (activeTab === "recipe" && !selectedVibe && !searchKeyword.trim()) return;

    const trimmedKeyword = searchKeyword.trim();
    if (activeTab === "trending") {
      const trendKeyword = [
        "trending",
        "편의점 유행템",
        selectedBrand ? `브랜드:${selectedBrand}` : "",
        trimmedKeyword ? `상품:${trimmedKeyword}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      void generateSchedule({
        locationName: selectedBrand ?? "Seoul",
        keyword: trendKeyword,
      });
      return;
    }

    const selectedRecipeVibe = CONVENIENCE_RECIPE_VIBES.find((item) => item.id === selectedVibe);
    const recipeKeyword = [
      "recipe",
      selectedRecipeVibe?.label ?? "",
      selectedRecipeVibe?.descriptionKo ?? "",
      trimmedKeyword ? `추가요청:${trimmedKeyword}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    void generateSchedule({
      locationName: "Seoul",
      keyword: recipeKeyword,
      pickedVibe: selectedVibe ?? undefined,
    });
  }, [activeTab, selectedBrand, selectedVibe, searchKeyword, generateSchedule]);

  const convenienceTrendingCards = useMemo(() => {
    const brandFallback = selectedBrand ?? "GS25";
    if (schedule.length === 0) {
      return [
        { title: "연세우유 크림빵", brand: brandFallback, tags: ["#신상", "#품절주의"] },
        { title: "제로콜라 얼음컵 하이볼", brand: "CU", tags: ["#리뷰폭발", "#재구매"] },
      ];
    }
    return schedule.slice(0, 4).map((item) => ({
      title: item.title || item.place || "AI 추천 유행템",
      brand: selectedBrand ?? item.place ?? brandFallback,
      tags: ["#신상", "#품절주의"],
    }));
  }, [schedule, selectedBrand]);

  const convenienceRecipeTitle = useMemo(() => {
    if (schedule[0]?.title) return schedule[0].title;
    const vibe = CONVENIENCE_RECIPE_VIBES.find((v) => v.id === selectedVibe);
    return vibe ? `${vibe.label} 챌린지 2026 Ver.` : "마크정식 2026 Ver.";
  }, [schedule, selectedVibe]);

  const convenienceShoppingList = useMemo(() => {
    if (schedule.length === 0) {
      return ["컵라면", "참치마요 삼각김밥", "스트링 치즈", "탄산수"];
    }
    return schedule
      .slice(0, 5)
      .map((item) => item.place || item.title)
      .filter(Boolean);
  }, [schedule]);

  const convenienceCookingSteps = useMemo(() => {
    if (schedule.length === 0) {
      return ["재료를 모두 준비하고 전자레인지 가능한 용기에 담기", "소스/토핑을 섞어 1분 30초 조리하기", "취향에 맞게 토핑 추가 후 인증샷 남기기"];
    }
    return schedule
      .slice(0, 3)
      .map((item, idx) => `${idx + 1}. ${item.description || item.title}`);
  }, [schedule]);

  const selectedMeta = packageMeta ?? (packageId
    ? {
        package_id: packageId,
        category: inferCategoryFromPackageId(packageId),
        title_ko:
          packageId === "KF_MARKET"
            ? "전국 전통시장 먹거리 탐방"
            : packageId?.toUpperCase() === "KF_CAFE"
            ? "K-디저트 & 카페 감성 투어"
            : packageId?.toUpperCase() === "KF_CONVENIENCE"
            ? "K-편의점 꿀조합 챌린지"
            : packageId,
        title_en:
          packageId === "KF_MARKET"
            ? "Traditional markets & street food across Korea"
            : packageId?.toUpperCase() === "KF_CAFE"
            ? "K-dessert and vibe-matched cafe tour"
            : packageId?.toUpperCase() === "KF_CONVENIENCE"
            ? "품절 대란 신상부터 나만의 시크릿 레시피까지, 편의점 모디슈머가 되어보세요!"
            : "K-Content package",
        tags:
          packageId === "KF_MARKET"
            ? "전통시장, 먹거리, 로컬푸드"
            : packageId?.toUpperCase() === "KF_CAFE"
            ? "카페, 디저트, 편집샵, 감성투어"
            : packageId?.toUpperCase() === "KF_CONVENIENCE"
            ? "편의점, 꿀조합, 모디슈머, 챌린지"
            : "",
      }
    : null);

  const handleSavePlan = useCallback(async () => {
    if (schedule.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const fallbackMeta: Record<string, unknown> = {
        package_id: packageId,
        category: selectedMeta?.category ?? inferCategoryFromPackageId(packageId),
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
                onClick={() => {
                  if (isKFoodMarket) void handleKFoodMarketGenerate();
                  else if (isKFoodCafeVibe) void handleKFoodCafeGenerate();
                  else if (isKFoodConvenience) void handleKFoodConvenienceGenerate();
                  else void generateSchedule();
                }}
                disabled={
                  loading ||
                  !startDate ||
                  !endDate ||
                  (isKFoodMarket && !selectedMarket) ||
                  (isKFoodCafeVibe && !selectedCafeVibe && !cafeKeyword.trim()) ||
                  (isKFoodConvenience &&
                    ((activeTab === "trending" && !selectedBrand && !searchKeyword.trim()) ||
                      (activeTab === "recipe" && !selectedVibe && !searchKeyword.trim())))
                }
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
                <span className="mt-0.5 text-xl sm:text-2xl">
                  {isKFoodMarket ? "🍜" : isKFoodCafeVibe ? "☕" : isKFoodConvenience ? "🏪" : "🎬"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{selectedMeta?.title_ko ?? packageId}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                      {toCategoryBadgeText(selectedMeta?.category)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 sm:text-sm">{selectedMeta?.title_en ?? "K-Content package"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parseTags(selectedMeta?.tags)
                      .map((tag) => (
                        <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {isKFoodMarket && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    지역 선택
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {K_FOOD_REGION_TABS.map((tab) => {
                      const active = foodRegionTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFoodRegionTab(tab.id)}
                          disabled={loading}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                            active
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    전통시장
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                    {foodMarketsForTab.map((m) => {
                      const selected = selectedMarket?.name === m.name;
                      return (
                        <button
                          key={`${m.regionKey}-${m.name}`}
                          type="button"
                          onClick={() => !loading && setSelectedMarket({ name: m.name, description: m.description })}
                          disabled={loading}
                          className={`rounded-xl border-2 p-3 text-left text-sm transition-all disabled:opacity-50 ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-100"
                              : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm"
                          }`}
                        >
                          <span className="font-semibold text-gray-900">{m.name}</span>
                          <p className="mt-1 text-xs leading-snug text-gray-500">{m.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleKFoodMarketGenerate()}
                  disabled={!selectedMarket || loading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이 시장 먹방 일정 생성하기
                </button>
              </div>
            )}

            {isKFoodCafeVibe && (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="mb-2 text-base font-bold text-gray-900">
                    당신의 오늘 하루는 어떤 감성인가요?
                  </h3>
                  <p className="text-sm text-gray-500">
                    취향에 맞는 Vibe를 고르거나 카페 이름을 직접 입력해 AI 코스를 생성하세요.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Vibe Grid
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
                    {CAFE_VIBES.map((vibe) => {
                      const selected = selectedCafeVibe === vibe.id;
                      return (
                        <button
                          key={vibe.id}
                          type="button"
                          onClick={() => !loading && setSelectedCafeVibe(vibe.id)}
                          disabled={loading}
                          className={`flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition-all disabled:opacity-50 ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                              : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          <span className="text-sm font-medium leading-tight">{vibe.label}</span>
                          <span
                            className={`text-[11px] leading-snug ${
                              selected ? "text-indigo-600/90" : "text-gray-500"
                            }`}
                          >
                            {vibe.descriptionKo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Search Bar
                  </p>
                  <input
                    type="text"
                    value={cafeKeyword}
                    onChange={(e) => setCafeKeyword(e.target.value)}
                    disabled={loading}
                    placeholder="직접 카페 이름을 입력해 보세요 (예: 성수 텅플래닛)"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleKFoodCafeGenerate()}
                  disabled={loading || (!selectedCafeVibe && !cafeKeyword.trim())}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  AI 일정 생성하기
                </button>
              </div>
            )}

            {isKFoodConvenience && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-cyan-50 to-violet-50 p-3">
                  <div className="relative grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
                    <div
                      className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-lg bg-gradient-to-r ${
                        activeTab === "trending"
                          ? "left-1 from-orange-500 to-rose-500 transition-all duration-300"
                          : "left-[calc(50%+0.125rem)] from-emerald-500 via-cyan-500 to-violet-500 transition-all duration-300"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveTab("trending")}
                      className={`relative z-10 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                        activeTab === "trending" ? "text-white" : "text-gray-600"
                      }`}
                    >
                      🔥 요즘 유행템
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("recipe")}
                      className={`relative z-10 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                        activeTab === "recipe" ? "text-white" : "text-gray-600"
                      }`}
                    >
                      🧪 나만의 꿀조합
                    </button>
                  </div>
                </div>

                {activeTab === "trending" ? (
                  <div className="space-y-4 transition-all duration-300">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">지금 편의점에서 가장 구하기 힘든 건?</h3>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Selection</p>
                        <div className="flex flex-wrap gap-2">
                          {CONVENIENCE_BRANDS.map((brand) => {
                            const selected = selectedBrand === brand;
                            return (
                              <button
                                key={brand}
                                type="button"
                                onClick={() => setSelectedBrand(brand)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  selected
                                    ? "border-rose-300 bg-rose-100 text-rose-700"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:bg-rose-50"
                                }`}
                              >
                                {brand}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Search Bar</p>
                        <input
                          type="text"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          placeholder="예: 연세우유 크림빵"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                        />
                      </div>
                    </div>
                ) : (
                    <div className="space-y-4 transition-all duration-300">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">어떤 맛의 조합에 도전해볼까요?</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {CONVENIENCE_RECIPE_VIBES.map((vibe) => {
                          const selected = selectedVibe === vibe.id;
                          return (
                            <button
                              key={vibe.id}
                              type="button"
                              onClick={() => setSelectedVibe(vibe.id)}
                              className={`rounded-xl border-2 px-3 py-2 text-left transition-all ${
                                selected
                                  ? "border-violet-400 bg-violet-50 shadow-sm"
                                  : "border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/60"
                              }`}
                            >
                              <p className="text-sm font-semibold text-gray-900">{vibe.label}</p>
                              <p className="mt-1 text-[11px] text-gray-500">{vibe.descriptionKo}</p>
                            </button>
                          );
                        })}
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">추가 키워드</p>
                        <input
                          type="text"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          placeholder="예: 맵부심 챌린지, 단짠 디저트"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleKFoodConvenienceGenerate()}
                        disabled={loading || (!selectedVibe && !searchKeyword.trim())}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        AI 꿀조합 레시피 생성하기
                      </button>
                    </div>
                )}
              </div>
            )}

            {!triggered && !loading && !isKFoodMarket && !isKFoodCafeVibe && !isKFoodConvenience && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <span className="text-4xl">📅</span>
                <p className="text-sm font-medium text-gray-600">날짜를 설정하고<br />일정을 생성해주세요</p>
                <p className="text-xs text-gray-400">{startDate} ~ {endDate}</p>
                <button
                  onClick={() => void generateSchedule()}
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
                <p className="text-base font-medium">
                  {isKFoodMarket && !selectedMarket
                    ? "시장을 선택한 뒤 일정을 생성하세요"
                    : isKFoodCafeVibe && !selectedCafeVibe && !cafeKeyword.trim()
                    ? "감성(Vibe) 또는 카페 이름을 선택하세요"
                    : isKFoodConvenience &&
                      ((activeTab === "trending" && !selectedBrand && !searchKeyword.trim()) ||
                        (activeTab === "recipe" && !selectedVibe && !searchKeyword.trim()))
                    ? "탭별 조건을 선택하고 생성하세요"
                    : "날짜 선택 후 일정을 생성하세요"}
                </p>
                <p className="mt-1 text-sm">
                  {isKFoodMarket
                    ? "왼쪽에서 시장을 고르고 [이 시장 먹방 일정 생성하기] 또는 상단 ✨ 일정 생성을 눌러주세요"
                    : isKFoodCafeVibe
                    ? "왼쪽에서 감성/카페명을 정하고 [AI 일정 생성하기]를 눌러주세요"
                    : isKFoodConvenience
                    ? "상단 탭에서 모드를 고른 뒤 키워드를 입력해 생성하세요"
                    : "상단의 ✨ 일정 생성 버튼을 눌러주세요"}
                </p>
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
                {isKFoodConvenience ? (
                  <div className="overflow-auto px-4 py-4 space-y-5 sm:px-5 md:flex-1">
                    {activeTab === "trending" ? (
                      <div className="space-y-3">
                        {convenienceTrendingCards.map((card) => (
                          <article
                            key={`${card.brand}-${card.title}`}
                            className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
                              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
                                {card.brand}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {card.tags.map((tag) => (
                                <span
                                  key={`${card.title}-${tag}`}
                                  className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="mt-3 w-full rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-2 text-xs font-semibold text-white"
                            >
                              이거 파는 가까운 곳 찾기
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                          <h3 className="text-base font-bold text-gray-900">{convenienceRecipeTitle}</h3>
                          <p className="mt-1 text-xs text-violet-600">
                            #모디슈머 #편의점챌린지 #AI레시피
                          </p>
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shopping List</p>
                            <ul className="mt-2 space-y-2">
                              {convenienceShoppingList.map((item) => {
                                const checked = checkedIngredients.includes(item);
                                return (
                                  <li key={item}>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          setCheckedIngredients((prev) =>
                                            checked ? prev.filter((v) => v !== item) : [...prev, item]
                                          )
                                        }
                                      />
                                      <span className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                        {item}
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cooking Steps</p>
                            <ol className="mt-2 space-y-2">
                              {convenienceCookingSteps.map((step) => (
                                <li key={step} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                            <b>Challenge Location</b>: AI 추천 길먹 명당 (100km 이내) — 성수 서울숲 앞 벤치존
                          </div>
                        </article>
                      </div>
                    )}
                  </div>
                ) : (
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
                              <ItineraryCard
                                packageId={packageId}
                                item={item}
                                stepIndex={idx}
                                lang={lang}
                                getLocalizedDescription={getLocalizedDescription}
                                localizeTip={localizeTip}
                              />
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
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

