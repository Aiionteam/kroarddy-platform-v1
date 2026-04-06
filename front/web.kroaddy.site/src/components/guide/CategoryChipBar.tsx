"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Coffee,
  Landmark,
  LayoutGrid,
  Mountain,
  Palette,
  PartyPopper,
  TreePine,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type GuideCategoryId =
  | "all"
  | "festival"
  | "activity"
  | "historic"
  | "culture"
  | "nature"
  | "restaurant"
  | "cafe";

export const GUIDE_CATEGORIES: {
  id: GuideCategoryId;
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "festival", label: "행사" },
  { id: "activity", label: "K-액티비티" },
  { id: "historic", label: "역사/유적" },
  { id: "culture", label: "로컬문화" },
  { id: "nature", label: "자연/힐링" },
  { id: "restaurant", label: "맛집" },
  { id: "cafe", label: "카페" },
];

const CATEGORY_ICONS: Record<GuideCategoryId, LucideIcon> = {
  all: LayoutGrid,
  festival: PartyPopper,
  activity: Mountain,
  historic: Landmark,
  culture: Palette,
  nature: TreePine,
  restaurant: UtensilsCrossed,
  cafe: Coffee,
};

export interface CategoryChipBarProps {
  activeCategory: GuideCategoryId;
  onSelect: (id: GuideCategoryId) => void;
  /** 가이드/행사 로딩 중에는 탭 비활성화 */
  disabled?: boolean;
}

/**
 * 상단 플로팅 카테고리 — 글래스 칩 + 탭 피드백
 */
export function CategoryChipBar({
  activeCategory,
  onSelect,
  disabled = false,
}: CategoryChipBarProps) {
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 pt-2 md:pt-3">
      <div className="pointer-events-auto px-4 md:px-6">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="가이드 카테고리"
        >
          {GUIDE_CATEGORIES.map((c) => {
            const active = activeCategory === c.id;
            const Icon = CATEGORY_ICONS[c.id];
            return (
              <motion.button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={disabled}
                onClick={() => onSelect(c.id)}
                whileTap={disabled ? undefined : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
                className={[
                  "group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-sm backdrop-blur-md transition-colors",
                  active
                    ? "border-sky-100 bg-sky-50 font-bold text-sky-600 shadow-sm"
                    : "border-gray-100 bg-white/85 font-medium text-slate-600 hover:bg-sky-50/60 hover:text-slate-800",
                  disabled ? "cursor-not-allowed opacity-45" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-sky-600" : "text-slate-400 group-hover:text-sky-600"}`}
                  aria-hidden
                  strokeWidth={2}
                />
                {c.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 행사 외 칩 클릭 시 입력창에 넣을 검색/질문 프롬프트 */
export const CATEGORY_CHAT_PROMPTS: Partial<Record<GuideCategoryId, string>> = {
  all: "",
  activity: "K-액티비티로 즐길 만한 여행지를 추천해줘",
  historic: "한국의 역사·유적 명소를 추천해줘",
  culture: "로컬 문화를 체험할 수 있는 곳을 추천해줘",
  nature: "자연과 힐링을 즐길 수 있는 여행지를 추천해줘",
  restaurant: "지역 맛집을 추천해줘",
  cafe: "분위기 좋은 카페를 추천해줘",
};
