import i18n from "@/lib/i18n/config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  published: string;
  thumbnail: string | null;
}

export interface NewsResponse {
  category: string;
  category_label: string;
  total: number;
  items: NewsItem[];
}

export interface NewsCategory {
  id: string;
  label: string;
}

export async function fetchNews(
  category: string = "entertainment",
  limit: number = 20
): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/news?category=${category}&limit=${limit}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!res.ok) throw new Error(`${i18n.t("news.api.error", { defaultValue: "뉴스 API 오류" })}: ${res.status}`);
  return res.json();
}

export async function fetchNewsCategories(): Promise<NewsCategory[]> {
  const res = await fetch(`${API_BASE}/api/v1/news/categories`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.categories ?? [];
}

export interface ProcessedNewsItem {
  id: number;
  link: string;
  title: string;
  summary: string;
  gpt_summary: string;     // GPT가 여행자용으로 재작성한 요약
  source: string;
  published: string;
  thumbnail: string | null;
  category: string;        // 공연/콘서트 | 드라마/영화 | K-pop/아이돌 | 축제/전시 | 장소/핫플 | 기타
  location: string;        // 지역명
  date_mentioned: string | null;
  relevance_score: number;
  is_top10: number;
  top10_rank: number | null;
}

export interface ProcessedNewsResponse {
  top10: ProcessedNewsItem[];
  rest: ProcessedNewsItem[];
  top10_count: number;
  rest_count: number;
}

export async function fetchProcessedNews(
  limitRest = 50
): Promise<ProcessedNewsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/news/processed?limit_rest=${limitRest}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!res.ok) throw new Error(`${i18n.t("news.api.error", { defaultValue: "뉴스 API 오류" })}: ${res.status}`);
  return res.json();
}

export function timeAgo(isoString: string): string {
  const publishedAt = new Date(isoString).getTime();
  if (!Number.isFinite(publishedAt)) return "";
  const diffSec = Math.floor((Date.now() - publishedAt) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.floor(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.floor(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.floor(diffHour / 24);
  return rtf.format(-diffDay, "day");
}
