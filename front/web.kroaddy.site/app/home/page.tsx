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
  return CATEGORY_STYLE[cat] ?? CATEGORY_STYLE["기타"];
}

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
        // 플래너에서 재활용할 수 있도록 Zustand store에 저장 (썸네일 제외)
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

        {/* 온보딩 배너 */}
        {profileChecked && showBanner && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3">
            <p className="text-sm font-bold text-violet-800">✨ 여행 프로필을 완성하면 맞춤 추천을 받을 수 있어요</p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setShowBanner(false)} className="text-xs text-violet-400 hover:text-violet-600">닫기</button>
              <button type="button" onClick={() => router.push("/profile/onboarding")} className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-bold text-white">설정하기</button>
            </div>
          </div>
        )}

        <div className="px-4 py-6 space-y-8">

          {/* ── 로딩 ── */}
          {loading && (
            <Section title="🏆 오늘의 Top 10" sub="AI가 선정한 여행자 필수 뉴스">
              <CarouselSkeleton />
            </Section>
          )}

          {/* ── 에러 ── */}
          {!loading && error && (
            <div className="flex flex-col items-center py-24 gap-3 text-gray-400">
              <span className="text-5xl">📡</span>
              <p className="text-sm">뉴스를 불러오지 못했습니다.</p>
              <button type="button" onClick={() => { setError(false); setLoading(true); fetchProcessedNews(0).then(setData).catch(() => setError(true)).finally(() => setLoading(false)); }} className="text-xs text-purple-500 hover:underline">다시 시도</button>
            </div>
          )}

          {/* ── 데이터 ── */}
          {!loading && data && (
            <Section title="🏆 오늘의 Top 10" sub="GPT가 선정한 여행자 필수 뉴스">
              {data.top10.length === 0 ? (
                <EmptyState text="아직 AI 분석이 진행 중입니다. 잠시 후 새로고침 해주세요." />
              ) : (
                <Top10Carousel items={data.top10} />
              )}
            </Section>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

/* ── 섹션 래퍼 ── */
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/* ── Top10 캐러셀 ── */
function Top10Carousel({ items }: { items: ProcessedNewsItem[] }) {
  const [cur, setCur] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const total = items.length;

  const prev = useCallback(() => setCur((c) => (c - 1 + total) % total), [total]);
  const next = useCallback(() => setCur((c) => (c + 1) % total), [total]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  const item = items[cur]!;
  const rank = cur + 1;
  const cat = getCatStyle(item.category);

  return (
    <div className="select-none">
      {/* 카드 */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden"
      >
        {/* 이미지 영역 */}
        <div className="relative w-full aspect-video bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center overflow-hidden">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span className="text-6xl">{cat.emoji}</span>
          )}
          {/* 순위 배지 */}
          <div className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg
            ${rank <= 3 ? "bg-yellow-400 text-white" : "bg-gray-800/80 text-white backdrop-blur-sm"}`}>
            {rank}
          </div>
          {/* 좌우 화살표 */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors text-lg"
            aria-label="이전"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors text-lg"
            aria-label="다음"
          >
            ›
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-2.5">
          {/* 카테고리 + 지역 + 날짜 */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cat.bg} ${cat.text}`}>
              {cat.emoji} {item.category}
            </span>
            {item.location && item.location !== "전국" && (
              <span className="rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-500">
                📍 {item.location}
              </span>
            )}
            {item.date_mentioned && (
              <span className="rounded-full px-2 py-0.5 text-xs bg-indigo-50 text-indigo-500 font-semibold">
                📅 {item.date_mentioned}
              </span>
            )}
          </div>

          {/* 제목 */}
          <h3 className="text-sm font-bold text-gray-800 leading-snug">{item.title}</h3>

          {/* 요약 */}
          {(item.gpt_summary || item.summary) && (
            <p className="text-xs leading-relaxed text-gray-500 line-clamp-3">
              {item.gpt_summary || item.summary}
            </p>
          )}

          {/* 출처 + 기사 링크 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="font-medium text-purple-400">{item.source}</span>
              <span>·</span>
              <span>{timeAgo(item.published)}</span>
            </div>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-purple-500 hover:text-purple-700 hover:underline transition-colors"
            >
              기사 보기 →
            </a>
          </div>
        </div>
      </div>

      {/* 도트 인디케이터 */}
      <div className="flex justify-center gap-1.5 mt-3">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCur(i)}
            className={`rounded-full transition-all duration-200
              ${i === cur ? "w-5 h-2 bg-purple-500" : "w-2 h-2 bg-gray-300 hover:bg-purple-300"}`}
            aria-label={`${i + 1}번째 뉴스`}
          />
        ))}
      </div>

      {/* 카운터 */}
      <p className="text-center text-xs text-gray-400 mt-1.5">
        <span className="font-bold text-gray-600">{cur + 1}</span> / {total}
      </p>
    </div>
  );
}

/* ── 캐러셀 스켈레톤 ── */
function CarouselSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden">
      <div className="w-full aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="space-y-1.5">
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
          <div className="h-3 bg-gray-100 rounded w-3/5" />
        </div>
      </div>
    </div>
  );
}

/* ── 나머지 뉴스 카드 (작고 간결하게) ── */
function RestCard({ item }: { item: ProcessedNewsItem }) {
  const [expanded, setExpanded] = useState(false);
  const cat = getCatStyle(item.category);

  return (
    <div className="rounded-xl bg-white border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
      <div className="flex flex-wrap gap-1 items-center">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cat.bg} ${cat.text}`}>
          {cat.emoji} {item.category}
        </span>
        {item.location && item.location !== "전국" && (
          <span className="text-xs text-gray-400">📍 {item.location}</span>
        )}
        {item.date_mentioned && (
          <span className="text-xs text-indigo-400 font-semibold">📅 {item.date_mentioned}</span>
        )}
      </div>

      <h3 className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">{item.title}</h3>

      {(item.gpt_summary || item.summary) && (
        <div>
          <p className={`text-xs leading-relaxed ${item.gpt_summary ? "text-gray-600" : "text-gray-400"} ${expanded ? "" : "line-clamp-2"}`}>
            {item.gpt_summary || item.summary}
          </p>
          {(item.gpt_summary || item.summary).length > 60 && (
            <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs text-purple-400 hover:underline">
              {expanded ? "접기" : "더 보기"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-300 mt-auto">
        <span className="text-purple-300">{item.source}</span>
        <span>·</span>
        <span>{timeAgo(item.published)}</span>
      </div>
    </div>
  );
}

/* ── 스켈레톤 ── */
function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-white p-4 shadow-sm space-y-3 ${large ? "h-52" : "h-36"}`}>
      <div className="h-3 w-20 bg-gray-200 rounded-full" />
      <div className="h-4 bg-gray-200 rounded w-4/5" />
      <div className="space-y-1.5">
        <div className="h-3 bg-gray-100 rounded" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
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
