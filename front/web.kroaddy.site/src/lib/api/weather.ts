/**
 * Weather API – planer.kroaddy.site → /api/v1/weather (게이트웨이 경유)
 * OpenWeatherMap 5-day 예보만 지원 (오늘 ~ +5일 이내만 available: true)
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface WeatherDay {
  temp_min: number;
  temp_max: number;
  condition: string;  // "맑음" | "구름" | "비" | "이슬비" | "천둥번개" | "눈" | "안개" | "짙은안개" | "연무" | "황사"
  pop: number;        // 최대 강수확률 (%)
  advice: string;
}

export interface WeatherResult {
  available: boolean;
  reason?: string;
  dates: Record<string, WeatherDay>;
}

export async function fetchWeather(
  location: string,
  startDate: string,
  endDate: string,
): Promise<WeatherResult> {
  const params = new URLSearchParams({ location, start_date: startDate, end_date: endDate });
  const res = await fetch(`${API_BASE}/api/v1/weather?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  return res.json();
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
