"use client";

import { create } from "zustand";
import type { ProcessedNewsItem } from "@/lib/api/news";

/** 썸네일을 제외한 뉴스 아이템 (플래너 전달용) */
export type SlimNewsItem = Omit<ProcessedNewsItem, "thumbnail">;

interface NewsState {
  newsTop10: SlimNewsItem[];
  setNewsTop10: (items: SlimNewsItem[]) => void;
  clearNews: () => void;
}

export const useNewsStore = create<NewsState>((set) => ({
  newsTop10: [],
  setNewsTop10: (newsTop10) => set({ newsTop10 }),
  clearNews: () => set({ newsTop10: [] }),
}));
