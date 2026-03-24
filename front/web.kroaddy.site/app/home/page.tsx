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

// ── 인기 여행지 ────────────────────────────────────────────
const POPULAR_DESTINATIONS = [
  { name: "서울",   emoji: "🏙️",  gradient: "from-indigo-400 to-purple-500" },
  { name: "부산",   emoji: "🌊",  gradient: "from-cyan-400 to-blue-500" },
  { name: "제주",   emoji: "🌿",  gradient: "from-emerald-400 to-teal-500" },
  { name: "경주",   emoji: "🏯",  gradient: "from-amber-400 to-orange-500" },
  { name: "강릉",   emoji: "🌅",  gradient: "from-rose-400 to-pink-500" },
  { name: "전주",   emoji: "🎎",  gradient: "from-yellow-400 to-amber-500" },
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
                  onClick={() => router.push(`/planner/standard/${encodeURIComponent(dest.name)}`)}
                  className={`relative rounded-2xl bg-gradient-to-br ${dest.gradient} h-24 flex flex-col items-center justify-center gap-1 shadow-sm hover:scale-[1.03] hover:shadow-md transition-all overflow-hidden`}
                >
                  <span className="text-3xl drop-shadow">{dest.emoji}</span>
                  <span className="text-sm font-bold text-white drop-shadow">{dest.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              5. 유저 추천 루트 바로가기 배너
          ══════════════════════════════════════════════════ */}
          <section>
            <button
              type="button"
              onClick={() => router.push("/planner/user-content")}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-4 flex items-center justify-between shadow-md hover:opacity-90 transition-opacity"
            >
              <div className="text-left">
                <p className="text-sm font-black text-white">👥 다른 여행자의 추천 루트</p>
                <p className="text-xs text-white/80 mt-0.5">실제 여행자들이 공유한 루트를 확인해보세요</p>
              </div>
              <span className="text-white text-xl font-bold">›</span>
            </button>
          </section>

          {/* ══════════════════════════════════════════════════
              6. AI 플래너 홍보 배너
          ══════════════════════════════════════════════════ */}
          <section>
            <button
              type="button"
              onClick={() => router.push("/planner")}
              className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-4 flex items-center justify-between shadow-md hover:opacity-90 transition-opacity"
            >
              <div className="text-left">
                <p className="text-sm font-black text-white">✨ AI 여행 일정 만들기</p>
                <p className="text-xs text-white/80 mt-0.5">날짜와 여행지를 입력하면 AI가 완성해드려요</p>
              </div>
              <span className="text-white text-xl font-bold">›</span>
            </button>
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
   뉴스 배너 캐러셀 (전체 너비, 오버레이 텍스트 스타일)
══════════════════════════════════════════════════════════ */
function NewsBanner({ items }: { items: ProcessedNewsItem[] }) {
  const [cur, setCur] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = items.length;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCur((c) => (c + 1) % total), 10000);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const prev = useCallback(() => { setCur((c) => (c - 1 + total) % total); resetTimer(); }, [total, resetTimer]);
  const next = useCallback(() => { setCur((c) => (c + 1) % total); resetTimer(); }, [total, resetTimer]);
  const goTo = useCallback((i: number) => { setCur(i); resetTimer(); }, [resetTimer]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  const item = items[cur]!;
  const rank = cur + 1;
  const cat = getCatStyle(item.category);

  return (
    <div className="relative select-none w-full" style={{ height: 260 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* 배경 이미지 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100">
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      {/* 하단 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      {/* 순위 배지 */}
      <div className={`absolute top-3 left-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg z-10
        ${rank <= 3 ? "bg-yellow-400 text-white" : "bg-gray-800/80 text-white backdrop-blur-sm"}`}>
        {rank}
      </div>

      {/* 좌우 화살표 */}
      <button type="button" onClick={prev} aria-label="이전"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors text-lg font-bold">
        ‹
      </button>
      <button type="button" onClick={next} aria-label="다음"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors text-lg font-bold">
        ›
      </button>

      {/* 하단 텍스트 오버레이 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 z-10">
        {/* 카테고리 + 날짜 */}
        <div className="flex flex-wrap gap-1.5 mb-1.5 items-center">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cat.bg} ${cat.text}`}>
            {cat.emoji} {item.category}
          </span>
          {item.location && item.location !== "전국" && (
            <span className="text-[11px] text-white/80">📍 {item.location}</span>
          )}
          {item.date_mentioned && (
            <span className="text-[11px] text-white/80 font-semibold">📅 {item.date_mentioned}</span>
          )}
        </div>

        {/* 제목 */}
        <h3 className="text-sm font-black text-white leading-snug line-clamp-2 drop-shadow mb-1">{item.title}</h3>

        {/* 요약 */}
        {(item.gpt_summary || item.summary) && (
          <p className="text-[11px] text-white/80 line-clamp-1 mb-2">
            {item.gpt_summary || item.summary}
          </p>
        )}

        {/* 출처 + 기사 링크 + 도트 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* 도트 인디케이터 */}
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-200
                  ${i === cur ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"}`}
                aria-label={`${i + 1}번째 뉴스`}
              />
            ))}
            <span className="text-[10px] text-white/60 ml-1">{cur + 1}/{total}</span>
          </div>
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-semibold text-white/90 hover:text-white bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-0.5 transition-colors">
            기사 보기 →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── 배너 스켈레톤 ── */
function BannerSkeleton() {
  return (
    <div className="w-full animate-pulse bg-gray-200" style={{ height: 260 }}>
      <div className="absolute bottom-4 left-4 right-4 space-y-2">
        <div className="h-3 w-24 bg-gray-300 rounded-full" />
        <div className="h-4 bg-gray-300 rounded w-3/4" />
        <div className="h-3 bg-gray-300 rounded w-1/2" />
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
