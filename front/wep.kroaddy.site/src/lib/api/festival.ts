/**
 * Festival API - 전국문화축제표준데이터
 * Java 게이트웨이(8080) /api/v1/festivals 경유 → festival 서비스(8002) 프록시
 *
 * 캐시 전략:
 *   - 메모리(Map) + sessionStorage 2-tier
 *   - FRESH_TTL(5분): 신선 캐시, 요청 없이 즉시 반환
 *   - STALE_TTL(30분): stale 캐시, 즉시 표시 후 백그라운드 갱신
 *   - 페이지 새로고침 후에도 sessionStorage에서 즉시 복원
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface FestivalItem {
  fstvlNm: string;
  opar: string;
  fstvlStartDate: string; // YYYYMMDD
  fstvlEndDate: string;   // YYYYMMDD
  fstvlCo: string;
  mnnstNm: string;
  auspcInsttNm: string;
  suprtInsttNm: string;
  phoneNumber: string;
  homepageUrl: string;
  relateInfo: string;
  rdnmadr: string;
  lnmadr: string;
  latitude: string;
  longitude: string;
  referenceDate: string;
}

export interface FestivalsResponse {
  year: number;
  month: number;
  items: FestivalItem[];
  noData?: boolean;
  error?: string;
  resultCode?: string;
  _debug?: {
    raw_total: number;
    sample_start: string;
    sample_end: string;
    sample_keys: string[];
  };
}

/** YYYYMMDD → "YYYY년 M월 D일" */
export function formatFestivalDate(d: string): string {
  if (!d || d.length < 8) return d || "";
  const y = d.slice(0, 4);
  const m = String(parseInt(d.slice(4, 6), 10));
  const day = String(parseInt(d.slice(6, 8), 10));
  return `${y}년 ${m}월 ${day}일`;
}

// ── 캐시 설정 ─────────────────────────────────────────────────
const CACHE_FRESH_TTL_MS = 5 * 60 * 1000;   // 5분: 신선 캐시 (재요청 없음)
const CACHE_STALE_TTL_MS = 30 * 60 * 1000;  // 30분: stale 캐시 (즉시 표시 후 백그라운드 갱신)
const STORAGE_PREFIX = "festival:";

interface CacheEntry {
  data: FestivalsResponse;
  at: number;
}

// 1차 캐시: 메모리 (탭 내 즉시 접근)
const memCache = new Map<string, CacheEntry>();

// 2차 캐시: sessionStorage (새로고침 후에도 복원)
function storageLoad(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function storageSave(key: string, entry: CacheEntry): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // sessionStorage 용량 초과 등 — 무시
  }
}

function cacheKey(year: number, month: number): string {
  return `${year}-${month}`;
}

/** 신선 캐시 반환. 없으면 null. */
export function getCachedFestivals(year: number, month: number): FestivalsResponse | null {
  const key = cacheKey(year, month);
  const now = Date.now();

  // 1차: 메모리
  const mem = memCache.get(key);
  if (mem && now - mem.at < CACHE_FRESH_TTL_MS) return mem.data;

  // 2차: sessionStorage (새로고침 후 복원)
  const stored = storageLoad(key);
  if (stored) {
    memCache.set(key, stored); // 메모리에 복원
    if (now - stored.at < CACHE_FRESH_TTL_MS) return stored.data;
  }

  return null;
}

/** stale 포함 캐시 반환 (즉시 표시 + 백그라운드 갱신 패턴용). */
export function getStaleCachedFestivals(year: number, month: number): FestivalsResponse | null {
  const key = cacheKey(year, month);
  const now = Date.now();

  const mem = memCache.get(key);
  if (mem && now - mem.at < CACHE_STALE_TTL_MS) return mem.data;

  const stored = storageLoad(key);
  if (stored && now - stored.at < CACHE_STALE_TTL_MS) {
    memCache.set(key, stored);
    return stored.data;
  }

  return null;
}

function setCache(year: number, month: number, data: FestivalsResponse): void {
  const key = cacheKey(year, month);
  const entry: CacheEntry = { data, at: Date.now() };
  memCache.set(key, entry);
  storageSave(key, entry);
}

/** 실제 API 호출. 결과는 자동으로 캐시 저장. */
export async function fetchFestivals(
  year?: number,
  month?: number,
): Promise<FestivalsResponse> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const url = `${API_BASE}/api/v1/festivals?year=${y}&month=${m}`;

  const res = await fetch(url, {
    // 브라우저 캐시 활용 (no-store 제거) + Next.js 캐시 비활성 (SSR 아니라 CSR이므로 불필요)
    next: { revalidate: 300 }, // 5분
  } as RequestInit);

  if (!res.ok) throw new Error(`행사 API 오류: ${res.status}`);
  const data: FestivalsResponse = await res.json();
  setCache(y, m, data);
  return data;
}

/** 캐시만 채우기 (UI 업데이트 없이 프리페치). */
export function prefetchFestivals(year: number, month: number): void {
  // 신선 캐시가 이미 있으면 스킵
  if (getCachedFestivals(year, month)) return;
  fetchFestivals(year, month).catch(() => {});
}
