"use client";

import "@/lib/i18n/config";
import React, { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";
import { useTokenRefresher } from "@/hooks/useTokenRefresher";

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export interface AppLayoutProps {
  onLogout: () => void;
  children: React.ReactNode;
  /** 모바일 상단바에 표시할 페이지 제목 (없으면 "Kroaddy") */
  mobileTitle?: string;
}

export function AppLayout({ onLogout, children, mobileTitle }: AppLayoutProps) {
  useTokenRefresher();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);

  // 페이지 이동 시 사이드바 자동 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 모바일에서 사이드바 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-100">

      {/* ── 모바일 오버레이 ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── 사이드바 ── */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 h-full",
          "transform transition-transform duration-300 ease-in-out",
          "md:relative md:z-auto md:translate-x-0 md:shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <AppSidebar onLogout={onLogout} onClose={closeSidebar} />
      </div>

      {/* ── 메인 영역 ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* 모바일 상단 바 */}
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={openSidebar}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200"
            aria-label="메뉴 열기"
          >
            <HamburgerIcon />
          </button>
          <span className="text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {mobileTitle ?? "Kroaddy"}
          </span>
        </header>

        {/* 페이지 콘텐츠: 모바일에서 스크롤 허용, 데스크톱에서 overflow-hidden 유지 */}
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto md:overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
