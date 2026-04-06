/** 백엔드 places 항목의 lat/lng (문자·null 혼용) → 숫자 좌표 */
export function parsePlaceLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = typeof lat === "number" && !Number.isNaN(lat) ? lat : parseFloat(String(lat ?? "").trim());
  const ln = typeof lng === "number" && !Number.isNaN(lng) ? lng : parseFloat(String(lng ?? "").trim());
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}
