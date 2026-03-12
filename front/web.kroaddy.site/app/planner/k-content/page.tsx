"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";

export default function KContentPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/planner")}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-800">K컨텐츠</h2>
            <p className="text-[11px] text-gray-400">드라마·영화 촬영지 여행</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center px-8">
          <span className="text-6xl">🎬</span>
          <div>
            <p className="text-lg font-semibold text-gray-700">K컨텐츠 플래너 준비 중</p>
            <p className="mt-1.5 text-sm text-gray-400">
              드라마·영화 촬영지 기반 여행 루트가 곧 업데이트될 예정이에요
            </p>
          </div>
          <span className="rounded-full border border-dashed border-gray-300 px-5 py-2 text-xs text-gray-400">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
