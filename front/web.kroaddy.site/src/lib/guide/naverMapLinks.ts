/**
 * 네이버 지도 앱 딥링크 + 웹 폴백 (좌표·이름 기준)
 * @see https://www.ncloud.com/support/faq (네이버 지도 URL 스킴 변동 가능)
 */

export function buildNaverMapPlaceAppUrl(lat: number, lng: number, placeName: string): string {
  const name = placeName.trim() || "장소";
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    name,
    appname: "kroaddy.guide",
  });
  return `nmap://place?${params.toString()}`;
}

/** 앱 미설치·데스크톱용 — 검색 결과로 연결 */
export function buildNaverMapWebSearchUrl(placeName: string, address?: string): string {
  const q = [placeName.trim(), address?.trim()].filter(Boolean).join(" ") || "장소";
  return `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
}

export function openNaverMapPlace(lat: number, lng: number, placeName: string, address?: string): void {
  const appUrl = buildNaverMapPlaceAppUrl(lat, lng, placeName);
  const webUrl = buildNaverMapWebSearchUrl(placeName, address);

  if (typeof window === "undefined") return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = appUrl;
    return;
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
}
