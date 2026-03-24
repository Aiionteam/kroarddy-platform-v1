"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
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
import { fetchKContentPackages, type KContentPackageListItem } from "@/service/k_content/k_content";

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

const K_FOOD_EXAMPLE_ITEMS: ContentRowItem[] = [
  {
    id: "KFOOD_01",
    title: "광장시장 로컬 푸드",
    description: "빈대떡·마약김밥·육회까지 시장 대표 먹거리 체험",
    imageUrl: undefined,
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "KFOOD_02",
    title: "명동 길거리 음식",
    description: "명동 야시장 중심으로 간편하고 다양한 K-스트리트푸드",
    imageUrl: undefined,
    placeholderGradient: "from-red-500 to-orange-600",
  },
  {
    id: "KFOOD_03",
    title: "한식 BBQ 나이트",
    description: "삼겹살, 갈비, 후식까지 이어지는 저녁 집중 코스",
    imageUrl: undefined,
    placeholderGradient: "from-rose-600 to-red-600",
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function KContentPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const [heroImage, setHeroImage] = React.useState<string>("/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg");
  const [cardItems, setCardItems] = React.useState<ContentRowItem[]>([]);
  const [kDramaItems, setKDramaItems] = React.useState<ContentRowItem[]>([]);

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
          title: pkg.title_ko || pkg.title_en,
          description: pkg.description_en || pkg.tags || "",
          imageUrl: await resolveCardImage(pkg.package_id),
          placeholderGradient: dramaGradients[idx % dramaGradients.length]!,
        }))
      );
      return mapped;
    },
    [dramaGradients]
  );

  const mapKpopPackages = React.useCallback(
    async (packages: KContentPackageListItem[]) => {
      const mapped = await Promise.all(
        packages.map(async (pkg, idx) => {
          return {
            id: pkg.package_id,
            title: pkg.title_ko || pkg.title_en,
            description: pkg.description_en || pkg.tags || "",
            imageUrl: await resolveCardImage(pkg.package_id),
            placeholderGradient: kpopGradients[idx % kpopGradients.length]!,
          };
        })
      );
      return mapped;
    },
    [kpopGradients]
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
      setCardItems(shuffleItems(mappedKpop));

      // K-Drama + K-Movie를 실제 API에서 가져와 단일 K-DRAMA row로 렌더링
      const merged = [...dramaPkgs, ...moviePkgs];
      const mappedDrama = await mapDramaMoviePackages(merged);
      setKDramaItems(shuffleItems(mappedDrama));
    };
    run().catch(() => {
      setCardItems([]);
      setKDramaItems([]);
    });
  }, [mapDramaMoviePackages, mapKpopPackages, shuffleItems]);

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
            aria-label="Back to planner"
          >
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-800">K-Content</h2>
            <p className="text-[11px] text-gray-400">
              Explore Korea through K-Pop, Drama, Food and Beauty
            </p>
          </div>
        </div>

        {/* Scrollable body: Hero + Rows (dark) + Itinerary (gray) */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero */}
          <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
            <HeroBanner
              title="K-Content Travel"
              subtitle="Explore Korea through K-Pop, Drama, Food and Beauty"
              ctaLabel="Generate AI Route"
              onCtaClick={handleCtaClick}
              backgroundImage={heroImage}
              cardStyleText
            />
          </div>

          {/* Content rows: same tone as Standard mode */}
          <div className="bg-gray-100 px-0 py-6">
            <ContentRow
              title="K-POP"
              items={cardItems}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="K-DRAMA"
              items={kDramaItems}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="K-FOOD"
              items={K_FOOD_EXAMPLE_ITEMS}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="K-BEAUTY"
              items={K_BEAUTY_EXAMPLE_ITEMS}
              onCardClick={handleCardClick}
            />
          </div>

          {/* Itinerary preview */}
          <div className="px-4 py-6 sm:px-6 sm:py-8">
            <ItineraryPreview
              title="K-POP Fan Tour in Seoul"
              days={SAMPLE_ITINERARY_DAYS}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
