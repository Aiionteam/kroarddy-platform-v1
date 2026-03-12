/**
 * Planner 페이지용 sessionStorage 캐시 유틸리티
 *
 * - 루트(routes):  30분 TTL
 * - 일정(schedule): 60분 TTL
 * - 탭을 닫으면 자동 만료 (sessionStorage 특성)
 */

const PREFIX = "planner:";
const ROUTES_TTL_MS   = 30 * 60 * 1000; // 30분
const SCHEDULE_TTL_MS = 60 * 60 * 1000; // 60분

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** djb2 해시 – 짧은 키 생성용 */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage 용량 초과 시 무시
  }
}

// ── 루트 캐시 ──────────────────────────────────────────────

function routesKey(
  location: string,
  startDate: string,
  endDate: string,
  existingRoutes: string[],
): string {
  const sorted = [...existingRoutes].sort().join(",");
  const eh = sorted ? shortHash(sorted) : "0";
  return `${PREFIX}routes:${location}:${startDate}:${endDate}:${eh}`;
}

export function readRoutes<T>(
  location: string, startDate: string, endDate: string, existingRoutes: string[],
): T | null {
  return read<T>(routesKey(location, startDate, endDate, existingRoutes));
}

export function writeRoutes<T>(
  location: string, startDate: string, endDate: string, existingRoutes: string[], data: T,
): void {
  write(routesKey(location, startDate, endDate, existingRoutes), data, ROUTES_TTL_MS);
}

/** 저장 완료 후 호출 → 해당 location의 루트 캐시 전체 무효화 (existingRoutes 변경 반영) */
export function invalidateRoutes(location: string): void {
  try {
    const prefix = `${PREFIX}routes:${location}:`;
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ── 일정 캐시 ──────────────────────────────────────────────

function scheduleKey(
  location: string, routeName: string, startDate: string, endDate: string,
): string {
  return `${PREFIX}sched:${location}:${shortHash(routeName)}:${startDate}:${endDate}`;
}

export function readSchedule<T>(
  location: string, routeName: string, startDate: string, endDate: string,
): T | null {
  return read<T>(scheduleKey(location, routeName, startDate, endDate));
}

export function writeSchedule<T>(
  location: string, routeName: string, startDate: string, endDate: string, data: T,
): void {
  write(scheduleKey(location, routeName, startDate, endDate), data, SCHEDULE_TTL_MS);
}
