/** 네이버 Directions summary.duration(ms) → 「N시간 M분」 (0이면 빈 문자열) */
export function formatDurationMsToHoursMinutes(durationMs: number): string {
  if (!durationMs || durationMs <= 0) return "";
  const totalMin = Math.max(1, Math.round(durationMs / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}분`;
  if (m <= 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 백엔드가 네이버 summary.duration 을 ms 로 전달한다고 가정 */
export function formatCarRouteSummary(distanceM: number, durationMs: number): string {
  const dur = formatDurationMsToHoursMinutes(durationMs);
  const km = distanceM > 0 ? (distanceM / 1000).toFixed(1) : "0.0";
  if (!dur) return `🚗 자동차 약 ${km}km`;
  return `🚗 자동차 약 ${dur} (${km}km)`;
}

export function formatWon(n: number): string {
  if (!n || n <= 0) return "0원";
  return `${n.toLocaleString("ko-KR")}원`;
}
