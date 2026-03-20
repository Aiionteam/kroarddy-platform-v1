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
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`뉴스 API 오류: ${res.status}`);
  return res.json();
}

export async function fetchNewsCategories(): Promise<NewsCategory[]> {
  const res = await fetch(`${API_BASE}/api/v1/news/categories`, {
    cache: "no-store",
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
  source: string;
  published: string;
  thumbnail: string | null;
  category: string;        // 공연/이벤트 | 전시/문화 | 장소/스팟 | 교통/생활 | 기타
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

export async function fetchProcessedNews(limitRest = 50): Promise<ProcessedNewsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/news/processed?limit_rest=${limitRest}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`뉴스 API 오류: ${res.status}`);
  return res.json();
}

export function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}
