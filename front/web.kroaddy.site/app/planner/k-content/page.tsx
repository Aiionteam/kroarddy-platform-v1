"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/organisms/AppLayout";
import { HeroBanner } from "@/components/k-content/HeroBanner";
import { ContentRow } from "@/components/k-content/ContentRow";
import type { ContentRowItem } from "@/components/k-content/ContentRow";
import { ItineraryPreview } from "@/components/k-content/ItineraryPreview";
import type { ItineraryDay } from "@/components/k-content/ItineraryPreview";
import {
  pickRandomImage,
  resolveCardImage,
} from "@/constants/k-content-images";
import {
  K_CONTENT_KDRAMA_FALLBACK_ITEMS,
  K_CONTENT_KPOP_FALLBACK_ITEMS,
} from "@/constants/k-content-fallback-items";
import { K_CONTENT_KFOOD_FALLBACK_ITEMS } from "./constants";
import { fetchKContentPackages, type KContentPackageListItem } from "@/service/k_content/k_content";
import type { TFunction } from "i18next";

// ─── Mock data: Sample itinerary ─────────────────────────────────────────────

const SAMPLE_ITINERARY_DAYS: ItineraryDay[] = [
  {
    day: 1,
    dateLabel: "Seoul",
    steps: [
      {
        time: "10:00",
        title: "HYBE Building",
        place: "Yongsan, Seoul",
        description: "HYBE Insight museum and label HQ. K-Pop history and exhibitions.",
      },
      {
        time: "12:30",
        title: "Hongdae K-Pop Store",
        place: "Hongdae, Seoul",
        description: "Albums, merch, and photo cards. Fan must-visit.",
      },
      {
        time: "15:00",
        title: "Hongdae Busking Street",
        place: "Hongdae, Seoul",
        description: "Street performances and indie artists. Free live music.",
      },
      {
        time: "18:00",
        title: "K-Pop Cafe",
        place: "Hongdae, Seoul",
        description: "Theme cafe with idol merch and photo zones.",
      },
    ],
  },
];

const K_BEAUTY_EXAMPLE_ITEMS: ContentRowItem[] = [
  {
    id: "KBEAUTY_01",
    title: "올리브영 플래그십",
    description: "스킨케어·메이크업 트렌드를 한 번에 비교 쇼핑",
    imageUrl: undefined,
    placeholderGradient: "from-pink-500 to-rose-600",
  },
  {
    id: "KBEAUTY_02",
    title: "명동 뷰티 스트리트",
    description: "브랜드 로드샵 중심으로 베스트셀러 빠르게 탐색",
    imageUrl: undefined,
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "KBEAUTY_03",
    title: "스킨케어 체험샵",
    description: "피부 진단 기반 맞춤 케어와 체험형 뷰티 프로그램",
    imageUrl: undefined,
    placeholderGradient: "from-violet-500 to-purple-600",
  },
];

const KPOP_TITLE_EN_BY_ID: Record<string, string> = {
  KPOP_01: "BTS: Eternal HYYH",
  KPOP_02: "BLACKPINK: Hip & Luxury",
  KPOP_03: "SEVENTEEN & Stray Kids: Performance Energy",
  KPOP_04: "NewJeans & IVE: High-Teen Seoul",
  KPOP_05: "SM: Kwangya Express",
  KPOP_06: "Hands-on Idol Experience",
  KPOP_07: "Hongdae: Center of Fandom Culture",
  KPOP_08: "K-OST & Emotional Healing Seoul",
};

const KDRAMA_TITLE_EN_BY_ID: Record<string, string> = {
  KD_01: "Goblin",
  KD_02: "Squid Game",
  KD_03: "Crash Landing on You",
  KD_04: "Kingdom",
  KD_05: "Parasite",
  KD_06: "Lovely Runner",
  KD_07: "Hotel Del Luna",
  KD_08: "King the Land",
  KD_09: "Mr. Sunshine",
  KD_10: "Descendants of the Sun",
  KD_11: "Queen of Tears",
  KD_12: "The Man Who Lives with the King",
};

/** English card lines — used as i18n defaultValue when locale has no override */
const KPOP_DESC_EN_BY_ID: Record<string, string> = {
  KPOP_01: "BTS, ARMY, Gangnam, HYBE",
  KPOP_02: "BLACKPINK, YG, Luxury, Trend",
  KPOP_03: "SEVENTEEN, Stray Kids, JYP, Performance",
  KPOP_04: "NewJeans, IVE, Y2K, Seongsu, Hannam",
  KPOP_05: "SM, aespa, NCT, Kwangya, Seongsu",
  KPOP_06: "Experience, Dance, Recording, Idol life",
  KPOP_07: "Hongdae, Busking, Album, Fans",
  KPOP_08: "IU, OST, Healing, Retro, Seoul",
};

const KDRAMA_DESC_EN_BY_ID: Record<string, string> = {
  KD_01: "Goblin · #GongYoo #Fantasy #Romance",
  KD_02: "Squid Game · #Netflix #Survival #Thriller",
  KD_03: "Crash Landing on You · #HyunBin #SonYeJin #Romance",
  KD_04: "Kingdom · #Zombies #Historical #Horror",
  KD_05: "Parasite · #Oscar #BongJoonHo #SocialIssues",
  KD_06: "Lovely Runner · #ByeonWooSeok #TimeSlip #Youth",
  KD_07: "Hotel Del Luna · #IU #Fantasy #Mystery",
  KD_08: "King the Land · #JunHo #Yoona #Luxury",
  KD_09: "Mr. Sunshine · #History #LeeByungHun #KimTaeri",
  KD_10: "Descendants of the Sun · #SongJoongKi #SongHyeKyo #Military",
  KD_11: "Queen of Tears · #KimSooHyun #KimJiWon #Chaebol",
  KD_12: "The Man Who Lives with the King · #GangDongWon #YooHaeJin #History",
};

function localizeKpopKdramaRowItem(
  t: TFunction,
  item: ContentRowItem,
  kind: "kpop" | "kdrama",
  isKorean: boolean,
): ContentRowItem {
  if (isKorean) return item;
  const prefix = kind === "kpop" ? "planner.kcontent.fallback.kpop" : "planner.kcontent.fallback.kdrama";
  const titleDefault =
    kind === "kpop"
      ? (KPOP_TITLE_EN_BY_ID[item.id] ?? item.title)
      : (KDRAMA_TITLE_EN_BY_ID[item.id] ?? item.title);
  const descDefault =
    kind === "kpop"
      ? (KPOP_DESC_EN_BY_ID[item.id] ?? item.description)
      : (KDRAMA_DESC_EN_BY_ID[item.id] ?? item.description);
  return {
    ...item,
    title: t(`${prefix}.${item.id}.title`, { defaultValue: titleDefault }),
    description: t(`${prefix}.${item.id}.description`, { defaultValue: descDefault }),
  };
}

function getLocalizedFallbackItem(
  t: (key: string, options?: Record<string, unknown>) => string,
  item: ContentRowItem,
  prefix: "planner.kcontent.fallback.kfood" | "planner.kcontent.fallback.kbeauty",
): ContentRowItem {
  return {
    ...item,
    title: t(`${prefix}.${item.id}.title`, { defaultValue: item.title }),
    description: t(`${prefix}.${item.id}.description`, { defaultValue: item.description }),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function KContentPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const { t, i18n } = useTranslation();
  const isKorean = (i18n.language || "").toLowerCase().startsWith("ko");
  const [heroImage, setHeroImage] = React.useState<string>("/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg");
  const [cardItems, setCardItems] = React.useState<ContentRowItem[]>([]);
  const [kDramaItems, setKDramaItems] = React.useState<ContentRowItem[]>([]);
  const localizedKFoodFallback = React.useMemo(
    () => K_CONTENT_KFOOD_FALLBACK_ITEMS.map((item) => getLocalizedFallbackItem(t, item, "planner.kcontent.fallback.kfood")),
    [t]
  );
  const [kFoodItems, setKFoodItems] = React.useState<ContentRowItem[]>(localizedKFoodFallback);
  const kBeautyItems = React.useMemo(
    () => K_BEAUTY_EXAMPLE_ITEMS.map((item) => getLocalizedFallbackItem(t, item, "planner.kcontent.fallback.kbeauty")),
    [t]
  );

  const dramaGradients = React.useMemo(
    () => [
      "from-violet-500 to-indigo-600",
      "from-fuchsia-500 to-pink-600",
      "from-sky-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
    ],
    []
  );
  const kpopGradients = React.useMemo(
    () => [
      "from-rose-500 to-pink-600",
      "from-violet-500 to-purple-600",
      "from-fuchsia-500 to-rose-600",
      "from-indigo-500 to-violet-600",
      "from-amber-500 to-orange-600",
      "from-emerald-500 to-teal-600",
      "from-sky-500 to-blue-600",
      "from-amber-600 to-rose-600",
    ],
    []
  );

  const shuffleItems = React.useCallback((items: ContentRowItem[]) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    return next;
  }, []);

  const mapDramaMoviePackages = React.useCallback(
    async (packages: KContentPackageListItem[]) => {
      const mapped = await Promise.all(
        packages.map(async (pkg, idx) => ({
          id: pkg.package_id,
          title: (isKorean ? (pkg.title_ko || pkg.title_en) : (pkg.title_en || pkg.title_ko)) ?? "",
          description: isKorean ? (pkg.tags || pkg.description_en || "") : (pkg.description_en || pkg.tags || ""),
          imageUrl: await resolveCardImage(pkg.package_id),
          placeholderGradient: dramaGradients[idx % dramaGradients.length]!,
        }))
      );
      return mapped;
    },
    [dramaGradients, isKorean]
  );

  const mapKpopPackages = React.useCallback(
    async (packages: KContentPackageListItem[]) => {
      const mapped = await Promise.all(
        packages.map(async (pkg, idx) => {
          return {
            id: pkg.package_id,
            title: (isKorean ? (pkg.title_ko || pkg.title_en) : (pkg.title_en || pkg.title_ko)) ?? "",
            description: isKorean ? (pkg.tags || pkg.description_en || "") : (pkg.description_en || pkg.tags || ""),
            imageUrl: await resolveCardImage(pkg.package_id),
            placeholderGradient: kpopGradients[idx % kpopGradients.length]!,
          };
        })
      );
      return mapped;
    },
    [kpopGradients, isKorean]
  );

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    const run = async () => {
      // 상단 배너 이미지 랜덤 (public/k_content/banner/*)
      try {
        const res = await fetch("/api/k-content/images/banner", { cache: "no-store" });
        const data = (await res.json()) as { images?: string[] };
        const bannerImages = Array.isArray(data.images) ? data.images : [];
        setHeroImage(pickRandomImage(bannerImages) ?? "/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg");
      } catch {
        setHeroImage("/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg");
      }

      const nextItems = await Promise.all(
        [fetchKContentPackages("KPOP"), fetchKContentPackages("KDRAMA"), fetchKContentPackages("KMOVIE")]
      );
      const [kpopPkgs, dramaPkgs, moviePkgs] = nextItems;
      const mappedKpop = await mapKpopPackages(kpopPkgs);
      const mappedKpopLocalized = mappedKpop.map((item) => localizeKpopKdramaRowItem(t, item, "kpop", isKorean));
      setCardItems(
        shuffleItems(
          mappedKpopLocalized.length > 0
            ? mappedKpopLocalized
            : K_CONTENT_KPOP_FALLBACK_ITEMS.map((item) => localizeKpopKdramaRowItem(t, item, "kpop", isKorean))
        )
      );

      // K-Drama + K-Movie를 실제 API에서 가져와 단일 K-DRAMA row로 렌더링
      const merged = [...dramaPkgs, ...moviePkgs];
      const mappedDrama = await mapDramaMoviePackages(merged);
      const mappedDramaLocalized = mappedDrama.map((item) => localizeKpopKdramaRowItem(t, item, "kdrama", isKorean));
      setKDramaItems(
        shuffleItems(
          mappedDramaLocalized.length > 0
            ? mappedDramaLocalized
            : K_CONTENT_KDRAMA_FALLBACK_ITEMS.map((item) => localizeKpopKdramaRowItem(t, item, "kdrama", isKorean))
        )
      );

      const mappedKFoodRaw = await Promise.all(
        K_CONTENT_KFOOD_FALLBACK_ITEMS.map(async (item) => ({
          ...item,
          imageUrl: await resolveCardImage(item.id),
        }))
      );
      const mappedKFood = mappedKFoodRaw.map((item) =>
        getLocalizedFallbackItem(t, item, "planner.kcontent.fallback.kfood")
      );
      setKFoodItems(mappedKFood);
    };
    run().catch(() => {
      setCardItems(shuffleItems(K_CONTENT_KPOP_FALLBACK_ITEMS.map((item) => localizeKpopKdramaRowItem(t, item, "kpop", isKorean))));
      setKDramaItems(shuffleItems(K_CONTENT_KDRAMA_FALLBACK_ITEMS.map((item) => localizeKpopKdramaRowItem(t, item, "kdrama", isKorean))));
      setKFoodItems(localizedKFoodFallback);
    });
  }, [isKorean, localizedKFoodFallback, mapDramaMoviePackages, mapKpopPackages, shuffleItems, t]);

  const handleCtaClick = () => {
    // Prototype: navigate to planner root or show toast
    router.push("/planner");
  };

  const handleCardClick = (item: ContentRowItem) => {
    router.push(`/planner/k-content/${item.id}`);
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => router.push("/planner")}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label={t("planner.kcontent.back", { defaultValue: "플래너로 돌아가기" })}
          >
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-800">{t("planner.kcontent.title", { defaultValue: "K-Content" })}</h2>
            <p className="text-[11px] text-gray-400">
              {t("planner.kcontent.subtitle", { defaultValue: "K-Pop, 드라마, 음식, 뷰티로 한국을 탐험해보세요" })}
            </p>
          </div>
        </div>

        {/* Scrollable body: Hero + Rows (dark) + Itinerary (gray) */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero */}
          <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
            <HeroBanner
              title={t("planner.kcontent.hero_title", { defaultValue: "K-Content Travel" })}
              subtitle={t("planner.kcontent.hero_subtitle", { defaultValue: "K-Pop, 드라마, 음식, 뷰티로 한국을 탐험해보세요" })}
              ctaLabel={t("planner.kcontent.hero_cta", { defaultValue: "AI 루트 생성" })}
              onCtaClick={handleCtaClick}
              backgroundImage={heroImage}
              cardStyleText
            />
          </div>

          {/* Content rows: same tone as Standard mode */}
          <div className="bg-gray-100 px-0 py-6">
            <ContentRow
              title={t("planner.kcontent.row_kpop", { defaultValue: "K-POP" })}
              items={cardItems}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title={t("planner.kcontent.row_kdrama", { defaultValue: "K-DRAMA" })}
              items={kDramaItems}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title={t("planner.kcontent.row_kfood", { defaultValue: "K-FOOD" })}
              items={kFoodItems}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title={t("planner.kcontent.row_kbeauty", { defaultValue: "K-BEAUTY" })}
              items={kBeautyItems}
              onCardClick={handleCardClick}
            />
          </div>

          {/* Itinerary preview */}
          <div className="px-4 py-6 sm:px-6 sm:py-8">
            <ItineraryPreview
              title={t("planner.kcontent.sample_itinerary", { defaultValue: "K-POP Fan Tour in Seoul" })}
              days={SAMPLE_ITINERARY_DAYS}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
