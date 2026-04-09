"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useTranslation } from "react-i18next";

const TABS = [
  { id: "restaurant", label: "guide.tabs.restaurant.label", description: "guide.tabs.restaurant.description", path: "/guide/restaurant" },
  { id: "event", label: "guide.tabs.event.label", description: "guide.tabs.event.description", path: "/guide/event" },
];

export default function GuideLandingPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{t("guide.title", { defaultValue: "장소 추천" })}</h1>
              <p className="mt-1 text-sm text-gray-500">{t("guide.subtitle", { defaultValue: "맛집과 행사를 한 화면에서 선택해서 살펴보세요." })}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          <div className="w-full max-w-3xl">
            <div className="mb-6 inline-flex rounded-full bg-gray-100 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => router.push(tab.path)}
                  className="relative flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-white hover:text-purple-700"
                >
                  {t(tab.label, {
                    defaultValue: tab.id === "restaurant" ? "맛집 추천" : "행사 추천",
                  })}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {TABS.map((tab) => (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => router.push(tab.path)}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-md"
                >
                  <span className="text-2xl">{tab.id === "restaurant" ? "🍜" : "🎪"}</span>
                  <span className="text-base font-semibold text-gray-800">
                    {t(tab.label, {
                      defaultValue: tab.id === "restaurant" ? "맛집 추천" : "행사 추천",
                    })}
                  </span>
                  <span className="text-sm text-gray-500">
                    {t(tab.description, {
                      defaultValue: tab.id === "restaurant" ? "지역별 맛집 탐색" : "전국 문화 축제 캘린더",
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}

