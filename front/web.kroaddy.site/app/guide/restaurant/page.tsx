"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useTranslation } from "react-i18next";

export default function RestaurantPage() {
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
          <h1 className="text-xl font-bold text-gray-800">{t("guide.restaurant.title", { defaultValue: "맛집추천" })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("common.coming_soon", { defaultValue: "준비 중입니다" })}</p>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-gray-400">{t("guide.restaurant.soon", { defaultValue: "맛집 추천 콘텐츠가 곧 제공됩니다." })}</p>
        </div>
      </main>
    </AppLayout>
  );
}
