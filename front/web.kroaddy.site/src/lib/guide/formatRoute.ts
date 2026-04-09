import type { TFunction } from "i18next";

/** 네이버 Directions summary.duration(ms) — 로케일별 표기 */
export function formatDurationMsToHoursMinutes(durationMs: number, t: TFunction): string {
  if (!durationMs || durationMs <= 0) return "";
  const totalMin = Math.max(1, Math.round(durationMs / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return t("guide.route.minutes", { m, defaultValue: `${m} min` });
  if (m <= 0) return t("guide.route.hours", { h, defaultValue: `${h} hr` });
  return t("guide.route.hours_minutes", { h, m, defaultValue: `${h}h ${m}m` });
}

/** 백엔드가 네이버 summary.duration 을 ms 로 전달한다고 가정 */
export function formatCarRouteSummary(distanceM: number, durationMs: number, t: TFunction): string {
  const dur = formatDurationMsToHoursMinutes(durationMs, t);
  const km = distanceM > 0 ? (distanceM / 1000).toFixed(1) : "0.0";
  if (!dur) return t("guide.route.car_km_only", { km, defaultValue: `🚗 ~{{km}} km by car` });
  return t("guide.route.car_summary", { dur, km, defaultValue: `🚗 ~{{dur}} ({{km}} km)` });
}

export function formatWon(n: number, t: TFunction, locale?: string): string {
  if (!n || n <= 0) return t("guide.route.won_zero", { defaultValue: "₩0" });
  const amount = n.toLocaleString(locale || undefined);
  return t("guide.route.won", { amount, defaultValue: "₩{{amount}}" });
}
