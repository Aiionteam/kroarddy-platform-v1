"use client";

import "@/lib/i18n/config";
import React, { useEffect, useState } from "react";
import { useLoginStore } from "@/store";
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
      .then(setData)
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
            <>
              <Section title="🏆 오늘의 Top 10" sub="AI가 선정한 여행자 필수 뉴스">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} large />)}
                </div>
              </Section>
              <Section title="📰 전체 뉴스">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              </Section>
            </>
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
            <>
              {/* TOP 10 */}
              <Section title="🏆 오늘의 Top 10" sub="GPT가 선정한 여행자 필수 뉴스">
                {data.top10.length === 0 ? (
                  <EmptyState text="아직 AI 분석이 진행 중입니다. 잠시 후 새로고침 해주세요." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.top10.map((item, idx) => (
                      <Top10Card key={item.id} item={item} rank={idx + 1} />
                    ))}
                  </div>
                )}
              </Section>

            </>
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

/* ── Top10 카드 (크고 화려하게) ── */
function Top10Card({ item, rank }: { item: ProcessedNewsItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const cat = getCatStyle(item.category);

  return (
    <div className="relative rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* 순위 배지 */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
        <span className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-black shadow ${rank <= 3 ? "bg-yellow-400 text-white" : "bg-gray-800 text-white"}`}>
          {rank}
        </span>
      </div>

      {/* 썸네일 */}
      {item.thumbnail ? (
        <img src={item.thumbnail} alt="" className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center text-4xl">
          {cat.emoji}
        </div>
      )}

      <div className="p-4 space-y-2">
        {/* 카테고리 + 지역 + 날짜 */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cat.bg} ${cat.text}`}>
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

        {/* 요약 - GPT 재작성 우선, 없으면 원본 */}
        {(item.gpt_summary || item.summary) && (
          <div>
            <p className={`text-xs leading-relaxed ${item.gpt_summary ? "text-gray-700" : "text-gray-500"} ${expanded ? "" : "line-clamp-3"}`}>
              {item.gpt_summary || item.summary}
            </p>
            {(item.gpt_summary || item.summary).length > 80 && (
              <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs text-purple-500 hover:underline mt-0.5">
                {expanded ? "접기" : "더 보기"}
              </button>
            )}
          </div>
        )}

        {/* 출처 + 시간 */}
        <div className="flex items-center gap-1.5 text-xs text-gray-300 pt-1">
          <span className="font-medium text-purple-400">{item.source}</span>
          <span>·</span>
          <span>{timeAgo(item.published)}</span>
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
