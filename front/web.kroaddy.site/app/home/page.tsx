"use client";

import React, { useEffect, useState } from "react";
import { useLoginStore } from "@/store";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { fetchUserProfile } from "@/lib/api/userProfile";

const QUICK_LINKS = [
  { label: "여행플래너", desc: "AI가 추천하는 여행 루트와 일정", path: "/planner",           emoji: "🗺️" },
  { label: "일정관리",  desc: "저장된 내 여행 플랜 보기",       path: "/planner/schedule", emoji: "📋" },
  { label: "행사추천",  desc: "전국 문화 축제 캘린더",          path: "/guide/event",      emoji: "🎪" },
  { label: "맛집추천",  desc: "지역별 맛집 탐색",               path: "/guide/restaurant", emoji: "🍜" },
];

export default function HomePage() {
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const router = useRouter();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  // 프로필 미완성 시 배너 표시 (리다이렉트 강제 X – 선택사항)
  useEffect(() => {
    if (!appUserId) return;
    fetchUserProfile(appUserId)
      .then((profile) => {
        if (!profile || !profile.is_complete) setShowOnboardingBanner(true);
      })
      .catch(() => {});
  }, [appUserId]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col items-center justify-center overflow-auto px-8 py-12">
        {/* 온보딩 배너 */}
        {showOnboardingBanner && (
          <div className="mb-8 flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="text-sm font-bold text-violet-800">여행 취향을 설정하면 AI 추천이 정확해져요!</p>
                <p className="text-xs text-violet-500">성별·나이·식습관·종교를 입력하면 맞춤 루트를 추천드려요.</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowOnboardingBanner(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-violet-400 hover:text-violet-600"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => router.push("/profile/onboarding")}
                className="rounded-lg bg-violet-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-600"
              >
                설정하기
              </button>
            </div>
          </div>
        )}

        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-4xl font-bold text-transparent">
            Kroaddy
          </h1>
          <p className="mt-3 text-gray-500">AI와 함께 나만의 여행을 만들어보세요</p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-2 gap-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => router.push(link.path)}
              className="flex flex-col items-start gap-2 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-md"
            >
              <span className="text-3xl">{link.emoji}</span>
              <span className="font-semibold text-gray-800">{link.label}</span>
              <span className="text-sm text-gray-400">{link.desc}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
