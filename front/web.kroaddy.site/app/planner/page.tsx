"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import {
  REGION_GROUPS,
  METRO_CITIES,
  METRO_REGION_GROUP_IDS,
  ALL_DESTINATIONS,
  type Destination,
} from "./planner-data";
import Image from "next/image";
import { getDestinationImage } from "./planner-images";

// ── 모드 선택 옵션 ─────────────────────────────────────────────
const MODE_OPTIONS = [
  {
    id: "standard",
    label: "스탠다드",
    emoji: "🗺️",
    desc: "AI가 추천하는 여행 루트와 일정",
    available: true,
  },
  {
    id: "k-content",
    label: "K컨텐츠",
    emoji: "🎬",
    desc: "드라마·영화 촬영지 여행",
    available: false,
  },
  {
    id: "user-content",
    label: "유저 컨텐츠",
    emoji: "👥",
    desc: "여행자들이 만든 추천 코스",
    available: false,
  },
] as const;

// ── 여행지 카드 (Netflix 대형 가로 카드) ────────────────────────
function DestCard({ dest, onClick }: { dest: Destination; onClick: () => void }) {
  const imagePath = getDestinationImage(dest.slug);

  return (
    <button
      onClick={onClick}
      // 고정 너비로 가로 스크롤에서 균일하게 표시
      className="group relative shrink-0 w-80 cursor-pointer rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-xl hover:z-10"
      style={{ aspectRatio: "16/9" }}
    >
      {/* 이미지 슬롯 */}
      {imagePath ? (
        <Image
          src={imagePath}
          alt={dest.name}
          fill
          sizes="320px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
          <span className="text-6xl opacity-40 select-none group-hover:scale-110 transition-transform duration-300">
            {dest.emoji ?? "📍"}
          </span>
        </div>
      )}
      {/* 하단 그라디언트 + 이름 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-sm font-bold text-white drop-shadow leading-tight">
          {dest.name}
        </p>
        {dest.highlights && dest.highlights.length > 0 && (
          <p className="mt-0.5 text-[10px] text-white/70 truncate">
            {dest.highlights.slice(0, 2).join(" · ")}
          </p>
        )}
      </div>
      {/* 인기 배지 */}
      {dest.popular && (
        <span className="absolute top-2 left-2 rounded-sm bg-red-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white leading-none shadow">
          인기
        </span>
      )}
    </button>
  );
}

// ── 가로 스크롤 섹션 ──────────────────────────────────────────
function RegionRow({
  label,
  subLabel,
  destinations,
  onSelect,
}: {
  label: string;
  subLabel?: string;
  destinations: Destination[];
  onSelect: (d: Destination) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  if (destinations.length === 0) return null;

  return (
    <div className="mb-8">
      {/* 섹션 헤더 */}
      <div className="mb-3 flex items-baseline gap-2 px-6">
        <h3 className="text-base font-bold text-gray-800">{label}</h3>
        {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
      </div>
      {/* 스크롤 래퍼 */}
      <div className="relative group/row">
        {/* 왼쪽 버튼 */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-gray-100/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity rounded-l-none text-gray-600 hover:text-gray-900"
        >
          ‹
        </button>
        {/* 카드 리스트 */}
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto scroll-smooth px-6 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {destinations.map((d) => (
            <DestCard key={d.slug} dest={d} onClick={() => onSelect(d)} />
          ))}
        </div>
        {/* 오른쪽 버튼 */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-gray-100/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity rounded-r-none text-gray-600 hover:text-gray-900"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ── 모드 선택 화면 ─────────────────────────────────────────────
function ModeSelect({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gray-100 px-8 py-12">
      <div className="mb-10 text-center">
        <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold text-transparent">
          여행 플래너
        </h2>
        <p className="mt-2 text-sm text-gray-500">원하는 여행 스타일을 선택해 주세요</p>
      </div>
      <div className="flex w-full max-w-lg flex-col gap-4">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => opt.available && onSelect(opt.id)}
            disabled={!opt.available}
            className={`flex items-center gap-5 rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-150 ${
              opt.available
                ? "border-gray-200 hover:border-purple-300 hover:shadow-md cursor-pointer"
                : "border-gray-100 opacity-50 cursor-not-allowed"
            }`}
          >
            <span className="text-4xl leading-none">{opt.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{opt.label}</span>
                {!opt.available && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                    준비 중
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-400">{opt.desc}</p>
            </div>
            {opt.available && (
              <span className="shrink-0 text-gray-300 text-lg">→</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 스탠다드 여행지 선택 화면 ──────────────────────────────────
function StandardView({
  onNavigate,
  onBack,
}: {
  onNavigate: (d: Destination) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const metroRegionGroups = useMemo(
    () => REGION_GROUPS.filter((group) => METRO_REGION_GROUP_IDS.includes(group.id as (typeof METRO_REGION_GROUP_IDS)[number])),
    []
  );
  const provinceRegionGroups = useMemo(
    () => REGION_GROUPS.filter((group) => !METRO_REGION_GROUP_IDS.includes(group.id as (typeof METRO_REGION_GROUP_IDS)[number])),
    []
  );

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return ALL_DESTINATIONS.filter(
      (d) => d.name.includes(q) || d.highlights?.some((h) => h.includes(q))
    );
  }, [query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="text-base font-bold text-gray-800">여행지 선택</h2>
          <p className="text-[11px] text-gray-400">여행지를 선택하면 AI가 맞춤 루트를 추천해드려요</p>
        </div>
        <div className="ml-auto relative w-64">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="도시·명소 검색 (예: 강릉, 한옥마을)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-2.5 flex items-center text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto pt-6">
        {searchResults !== null ? (
          <div className="px-6">
            <p className="mb-4 text-xs text-gray-400">
              &ldquo;{query}&rdquo; 검색 결과 {searchResults.length}곳
            </p>
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center text-gray-400">
                <span className="text-4xl mb-2">🗺️</span>
                <p className="text-sm">검색 결과가 없습니다</p>
                <button onClick={() => setQuery("")} className="mt-2 text-xs text-purple-500 hover:underline">
                  초기화
                </button>
              </div>
            ) : (
              // 검색 결과는 그리드로
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                {searchResults.map((d) => (
                  <DestCard key={d.slug} dest={d} onClick={() => onNavigate(d)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 px-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">광역시·특별시 바로가기</h3>
                <p className="mt-1 text-xs text-gray-500">
                  많이 찾는 대도시는 바로 선택하고, 아래에서 상세 지역도 둘러보세요.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {METRO_CITIES.map((city) => (
                  <button
                    key={city.slug}
                    onClick={() => onNavigate(city)}
                    className="rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700"
                  >
                    <span className="mr-1.5">{city.emoji ?? "📍"}</span>
                    {city.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 px-6">
              <h3 className="text-lg font-bold text-gray-900">광역시 상세 지역</h3>
              <p className="mt-1 text-xs text-gray-500">
                서울·부산·대구·울산처럼 도시 단위로 여행하는 지역은 세부 권역으로 나눠서 보여드려요.
              </p>
            </div>
            {metroRegionGroups.map((group) => (
              <RegionRow
                key={group.id}
                label={group.label}
                subLabel={group.subLabel}
                destinations={group.subSections.flatMap((s) => s.destinations)}
                onSelect={onNavigate}
              />
            ))}

            <div className="mb-3 mt-10 px-6">
              <h3 className="text-lg font-bold text-gray-900">도 단위 지역</h3>
              <p className="mt-1 text-xs text-gray-500">
                경기도, 충청, 전라, 경상, 강원, 제주처럼 권역 중심으로 여행지를 비교해보세요.
              </p>
            </div>
            {provinceRegionGroups.map((group) => (
              <RegionRow
                key={group.id}
                label={group.label}
                subLabel={group.subLabel}
                destinations={group.subSections.flatMap((s) => s.destinations)}
                onSelect={onNavigate}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function PlannerPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const [view, setView] = useState<"mode" | "standard">("mode");

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const navigate = (dest: Destination) => router.push(`/planner/${dest.slug}`);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === "mode" ? (
          <ModeSelect onSelect={(id) => id === "standard" && setView("standard")} />
        ) : (
          <StandardView onNavigate={navigate} onBack={() => setView("mode")} />
        )}
      </main>
    </div>
  );
}
