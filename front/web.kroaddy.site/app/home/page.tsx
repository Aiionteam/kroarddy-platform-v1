"use client";

import "@/lib/i18n/config";
import React, { useEffect, useState } from "react";
import { useLoginStore } from "@/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/organisms/AppLayout";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { fetchUserProfile } from "@/lib/api/userProfile";

const SKIP_KEY = "onboarding_skipped";

export default function HomePage() {
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const { t } = useTranslation();
  const router = useRouter();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  // null = 아직 로딩 중, true = 배너 표시, false = 숨김
  const [showBanner, setShowBanner] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/"); return; }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !appUserId) return;

    const skipped = sessionStorage.getItem(SKIP_KEY) === "1";

    fetchUserProfile(appUserId)
      .then((profile) => {
        if (!profile || !profile.is_complete) {
          if (skipped) {
            // 이번 세션에서 이미 "나중에 하기"를 눌렀으면 배너만 표시
            setShowBanner(true);
          } else {
            // 처음 들어오면 바로 온보딩으로 이동
            router.replace("/profile/onboarding");
          }
        }
      })
      .catch(() => {
        // 프로필 API 오류 → 그냥 홈 유지
      })
      .finally(() => setProfileChecked(true));
  }, [isAuthenticated, appUserId, router]);

  // 프로필 체크 완료 전에는 렌더링 숨김 (리다이렉트 플래시 방지)
  if (!isAuthenticated) return null;

  const QUICK_LINKS = [
    { label: t("home.planner.label"),  desc: t("home.planner.desc"),  path: "/planner",           emoji: "🗺️" },
    { label: t("home.schedule.label"), desc: t("home.schedule.desc"), path: "/planner/schedule",  emoji: "📋" },
    { label: t("home.guide.label"),    desc: t("home.guide.desc"),    path: "/guide",             emoji: "📍" },
    { label: t("home.kcontent.label"), desc: t("home.kcontent.desc"), path: "/planner/k-content", emoji: "🎬" },
  ] as const;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col items-center justify-center overflow-auto px-4 py-8 md:px-8 md:py-12">

        {/* "나중에 하기" 후 배너 */}
        {profileChecked && showBanner && (
          <div className="mb-8 flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="text-sm font-bold text-violet-800">{t("home.banner.title")}</p>
                <p className="text-xs text-violet-500">{t("home.banner.sub")}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-violet-400 hover:text-violet-600"
              >
                {t("home.banner.close")}
              </button>
              <button
                type="button"
                onClick={() => router.push("/profile/onboarding")}
                className="rounded-lg bg-violet-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-600"
              >
                {t("home.banner.setup")}
              </button>
            </div>
          </div>
        )}

        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-4xl font-bold text-transparent">
            HOME
          </h1>
          <p className="mt-3 text-gray-500">{t("home.subtitle") }</p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
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
    </AppLayout>
  );
}
