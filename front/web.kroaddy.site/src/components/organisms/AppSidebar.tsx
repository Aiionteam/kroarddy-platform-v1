"use client";

/**
 * [메모] /home 등 모든 레이아웃에서 사용하는 사이드바.
 * - "설정" 메뉴 클릭 시 /profile/settings 로 이동.
 * - 설정 페이지는 api.kroaddy.site gateway 사용자 서비스와 연동됨 (사용자 정보 조회, 닉네임 CRUD).
 * - 백엔드: api.kroaddy.site/gateway/src/main/java/site/aiion/api/services/user
 */
import React from "react";
import { useRouter, usePathname } from "next/navigation";

export type SidebarCategoryId = "chat" | "tourstar" | "schedule" | "planner" | "restaurant" | "event";

const CATEGORIES: { id: SidebarCategoryId; label: string; path?: string; icon: React.ReactNode }[] = [
  { id: "tourstar",    label: "투어스타",  path: "/tourstar",          icon: <TourstarIcon /> },
  { id: "schedule",   label: "일정관리",  path: "/planner/schedule",  icon: <ScheduleIcon /> },
  { id: "planner",    label: "여행플래너", path: "/planner",            icon: <PlannerIcon /> },
  { id: "restaurant", label: "맛집추천",  path: "/guide/restaurant",  icon: <RestaurantIcon /> },
  { id: "event",      label: "행사추천",  path: "/guide/event",       icon: <EventIcon /> },
  { id: "chat",       label: "단체채팅",  path: "/chat/groupchat",    icon: <ChatIcon /> },
];

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function TourstarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function ScheduleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function PlannerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function RestaurantIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}
function EventIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

export interface AppSidebarProps {
  onLogout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onLogout }) => {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const isActive = (path?: string) =>
    path && (pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path + "?"));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 border-b border-gray-200 p-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hover:opacity-90"
        >
          Kroaddy
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-3">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-gray-500">카테고리</p>
        <ul className="space-y-0.5">
          {CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => (cat.path ? router.push(cat.path) : null)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive(cat.path) ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-200 p-3 space-y-1">
        <button
          type="button"
          onClick={() => router.push("/chat/friends")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            pathname.startsWith("/chat/friends") ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>친구목록</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/chat/whisper")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            pathname.startsWith("/chat/whisper") ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>귓속말</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile/settings")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            pathname.startsWith("/profile/settings") ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m16.364-6.364l-4.243 4.243M7.879 16.121l-4.243 4.243m12.728 0l-4.243-4.243M7.879 7.879L3.636 3.636" />
          </svg>
          <span>설정</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
};
