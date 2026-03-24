"use client";

import "@/lib/i18n/config";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLoginStore } from "@/store";
import { useNewsStore } from "@/store/slices/newsSlice";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { fetchUserProfile } from "@/lib/api/userProfile";
import {
  fetchProcessedNews,
  timeAgo,
  type ProcessedNewsItem,
  type ProcessedNewsResponse,
} from "@/lib/api/news";

const SKIP_KEY = "onboarding_skipped";

const CATEGORY_STYLE: Record<string, { bg: string; text: string; emoji: string }> = {
  "공연/콘서트": { bg: "bg-pink-100",   text: "text-pink-700",   emoji: "🎤" },
  "드라마/영화": { bg: "bg-purple-100", text: "text-purple-700", emoji: "🎬" },
  "K-pop/아이돌":{ bg: "bg-rose-100",   text: "text-rose-700",   emoji: "⭐" },
  "축제/전시":   { bg: "bg-amber-100",  text: "text-amber-700",  emoji: "🎨" },
  "장소/핫플":   { bg: "bg-green-100",  text: "text-green-700",  emoji: "📍" },
  "기타":        { bg: "bg-gray-100",   text: "text-gray-600",   emoji: "📰" },
};

function getCatStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? CATEGORY_STYLE["기타"]!;
}

// ── 바로가기 메뉴 ──────────────────────────────────────────
const SHORTCUTS = [
  { label: "여행 플래너",  emoji: "🗺️",  path: "/planner" },
  { label: "K-콘텐츠",    emoji: "🎵",  path: "/planner/k-content" },
  { label: "일정 관리",   emoji: "📅",  path: "/planner/schedule" },
  { label: "장소 추천",   emoji: "📍",  path: "/planner/standard" },
  { label: "유저 루트",   emoji: "👥",  path: "/planner/user-content" },
  { label: "단체 채팅",   emoji: "💬",  path: "/group-chat" },
];

// ── 인기 여행지 (slug은 planner-data.ts의 SLUG_TO_NAME 키와 일치해야 함) ──
const POPULAR_DESTINATIONS = [
  { name: "서울",   slug: "seoul",   emoji: "🏙️",  gradient: "from-indigo-400 to-purple-500" },
  { name: "부산",   slug: "busan",   emoji: "🌊",  gradient: "from-cyan-400 to-blue-500" },
  { name: "제주",   slug: "jeju",    emoji: "🌿",  gradient: "from-emerald-400 to-teal-500" },
  { name: "경주",   slug: "gyeongju",emoji: "🏯",  gradient: "from-amber-400 to-orange-500" },
  { name: "강릉",   slug: "gangneung",emoji: "🌅", gradient: "from-rose-400 to-pink-500" },
  { name: "전주",   slug: "jeonju",  emoji: "🎎",  gradient: "from-yellow-400 to-amber-500" },
];

// ── K-콘텐츠 테마 ─────────────────────────────────────────
const K_THEMES = [
  { label: "K-POP",    emoji: "🎤",  color: "bg-rose-50 border-rose-200 text-rose-600",   path: "/planner/k-content" },
  { label: "K-DRAMA",  emoji: "🎬",  color: "bg-purple-50 border-purple-200 text-purple-600", path: "/planner/k-content" },
  { label: "K-FOOD",   emoji: "🍜",  color: "bg-amber-50 border-amber-200 text-amber-600",  path: "/planner/k-content" },
  { label: "K-BEAUTY", emoji: "💄",  color: "bg-pink-50 border-pink-200 text-pink-600",    path: "/planner/k-content" },
];

export default function HomePage() {
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const { setNewsTop10 } = useNewsStore();
  const router = useRouter();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [showBanner, setShowBanner]         = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [data, setData]       = useState<ProcessedNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/"); return; }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !appUserId) return;
    const skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    fetchUserProfile(appUserId)
      .then((profile) => {
        if (!profile || !profile.is_complete) {
          if (skipped) setShowBanner(true);
          else router.replace("/profile/onboarding");
        }
      })
      .catch(() => {})
      .finally(() => setProfileChecked(true));
  }, [isAuthenticated, appUserId, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProcessedNews(0)
      .then((d) => {
        setData(d);
        if (d.top10?.length) {
          const slim = d.top10.map(({ thumbnail: _t, ...rest }) => rest);
          setNewsTop10(slim);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50">

        {/* ── 온보딩 배너 ── */}
        {profileChecked && showBanner && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3">
            <p className="text-sm font-bold text-violet-800">✨ 여행 프로필을 완성하면 맞춤 추천을 받을 수 있어요</p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setShowBanner(false)} className="text-xs text-violet-400 hover:text-violet-600">닫기</button>
              <button type="button" onClick={() => router.push("/profile/onboarding")} className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-bold text-white">설정하기</button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            1. 뉴스 배너 캐러셀 (전체 너비)
        ══════════════════════════════════════════════════ */}
        <div className="w-full">
          {loading && <BannerSkeleton />}
          {!loading && error && (
            <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
              <span className="text-4xl">📡</span>
              <p className="text-sm">뉴스를 불러오지 못했습니다.</p>
              <button type="button" onClick={() => { setError(false); setLoading(true); fetchProcessedNews(0).then(setData).catch(() => setError(true)).finally(() => setLoading(false)); }} className="text-xs text-purple-500 hover:underline">다시 시도</button>
            </div>
          )}
          {!loading && data && (
            data.top10.length === 0
              ? <div className="mx-4 mt-4 rounded-2xl bg-gray-100 p-8 text-center text-sm text-gray-400">아직 AI 분석이 진행 중입니다.</div>
              : <NewsBanner items={data.top10} />
          )}
        </div>

        <div className="px-4 pb-8 space-y-7 mt-5">

          {/* ══════════════════════════════════════════════════
              2. 바로가기 숏컷
          ══════════════════════════════════════════════════ */}
          <section>
            <div className="grid grid-cols-6 gap-1.5">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.path}
                  type="button"
                  onClick={() => router.push(s.path)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-2xl group-hover:bg-purple-50 group-hover:border-purple-200 group-hover:shadow-md transition-all">
                    {s.emoji}
                  </div>
                  <span className="text-[10px] text-gray-600 font-medium text-center leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              3. K-콘텐츠 테마
          ══════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="🎭 K-콘텐츠 테마 여행" action={{ label: "전체 보기", path: "/planner/k-content" }} onAction={() => router.push("/planner/k-content")} />
            <div className="grid grid-cols-4 gap-2">
              {K_THEMES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => router.push(t.path)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border py-4 ${t.color} hover:opacity-80 transition-opacity`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-[11px] font-bold">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              4. 인기 여행지
          ══════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="📍 인기 여행지" action={{ label: "더 보기", path: "/planner" }} onAction={() => router.push("/planner")} />
            <div className="grid grid-cols-3 gap-2.5">
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  key={dest.name}
                  type="button"
                  onClick={() => router.push(`/planner/standard/${dest.slug}`)}
                  className={`relative rounded-2xl bg-gradient-to-br ${dest.gradient} h-24 flex flex-col items-center justify-center gap-1 shadow-sm hover:scale-[1.03] hover:shadow-md transition-all overflow-hidden`}
                >
                  <span className="text-3xl drop-shadow">{dest.emoji}</span>
                  <span className="text-sm font-bold text-white drop-shadow">{dest.name}</span>
                </button>
              ))}
            </div>
          </section>

        </div>
      </main>
    </AppLayout>
  );
}

/* ── 섹션 헤더 ── */
function SectionHeader({ title, action, onAction }: {
  title: string;
  action?: { label: string; path: string };
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="text-xs text-gray-400 hover:text-purple-500 transition-colors">
          {action.label} →
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   뉴스 배너 캐러셀 — 네이버 쇼핑 스타일 멀티카드 슬라이드
   - 한 번에 카드 2장 + 오른쪽 살짝 보이기(peek)
   - 클릭 시 해당 기사로 이동, 10초 자동 슬라이드
══════════════════════════════════════════════════════════ */

// 카드별 폴백 그라데이션 (썸네일 없을 때)
const CARD_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-600",
  "from-fuchsia-500 to-pink-600",
  "from-indigo-500 to-violet-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-sky-500",
  "from-lime-400 to-green-500",
];

function NewsBanner({ items }: { items: ProcessedNewsItem[] }) {
  const [offset, setOffset] = useState(0);   // 슬라이드 이동 인덱스 (카드 단위)
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = items.length;

  // 한 번에 넘길 카드 수
  const STEP = 2;
  // 최대 offset: 끝에서 2장 보이도록
  const maxOffset = Math.max(0, total - STEP);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOffset((o) => (o + STEP >= total ? 0 : o + STEP));
    }, 10000);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const prev = useCallback(() => {
    setOffset((o) => Math.max(0, o - STEP));
    resetTimer();
  }, [resetTimer]);

  const next = useCallback(() => {
    setOffset((o) => (o + STEP >= total ? 0 : o + STEP));
    resetTimer();
  }, [total, resetTimer]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  // 카드 너비: "calc(50% - 6px)" → 2장 보이고 오른쪽 peek
  const CARD_W = "calc(50% - 6px)";

  return (
    <div className="select-none w-full">
      {/* 슬라이드 트랙 영역 */}
      <div className="relative overflow-hidden w-full px-3"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* 트랙 */}
        <div
          ref={trackRef}
          className="flex gap-3 transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(calc(-${offset} * (${CARD_W} + 12px)))` }}
        >
          {items.map((item, i) => {
            const rank = i + 1;
            const cat = getCatStyle(item.category);
            const grad = CARD_GRADIENTS[i % CARD_GRADIENTS.length]!;

            return (
              <a
                key={item.id ?? i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 relative rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:scale-[1.01] transition-all"
                style={{ width: CARD_W, height: 240 }}
              >
                {/* 배경: 썸네일 or 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${grad}`}>
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                {/* 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

                {/* 순위 배지 */}
                <div className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow z-10
                  ${rank <= 3 ? "bg-yellow-400 text-white" : "bg-black/60 text-white backdrop-blur-sm"}`}>
                  {rank}
                </div>

                {/* 카테고리 배지 */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cat.bg} ${cat.text}`}>
                    {cat.emoji}
                  </span>
                </div>

                {/* 하단 텍스트 */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-10">
                  {item.location && item.location !== "전국" && (
                    <p className="text-[10px] text-white/70 mb-0.5">📍 {item.location}</p>
                  )}
                  <h3 className="text-xs font-bold text-white leading-snug line-clamp-2 drop-shadow mb-1">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-white/60">
                    <span className="font-medium text-white/80 truncate max-w-[80px]">{item.source}</span>
                    <span>·</span>
                    <span className="shrink-0">{timeAgo(item.published)}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* 컨트롤 바: 카운터 + 화살표 */}
      <div className="flex items-center justify-between px-4 mt-2.5">
        {/* 도트 인디케이터 (페이지 단위) */}
        <div className="flex gap-1 items-center">
          {Array.from({ length: Math.ceil(total / STEP) }).map((_, pi) => {
            const active = Math.floor(offset / STEP) === pi;
            return (
              <button
                key={pi}
                type="button"
                onClick={() => { setOffset(pi * STEP > maxOffset ? maxOffset : pi * STEP); resetTimer(); }}
                className={`rounded-full transition-all duration-200
                  ${active ? "w-5 h-1.5 bg-purple-500" : "w-1.5 h-1.5 bg-gray-300 hover:bg-purple-300"}`}
                aria-label={`${pi + 1}페이지`}
              />
            );
          })}
          <span className="text-[10px] text-gray-400 ml-1">
            <span className="font-bold text-gray-600">{Math.floor(offset / STEP) + 1}</span>/{Math.ceil(total / STEP)}
          </span>
        </div>

        {/* 화살표 버튼 */}
        <div className="flex gap-1.5">
          <button type="button" onClick={prev} aria-label="이전"
            className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600 flex items-center justify-center text-base font-bold shadow-sm transition-colors">
            ‹
          </button>
          <button type="button" onClick={next} aria-label="다음"
            className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600 flex items-center justify-center text-base font-bold shadow-sm transition-colors">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 배너 스켈레톤 ── */
function BannerSkeleton() {
  return (
    <div className="w-full px-3">
      <div className="flex gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="shrink-0 animate-pulse rounded-2xl bg-gray-200 overflow-hidden"
            style={{ width: "calc(50% - 6px)", height: 240 }}>
            <div className="h-full bg-gradient-to-b from-gray-200 to-gray-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 빈 상태 ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}
