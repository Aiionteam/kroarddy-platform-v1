"use client";

import "@/lib/i18n/config";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

function ChatIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function TourstarIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function ScheduleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>; }
function PlannerIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function PlaceIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.686 2 6 4.686 6 8c0 4.418 6 10 6 10s6-5.582 6-10c0-3.314-2.686-6-6-6z" /><circle cx="12" cy="8" r="2.5" /></svg>; }
function FriendsIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function SettingsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m16.364-6.364l-4.243 4.243M7.879 16.121l-4.243 4.243m12.728 0l-4.243-4.243M7.879 7.879L3.636 3.636" /></svg>; }
function LogoutIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>; }

export interface AppSidebarProps {
  onLogout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onLogout }) => {
  const router   = useRouter();
  const pathname = usePathname() ?? "";
  const { t }    = useTranslation();

  const NAV = [
    { key: "sidebar.tourstar", path: "/tourstar",          icon: <TourstarIcon /> },
    { key: "sidebar.planner",  path: "/planner",           icon: <PlannerIcon /> },
    { key: "sidebar.schedule", path: "/planner/schedule",  icon: <ScheduleIcon /> },
    { key: "sidebar.guide",    path: "/guide",             icon: <PlaceIcon /> },
    { key: "sidebar.groupchat",path: "/chat/groupchat",    icon: <ChatIcon /> },
  ] as const;

  const isActive = (path: string) => {
    if (pathname === path) return true;
    const hasMoreSpecific = NAV.some(
      (n) => n.path !== path && n.path.startsWith(path + "/") && pathname.startsWith(n.path)
    );
    if (hasMoreSpecific) return false;
    return pathname.startsWith(path + "/") || pathname.startsWith(path + "?");
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 border-b border-gray-200 p-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hover:opacity-90"
        >
          {t("app.name")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => router.push(item.path)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive(item.path) ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.icon}
                <span className="truncate">{t(item.key)}</span>
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
          <FriendsIcon />
          <span>{t("sidebar.friends")}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile/settings")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            pathname.startsWith("/profile/settings") ? "bg-purple-100 text-purple-800" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <SettingsIcon />
          <span>{t("sidebar.profile")}</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogoutIcon />
          <span>{t("sidebar.logout")}</span>
        </button>
      </div>
    </aside>
  );
};
