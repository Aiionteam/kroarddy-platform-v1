/** PLACES_JSON / 마커 — 구조화 추천 사유 */
export interface GuidePlaceRecommendationPoint {
  icon: string;
  text: string;
}

/** POST /guide/ask 응답 (Guide 서비스 AskResponse) */
export interface GuidePlaceMarker {
  name: string;
  lat: number | null;
  lng: number | null;
  address: string;
  /** 한 줄 요약(20자 내외) */
  summary?: string;
  /** 특징 3개 */
  points?: GuidePlaceRecommendationPoint[];
  /** 꿀팁 한 줄 */
  tip?: string;
  description: string;
  category: string;
  /** 관광 명소 포토 명소 한 줄; 없으면 null */
  photo_spot?: string | null;
  /** 입장료·식사비 등(무료면 "무료") */
  estimated_cost?: string;
  /** 관람·체류 예상 시간 */
  duration?: string;
  /** AI 추출 핵심 키워드(해시 없이, 최대 3) */
  keywords?: string[];
  /** 선택: 장소 대표 이미지 URL */
  image_url?: string | null;
}

export interface GuideDirectionsRequestBody {
  start_lat: number;
  start_lng: number;
  goal_lat: number;
  goal_lng: number;
}

/** Directions 5 summary.bbox — [[min_lng, min_lat], [max_lng, max_lat]] */
export type GuideDirectionsBbox = [[number, number], [number, number]];

export interface GuideDirectionsResponse {
  ok: boolean;
  path: Array<{ lat: number; lng: number }>;
  bbox?: GuideDirectionsBbox | null;
  distance_m: number;
  duration_ms: number;
  toll_fare: number;
  fuel_price: number;
  taxi_fare?: number;
  message?: string;
  naver_code?: number;
}

export interface GuideAskResponse {
  answer: string;
  source: string;
  places: GuidePlaceMarker[];
}

export interface GuideAskRequestBody {
  question: string;
  context?: Record<string, unknown>;
}

/** GET /api/v1/guide/place/details — 네이버 지역·이미지 검색 결합(camelCase) */
export interface GuidePlaceDetailsResponse {
  title: string;
  category: string;
  address: string;
  telephone: string;
  link: string;
  imageUrl: string | null;
  naverMatched: boolean;
}

/** GET /api/v1/place/nearby */
export interface GuideNearbyPlaceItem {
  name: string;
  category: string;
  address: string;
  imageUrl: string;
  lat: number;
  lng: number;
  distanceM: number;
}

export interface GuideNearbyPlacesResponse {
  items: GuideNearbyPlaceItem[];
}
