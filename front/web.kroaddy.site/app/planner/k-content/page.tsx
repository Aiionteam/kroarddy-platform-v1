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
  fetchPackageImages,
  K_CONTENT_PLACEHOLDER_IMAGE,
  pickRandomImage,
} from "@/constants/k-content-images";

// ─── Mock data: DB seeded 8 packages (placeholder images) ──────────────────
const K_CONTENT_PACKAGE_ITEMS: ContentRowItem[] = [
  {
    id: "KPOP_01",
    title: "BTS: 영원한 화양연화",
    description: "BTS, ARMY, Gangnam, HYBE",
    imageUrl: undefined,
    placeholderGradient: "from-rose-500 to-pink-600",
  },
  {
    id: "KPOP_02",
    title: "블랙핑크: 힙&럭셔리",
    description: "BLACKPINK, YG, Luxury, Trend",
    imageUrl: undefined,
    placeholderGradient: "from-violet-500 to-purple-600",
  },
  {
    id: "KPOP_03",
    title: "세븐틴&스키즈: 퍼포먼스 에너지",
    description: "SEVENTEEN, Stray Kids, JYP, Performance",
    imageUrl: undefined,
    placeholderGradient: "from-fuchsia-500 to-rose-600",
  },
  {
    id: "KPOP_04",
    title: "뉴진스&아이브: 하이틴 서울",
    description: "NewJeans, IVE, Y2K, Seongsu, Hannam",
    imageUrl: undefined,
    placeholderGradient: "from-indigo-500 to-violet-600",
  },
  {
    id: "KPOP_05",
    title: "SM: 광야 익스프레스",
    description: "SM, aespa, NCT, Kwangya, Seongsu",
    imageUrl: undefined,
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "KPOP_06",
    title: "아이돌 직접 체험하기",
    description: "Experience, Dance, Recording, Idol-life",
    imageUrl: undefined,
    placeholderGradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "KPOP_07",
    title: "홍대: 팬덤 문화의 중심",
    description: "Hongdae, Busking, Album, Fans",
    imageUrl: undefined,
    placeholderGradient: "from-sky-500 to-blue-600",
  },
  {
    id: "KPOP_08",
    title: "K-OST & 감성 힐링 서울",
    description: "IU, OST, Healing, Retro, Seoul",
    imageUrl: undefined,
    placeholderGradient: "from-amber-600 to-rose-600",
  },
];

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

const K_DRAMA_EXAMPLE_ITEMS: ContentRowItem[] = [
  {
    id: "KDRAMA_01",
    title: "도깨비 촬영지 투어",
    description: "인천·서울 주요 촬영 포인트를 따라가는 감성 코스",
    imageUrl: undefined,
    placeholderGradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "KDRAMA_02",
    title: "이태원 클래스 거리",
    description: "이태원 주요 거리와 분위기 좋은 루프탑 카페 코스",
    imageUrl: undefined,
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "KDRAMA_03",
    title: "남산·북촌 드라마 코스",
    description: "남산타워, 북촌 한옥길 중심의 클래식 촬영지 투어",
    imageUrl: undefined,
    placeholderGradient: "from-sky-500 to-blue-600",
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
  const [cardItems, setCardItems] = React.useState<ContentRowItem[]>(K_CONTENT_PACKAGE_ITEMS);

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
        K_CONTENT_PACKAGE_ITEMS.map(async (item) => {
          const images = await fetchPackageImages(item.id);
          return {
            ...item,
            imageUrl: pickRandomImage(images) ?? K_CONTENT_PLACEHOLDER_IMAGE,
          };
        })
      );
      setCardItems(nextItems);
    };
    run();
  }, []);

  const handleCtaClick = () => {
    // Prototype: navigate to planner root or show toast
    router.push("/planner");
  };

  const handleCardClick = (item: ContentRowItem) => {
    if (item.id.startsWith("KPOP_")) {
      router.push(`/planner/k-content/${item.id}`);
      return;
    }
    // 나머지 카테고리는 현재 예시 단계
    alert("해당 카테고리는 준비 중입니다.");
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
              items={K_DRAMA_EXAMPLE_ITEMS}
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
