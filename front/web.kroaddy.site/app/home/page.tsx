"use client";

import React, { useEffect, useState } from "react";
import { useLoginStore } from "@/store";
import { useLangStore } from "@/store/slices/langSlice";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { fetchUserProfile } from "@/lib/api/userProfile";

export default function HomePage() {
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const { t } = useLangStore();
  const router = useRouter();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!appUserId) return;
    fetchUserProfile(appUserId)
      .then((profile) => {
        if (!profile || !profile.is_complete) setShowOnboardingBanner(true);
      })
      .catch(() => {});
  }, [appUserId]);

  if (!isAuthenticated) return null;

  const QUICK_LINKS = [
    { labelKey: "home.planner",  descKey: "home.planner.desc",  path: "/planner",            emoji: "🗺️" },
    { labelKey: "home.schedule", descKey: "home.schedule.desc", path: "/planner/schedule",   emoji: "📋" },
    { labelKey: "home.guide",    descKey: "home.guide.desc",    path: "/guide",              emoji: "📍" },
    { labelKey: "home.kcontent", descKey: "home.kcontent.desc", path: "/planner/k-content",  emoji: "🎬" },
  ] as const;

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
                <p className="text-sm font-bold text-violet-800">{t("home.onboarding.banner")}</p>
                <p className="text-xs text-violet-500">{t("home.onboarding.banner.sub")}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowOnboardingBanner(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-violet-400 hover:text-violet-600"
              >
                {t("home.onboarding.close")}
              </button>
              <button
                type="button"
                onClick={() => router.push("/profile/onboarding")}
                className="rounded-lg bg-violet-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-600"
              >
                {t("home.onboarding.setup")}
              </button>
            </div>
          </div>
        )}

        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-4xl font-bold text-transparent">
            {t("home.greeting")}
          </h1>
          <p className="mt-3 text-gray-500">{t("home.subtitle")}</p>
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
              <span className="font-semibold text-gray-800">{t(link.labelKey)}</span>
              <span className="text-sm text-gray-400">{t(link.descKey)}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
