/**
 * Weather API – planer.kroaddy.site → /api/v1/weather (게이트웨이 경유)
 * OpenWeatherMap 5-day 예보만 지원 (오늘 ~ +5일 이내만 available: true)
 *
 * lat/lon 을 직접 넘기면 geocoding 없이 즉시 좌표 기반 예보 반환.
 */
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

/** time 문자열 → time_slots 키 ("09" | "12" | "15" | "18" | "21") */
const TIME_TO_SLOT: Record<string, string> = {
  오전: "09",
  점심: "12",
  오후: "15",
  저녁: "18",
  밤:   "21",
};

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

  const targetKey = TIME_TO_SLOT[timeLabel];
  if (targetKey && slots[targetKey]) return slots[targetKey];

  // fallback: 가장 가까운 슬롯
  const targetHour = targetKey ? parseInt(targetKey) : 12;
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
    return { available: false, reason: "위치 정보 없음", dates: {} };
  }

  const res = await fetch(`${API_BASE}/api/v1/weather?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    console.warn(`[Weather] API ${res.status} – params: ${params}`);
    throw new Error(`Weather API ${res.status}`);
  }
  const data: WeatherResult = await res.json();
  if (!data.available) {
    console.info(`[Weather] unavailable – ${data.reason ?? "no reason"}`);
  }
  return data;
}

/** 날씨 상태 → 이모지 */
export function weatherEmoji(condition: string): string {
  if (condition.includes("천둥")) return "⛈️";
  if (condition.includes("눈")) return "❄️";
  if (condition.includes("비")) return "🌧️";
  if (condition.includes("이슬")) return "🌦️";
  if (condition.includes("구름")) return "⛅";
  if (condition.includes("안개") || condition.includes("연무") || condition.includes("황사")) return "🌫️";
  if (condition.includes("맑")) return "☀️";
  return "🌤️";
}

/** 오늘~+5일 이내 날짜인지 확인 (5일 예보 범위) */
export function isWithinForecastRange(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= 5;
}
