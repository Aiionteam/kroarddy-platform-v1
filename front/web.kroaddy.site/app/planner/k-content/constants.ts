import type { ContentRowItem } from "@/components/k-content/ContentRow";
import {
  K_CONTENT_KF_CAFE_FALLBACK_IMAGE,
  K_CONTENT_KF_CONVENIENCE_FALLBACK_IMAGE,
} from "@/constants/k-content-images";

export const K_CONTENT_KFOOD_FALLBACK_ITEMS: ContentRowItem[] = [
  {
    id: "KF_MARKET",
    title: "전국 전통시장 먹거리 탐방",
    description: "팔도 강산의 정겨운 맛과 활기가 모인 시장 정복 투어",
    imageUrl: "/k_content/k-food/KF_MARKET/market_main.jpg",
    placeholderGradient: "from-amber-500 to-orange-600",
    href: "/planner/k-content/KF_MARKET",
  },
  {
    id: "KF_CAFE",
    title: "K-디저트 & 카페 감성 투어",
    description: "나의 취향에 딱 맞는 카페와 편집샵을 잇는 감성 연결 코스",
    imageUrl: K_CONTENT_KF_CAFE_FALLBACK_IMAGE,
    placeholderGradient: "from-rose-500 to-fuchsia-600",
    href: "/planner/k-content/KF_CAFE",
  },
  {
    id: "KF_CONVENIENCE",
    title: "K-편의점 꿀조합 챌린지",
    description:
      "품절 대란 신상부터 나만의 시크릿 레시피까지",
    imageUrl: K_CONTENT_KF_CONVENIENCE_FALLBACK_IMAGE,
    placeholderGradient: "from-lime-400 via-emerald-500 to-violet-600",
    href: "/planner/k-content/KF_CONVENIENCE",
  },
];

export const K_FOOD_MARKET_LIST: Record<
  "SEOUL" | "GANGWON" | "JEONLA" | "GYEONGSANG" | "JEJU",
  { name: string; description: string }[]
> = {
  SEOUL: [
    { name: "광장시장", description: "육회와 빈대떡의 성지" },
    { name: "망원시장", description: "MZ세대가 사랑하는 트렌디한 시장" },
    { name: "통인시장", description: "엽전 도시락 체험이 가능한 곳" },
  ],
  GANGWON: [
    { name: "영월 중앙시장", description: "메밀전병과 올챙이국수의 고향" },
    { name: "속초 관광수산시장", description: "닭강정과 해산물 먹거리 천국" },
  ],
  JEONLA: [
    { name: "전주 남부시장", description: "피순대와 콩나물국밥의 본고장" },
    { name: "광주 1913송정역시장", description: "뉴트로 감성이 가득한 시장" },
  ],
  GYEONGSANG: [
    { name: "부산 국제시장", description: "영화 속 배경과 비빔당면의 추억" },
    { name: "대구 서문시장", description: "전국 3대 시장의 엄청난 규모와 맛" },
  ],
  JEJU: [
    { name: "제주 동문시장", description: "오메기떡과 흑돼지 강정이 있는 섬의 맛" },
  ],
};

