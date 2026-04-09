/**
 * Weather API – planer.kroaddy.site → /api/v1/weather (게이트웨이 경유)
 * OpenWeatherMap 5-day 예보만 지원 (오늘 ~ +5일 이내만 available: true)
 *
 * lat/lon 을 직접 넘기면 geocoding 없이 즉시 좌표 기반 예보 반환.
 */
import i18n from "@/lib/i18n/config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** 3시간 슬롯 단위 날씨 (KST 시각 기준, key: "09"|"12"|"15"|"18"|"21") */
export interface WeatherSlot {
  temp: number;
  condition: string;
  pop: number;
}

export interface WeatherDay {
  temp_min: number;
  temp_max: number;
  condition: string;
  pop: number;
  advice: string;
  time_slots?: Record<string, WeatherSlot>; // "09" | "12" | "15" | "18" | "21"
}

export interface WeatherResult {
  available: boolean;
  reason?: string;
  dates: Record<string, WeatherDay>;
}

/** time 문자열 → time_slots 키 ("09" | "12" | "15" | "18" | "21").
 * 한국어·영어 모두 지원 (기존 DB 데이터 호환). */
const TIME_TO_SLOT: Record<string, string> = {
  오전: "09",   morning:   "09",
  점심: "12",   lunch:     "12",
  오후: "15",   afternoon: "15",
  저녁: "18",   evening:   "18",
  밤:  "21",   night:     "21",
};

function parseHourFromLabel(label: string): number | null {
  const raw = String(label || "").trim();
  if (!raw) return null;

  // Accept "10", "10:00", "10:30"
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    const h = Number(m[1]);
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
  }

  // Accept Korean time labels
  const slot = TIME_TO_SLOT[raw];
  if (slot) return parseInt(slot, 10);

  return null;
}

/**
 * 일정 time 레이블(오전/점심/오후/저녁)에 해당하는 슬롯 날씨를 반환.
 * 정확한 키가 없을 때는 가장 가까운 슬롯으로 fallback.
 */
export function getSlotWeather(
  day: WeatherDay,
  timeLabel: string,
): WeatherSlot | null {
  const slots = day.time_slots;
  if (!slots || Object.keys(slots).length === 0) return null;

  const raw = String(timeLabel || "").trim();
  const targetKey = TIME_TO_SLOT[raw];
  if (targetKey && slots[targetKey]) return slots[targetKey];

  // fallback: 가장 가까운 슬롯
  const targetHour = parseHourFromLabel(raw) ?? 12;
  const closest = Object.entries(slots).sort(
    (a, b) => Math.abs(parseInt(a[0]) - targetHour) - Math.abs(parseInt(b[0]) - targetHour),
  )[0];
  return closest ? closest[1] : null;
}

export async function fetchWeather(
  startDate: string,
  endDate: string,
  latOrLocation: number | string,
  lon?: number,
): Promise<WeatherResult> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });

  if (typeof latOrLocation === "number" && lon !== undefined) {
    params.set("lat", latOrLocation.toString());
    params.set("lon", lon.toString());
    params.set("location", "coords"); // 구 백엔드 호환 (required 파라미터, lat/lon 있으면 무시됨)
  } else if (typeof latOrLocation === "string" && latOrLocation) {
    params.set("location", latOrLocation);
  } else {
    return {
      available: false,
      reason: i18n.t("weather.reason.no_location", { defaultValue: "위치 정보 없음" }),
      dates: {},
    };
  }

  const res = await fetch(`${API_BASE}/api/v1/weather?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    console.warn(`[Weather] API ${res.status} (기본값 반환) – params: ${params}`);
    return {
      available: false,
      reason: `http_${res.status}`,
      dates: {},
    };
  }
  let data: WeatherResult;
  try {
    data = (await res.json()) as WeatherResult;
  } catch {
    console.warn("[Weather] JSON 파싱 실패 – 기본값 반환");
    return { available: false, reason: "parse_error", dates: {} };
  }
  if (!data.available) {
    console.info(`[Weather] unavailable – ${data.reason ?? "no reason"}`);
  }
  return data;
}

/** 날씨 상태 → 이모지 */
export function weatherEmoji(condition: string): string {
  const c = String(condition || "");
  const cl = c.toLowerCase();

  // Korean (common)
  if (c.includes("천둥")) return "⛈️";
  if (c.includes("눈")) return "❄️";
  if (c.includes("비")) return "🌧️";
  if (c.includes("이슬")) return "🌦️";
  if (c.includes("구름")) return "⛅";
  if (c.includes("안개") || c.includes("연무") || c.includes("황사")) return "🌫️";
  if (c.includes("맑")) return "☀️";

  // English (OpenWeatherMap-style)
  if (cl.includes("thunder")) return "⛈️";
  if (cl.includes("snow")) return "❄️";
  if (cl.includes("rain")) return "🌧️";
  if (cl.includes("drizzle")) return "🌦️";
  if (cl.includes("cloud")) return "⛅";
  if (cl.includes("fog") || cl.includes("mist") || cl.includes("haze") || cl.includes("sand") || cl.includes("dust")) return "🌫️";
  if (cl.includes("clear")) return "☀️";
  return "🌤️";
}

/** 오늘~+5일 이내 날짜인지 확인 (5일 예보 범위, 과거 날짜 제외) */
export function isWithinForecastRange(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 5;
}

/**
 * 가이드 컨텍스트용 — 좌표만으로 현재 예보 요약 (날짜 파라미터 없이 백엔드 기본 동작)
 */
export async function fetchWeatherAtCoords(lat: number, lon: number): Promise<unknown | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/weather?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      console.warn(`[Weather] fetchWeatherAtCoords ${res.status} – 좌표 컨텍스트 생략`);
      return null;
    }
    try {
      return await res.json();
    } catch {
      console.warn("[Weather] fetchWeatherAtCoords JSON 파싱 실패");
      return null;
    }
  } catch (e) {
    console.warn("[Weather] fetchWeatherAtCoords 네트워크 오류", e);
    return null;
  }
}
