"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";

const MODE_OPTIONS = [
  {
    id: "standard",
    label: "스탠다드",
    emoji: "🗺️",
    desc: "AI가 추천하는 여행 루트와 일정",
    available: true,
    path: "/planner/standard",
  },
  {
    id: "k-content",
    label: "K컨텐츠",
    emoji: "🎬",
    desc: "드라마·영화 촬영지 여행",
    available: false,
    path: "/planner/k-content",
  },
  {
    id: "user-content",
    label: "유저 컨텐츠",
    emoji: "👥",
    desc: "여행자들이 만든 추천 코스",
    available: true,
    path: "/planner/user-content",
  },
] as const;

export default function PlannerPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <main className="flex flex-1 flex-col items-center justify-center bg-gray-100 px-8 py-12">
        <div className="mb-10 text-center">
          <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold text-transparent">
            여행 플래너
          </h2>
          <p className="mt-2 text-sm text-gray-500">원하는 여행 스타일을 선택해 주세요</p>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-4">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => opt.available && router.push(opt.path)}
              disabled={!opt.available}
              className={`flex items-center gap-5 rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-150 ${
                opt.available
                  ? "border-gray-200 hover:border-purple-300 hover:shadow-md cursor-pointer"
                  : "border-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="text-4xl leading-none">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{opt.label}</span>
                  {!opt.available && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                      준비 중
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-400">{opt.desc}</p>
              </div>
              {opt.available && (
                <span className="shrink-0 text-gray-300 text-lg">→</span>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
