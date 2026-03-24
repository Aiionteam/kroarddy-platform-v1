const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function authHeaders(accessToken?: string): HeadersInit | undefined {
  const token = accessToken?.trim();
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

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
  limit: number = 20,
  accessToken?: string
): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/news?category=${category}&limit=${limit}`,
    { cache: "no-store", headers: authHeaders(accessToken) }
  );
  if (!res.ok) throw new Error(`뉴스 API 오류: ${res.status}`);
  return res.json();
}

export async function fetchNewsCategories(accessToken?: string): Promise<NewsCategory[]> {
  const res = await fetch(`${API_BASE}/api/v1/news/categories`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
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
  limitRest = 50,
  accessToken?: string
): Promise<ProcessedNewsResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/news/processed?limit_rest=${limitRest}`,
    { cache: "no-store", headers: authHeaders(accessToken) }
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
