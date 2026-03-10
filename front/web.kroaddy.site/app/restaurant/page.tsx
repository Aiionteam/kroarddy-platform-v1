"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";

export default function RestaurantPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <h1 className="text-xl font-bold text-gray-800">맛집추천</h1>
          <p className="mt-1 text-sm text-gray-500">준비 중입니다</p>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-gray-400">맛집 추천 콘텐츠가 곧 제공됩니다.</p>
        </div>
      </main>
    </div>
  );
}
