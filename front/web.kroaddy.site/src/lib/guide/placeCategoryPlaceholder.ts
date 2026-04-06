/** 이미지 URL이 없을 때 카테고리별 플레이스홀더(그라데이션 + 라벨) */

export interface PlacePlaceholderVisual {
  /** Tailwind gradient 클래스 (from-… to-…) */
  gradientClass: string;
  shortLabel: string;
  emoji: string;
}

export function getPlacePlaceholderVisual(
  category: string | undefined,
  kind?: "place" | "festival"
): PlacePlaceholderVisual {
  const raw = `${category ?? ""} ${kind === "festival" ? "행사 축제" : ""}`.toLowerCase();

  if (kind === "festival" || /행사|축제|페스티벌|fest/.test(raw)) {
    return {
      gradientClass: "from-guide via-sky-700 to-cyan-700",
      shortLabel: "행사 · 축제",
      emoji: "🎪",
    };
  }
  if (/카페|coffee|cafe|디저트|베이커리/.test(raw)) {
    return {
      gradientClass: "from-amber-800 via-orange-700 to-amber-600",
      shortLabel: "카페",
      emoji: "☕",
    };
  }
  if (/맛집|음식|식당|레스토랑|한식|양식|술집|포차|주점/.test(raw) || /food|restaurant/.test(raw)) {
    return {
      gradientClass: "from-orange-600 to-red-600",
      shortLabel: "맛집",
      emoji: "🍽️",
    };
  }
  if (/역사|문화|박물관|미술관|유적|궁|전통|heritage|museum/.test(raw)) {
    return {
      gradientClass: "from-slate-700 via-amber-900 to-stone-800",
      shortLabel: "역사 · 문화",
      emoji: "🏛️",
    };
  }
  if (/자연|공원|산|바다|해변|호수|trail|park/.test(raw)) {
    return {
      gradientClass: "from-emerald-600 to-teal-700",
      shortLabel: "자연",
      emoji: "🌿",
    };
  }
  if (/쇼핑|마켓|거리|몰|shop/.test(raw)) {
    return {
      gradientClass: "from-guide to-slate-700",
      shortLabel: "쇼핑",
      emoji: "🛍️",
    };
  }

  return {
    gradientClass: "from-guide via-sky-800 to-slate-800",
    shortLabel: "추천 장소",
    emoji: "📍",
  };
}
