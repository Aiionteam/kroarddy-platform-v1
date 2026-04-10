// Mirrors `front/web.kroaddy.site/app/planner/k-content/constants.ts` + `[packageId]/page.tsx` food helpers.

typedef KFoodRegionKey = String;

/// `K_FOOD_MARKET_LIST` — 시장 이름·설명 (기본 한국어, i18n은 키로 덮어씀)
const Map<KFoodRegionKey, List<({String name, String description})>> kFoodMarketList = {
  "SEOUL": [
    (name: "광장시장", description: "육회와 빈대떡의 성지"),
    (name: "망원시장", description: "MZ세대가 사랑하는 트렌디한 시장"),
    (name: "통인시장", description: "엽전 도시락 체험이 가능한 곳"),
  ],
  "GANGWON": [
    (name: "영월 중앙시장", description: "메밀전병과 올챙이국수의 고향"),
    (name: "속초 관광수산시장", description: "닭강정과 해산물 먹거리 천국"),
  ],
  "JEONLA": [
    (name: "전주 남부시장", description: "피순대와 콩나물국밥의 본고장"),
    (name: "광주 1913송정역시장", description: "뉴트로 감성이 가득한 시장"),
  ],
  "GYEONGSANG": [
    (name: "부산 국제시장", description: "영화 속 배경과 비빔당면의 추억"),
    (name: "대구 서문시장", description: "전국 3대 시장의 엄청난 규모와 맛"),
  ],
  "JEJU": [
    (name: "제주 동문시장", description: "오메기떡과 흑돼지 강정이 있는 섬의 맛"),
  ],
};

/// `CAFE_VIBES` — 웹 TS와 동일 한국어 + 표시용 영어
const List<({String id, String labelKo, String labelEn, String descriptionKo, String descriptionEn})> kCafeVibes = [
  (
    id: "industrial_raw",
    labelKo: "인더스트리얼/로우",
    labelEn: "Industrial / Raw",
    descriptionKo: "거친 콘크리트와 철제의 힙한 감성",
    descriptionEn: "Hip concrete and steel vibes",
  ),
  (
    id: "traditional_zen",
    labelKo: "전통/젠",
    labelEn: "Traditional / Zen",
    descriptionKo: "한옥과 나무가 주는 고요한 휴식",
    descriptionEn: "Quiet rest from hanok and wood",
  ),
  (
    id: "nature_botanical",
    labelKo: "자연/보타니컬",
    labelEn: "Nature / Botanical",
    descriptionKo: "초록 식물과 햇살이 가득한 공간",
    descriptionEn: "Greenery and sunlight-filled spaces",
  ),
  (
    id: "retro_newtro",
    labelKo: "레트로/뉴트로",
    labelEn: "Retro / Newtro",
    descriptionKo: "응답하라 감성, 빈티지한 골목 투어",
    descriptionEn: "Retro mood, vintage alley tour",
  ),
  (
    id: "modern_minimal",
    labelKo: "모던/미니멀",
    labelEn: "Modern / Minimal",
    descriptionKo: "세련된 무채색과 현대적인 조형미",
    descriptionEn: "Refined neutrals and modern lines",
  ),
];

const List<String> kConvenienceBrands = ["GS25", "CU", "SEVENELEVEN", "EMART24"];

/// `CONVENIENCE_RECIPE_VIBES`
const List<({String id, String labelKo, String labelEn, String descriptionKo, String descriptionEn})> kConvenienceRecipeVibes = [
  (id: "spicy_fire", labelKo: "화끈한 매운맛", labelEn: "Spicy fire", descriptionKo: "스트레스 날리는 매콤 챌린지", descriptionEn: "Spicy challenge to blow off steam"),
  (id: "sweet_salty", labelKo: "단짠의 정석", labelEn: "Sweet & salty", descriptionKo: "달콤함과 짭짤함의 밸런스", descriptionEn: "Balance of sweet and salty"),
  (id: "diet_healthy", labelKo: "편의점 다이어트", labelEn: "Diet-friendly", descriptionKo: "가볍고 든든한 헬시 조합", descriptionEn: "Light yet filling healthy combos"),
  (id: "night_snack", labelKo: "심야 야식", labelEn: "Late-night snack", descriptionKo: "늦은 밤 소확행 야식 레시피", descriptionEn: "Late-night comfort food recipes"),
  (id: "hangover", labelKo: "해장 꿀조합", labelEn: "Hangover cure", descriptionKo: "숙취 케어 특화 조합", descriptionEn: "Hangover recovery picks"),
  (id: "luxury_meal", labelKo: "가성비 정찬", labelEn: "Value feast", descriptionKo: "편의점 프리미엄 한 끼", descriptionEn: "Premium convenience-store meal"),
];

String inferCategoryFromPackageId(String? packageId) {
  if (packageId == null || packageId.isEmpty) return "KCONTENT";
  final ref = packageId.toUpperCase();
  if (ref.startsWith("KPOP_")) return "KPOP";
  if (ref == "KD_05" || ref == "KD_12") return "KMOVIE";
  if (ref.startsWith("KD_")) return "KDRAMA";
  if (ref.startsWith("KF_")) return "KFOOD";
  return "KCONTENT";
}

String categoryBadgeText(String? category) {
  final c = (category ?? "").toUpperCase();
  switch (c) {
    case "KPOP":
      return "K-POP";
    case "KDRAMA":
      return "K-DRAMA";
    case "KMOVIE":
      return "K-MOVIE";
    case "KFOOD":
      return "K-FOOD";
    default:
      return "K-CONTENT";
  }
}

/// `foodRegionTab === ALL` 일 때 웹과 같이 전 지역 시장을 펼침.
List<({KFoodRegionKey regionKey, String name, String description})> marketsForRegionTab(String tab) {
  if (tab == "ALL") {
    final out = <({KFoodRegionKey regionKey, String name, String description})>[];
    for (final e in kFoodMarketList.entries) {
      for (final m in e.value) {
        out.add((regionKey: e.key, name: m.name, description: m.description));
      }
    }
    return out;
  }
  final list = kFoodMarketList[tab];
  if (list == null) return [];
  return list.map((m) => (regionKey: tab, name: m.name, description: m.description)).toList();
}
