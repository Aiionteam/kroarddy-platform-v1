"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import { HeroBanner } from "@/components/k-content/HeroBanner";
import { ContentRow } from "@/components/k-content/ContentRow";
import type { ContentRowItem } from "@/components/k-content/ContentRow";
import { ItineraryPreview } from "@/components/k-content/ItineraryPreview";
import type { ItineraryDay } from "@/components/k-content/ItineraryPreview";

// ─── Mock data: K-Content theme rows ───────────────────────────────────────

const KPOP_TOUR_ITEMS: ContentRowItem[] = [
  {
    id: "kpop-hybe",
    title: "HYBE Building",
    description: "HYBE Insight museum and label headquarters. See K-Pop history and merch.",
    imageUrl: undefined,
    placeholderGradient: "from-rose-500 to-pink-600",
  },
  {
    id: "kpop-sm",
    title: "SM Entertainment",
    description: "SM Town and SM Entertainment building. K-Pop landmark in Seoul.",
    imageUrl: undefined,
    placeholderGradient: "from-violet-500 to-purple-600",
  },
  {
    id: "kpop-hongdae",
    title: "Hongdae K-Pop Street",
    description: "Street performances, K-Pop stores, and idol busking culture.",
    imageUrl: undefined,
    placeholderGradient: "from-fuchsia-500 to-rose-600",
  },
  {
    id: "kpop-store",
    title: "K-Pop Store",
    description: "Official albums, merch, and photo cards. Must-visit for fans.",
    imageUrl: undefined,
    placeholderGradient: "from-indigo-500 to-violet-600",
  },
];

const KDRAMA_TOUR_ITEMS: ContentRowItem[] = [
  {
    id: "drama-goblin",
    title: "Goblin Filming Location",
    description: "Famous drama shooting spots. Quebec-style streets and seaside views.",
    imageUrl: undefined,
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "drama-itaewon",
    title: "Itaewon Class Street",
    description: "DanBam and the streets that brought the drama to life.",
    imageUrl: undefined,
    placeholderGradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "drama-namsan",
    title: "Namsan Tower",
    description: "Locks of love and panoramic Seoul. Featured in countless dramas.",
    imageUrl: undefined,
    placeholderGradient: "from-sky-500 to-blue-600",
  },
  {
    id: "drama-bukchon",
    title: "Bukchon Hanok Village",
    description: "Traditional hanok alleys. Classic drama backdrop.",
    imageUrl: undefined,
    placeholderGradient: "from-amber-600 to-rose-600",
  },
];

const KFOOD_TOUR_ITEMS: ContentRowItem[] = [
  {
    id: "food-gwangjang",
    title: "Gwangjang Market",
    description: "Bindaetteok, mayak gimbap, and authentic Korean street food.",
    imageUrl: undefined,
    placeholderGradient: "from-orange-500 to-amber-600",
  },
  {
    id: "food-myeongdong",
    title: "Myeongdong Street Food",
    description: "Tteokbokki, odeng, and sweet treats. Night market vibes.",
    imageUrl: undefined,
    placeholderGradient: "from-red-500 to-orange-600",
  },
  {
    id: "food-bbq",
    title: "Korean BBQ",
    description: "Samgyeopsal and galbi. Grill at your table experience.",
    imageUrl: undefined,
    placeholderGradient: "from-rose-600 to-red-600",
  },
  {
    id: "food-convenience",
    title: "Convenience Store Food Combo",
    description: "Triangle kimbap, ramyeon, and soju. Late-night Korean style.",
    imageUrl: undefined,
    placeholderGradient: "from-lime-500 to-green-600",
  },
];

const KBEAUTY_TOUR_ITEMS: ContentRowItem[] = [
  {
    id: "beauty-olive",
    title: "Olive Young",
    description: "K-Beauty flagship. Skincare, makeup, and trending products.",
    imageUrl: undefined,
    placeholderGradient: "from-pink-500 to-rose-600",
  },
  {
    id: "beauty-myeongdong",
    title: "Myeongdong Beauty Street",
    description: "Density of beauty stores and brand flagship shops.",
    imageUrl: undefined,
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "beauty-store",
    title: "K-Beauty Store",
    description: "Curated K-Beauty. Sheet masks, serums, and cushion compacts.",
    imageUrl: undefined,
    placeholderGradient: "from-violet-500 to-purple-600",
  },
  {
    id: "beauty-experience",
    title: "Skincare Experience Shop",
    description: "Facials, treatments, and personalized skincare consultations.",
    imageUrl: undefined,
    placeholderGradient: "from-rose-400 to-pink-500",
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function KContentPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const handleCtaClick = () => {
    // Prototype: navigate to planner root or show toast
    router.push("/planner");
  };

  const handleCardClick = (item: ContentRowItem) => {
    // Prototype: could open modal or detail page
    console.info("K-Content card clicked:", item.title);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
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
          <div className="px-6 pt-6 pb-4">
            <HeroBanner
              title="K-Content Travel"
              subtitle="Explore Korea through K-Pop, Drama, Food and Beauty"
              ctaLabel="Generate AI Route"
              onCtaClick={handleCtaClick}
            />
          </div>

          {/* Content rows: same tone as Standard mode */}
          <div className="bg-gray-100 px-0 py-6">
            <ContentRow
              title="KPOP TOUR"
              items={KPOP_TOUR_ITEMS}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="KDRAMA TOUR"
              items={KDRAMA_TOUR_ITEMS}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="KFOOD TOUR"
              items={KFOOD_TOUR_ITEMS}
              onCardClick={handleCardClick}
            />
            <ContentRow
              title="KBEAUTY TOUR"
              items={KBEAUTY_TOUR_ITEMS}
              onCardClick={handleCardClick}
            />
          </div>

          {/* Itinerary preview */}
          <div className="px-6 py-8">
            <ItineraryPreview
              title="K-POP Fan Tour in Seoul"
              days={SAMPLE_ITINERARY_DAYS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
