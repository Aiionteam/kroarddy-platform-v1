"use client";

import { useState } from "react";

const WEP_URL = process.env.NEXT_PUBLIC_WEP_URL ?? "https://wep.kroaddy.site";

/* ─────────────────────────────────────────────
   상수 데이터
───────────────────────────────────────────── */

const NOTICES = [
  {
    id: 1,
    badge: "업데이트",
    badgeColor: "bg-purple-100 text-purple-700",
    title: "TourStar v1.2 업데이트 – AI 일정 재생성 기능 추가",
    date: "2026.03.05",
  },
  {
    id: 2,
    badge: "공지",
    badgeColor: "bg-blue-100 text-blue-700",
    title: "서버 점검 안내 (3월 15일 새벽 2시 ~ 4시)",
    date: "2026.03.03",
  },
  {
    id: 3,
    badge: "이벤트",
    badgeColor: "bg-pink-100 text-pink-700",
    title: "봄 여행 시즌 런칭 이벤트 – 첫 플랜 생성 시 프리미엄 무료",
    date: "2026.02.28",
  },
  {
    id: 4,
    badge: "공지",
    badgeColor: "bg-blue-100 text-blue-700",
    title: "개인정보 처리방침 개정 안내",
    date: "2026.02.20",
  },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "AI 맞춤 여행 플래너",
    desc: "취향·식습관·종교 등 개인 정보를 학습해 나만을 위한 여행 루트와 일정을 자동으로 설계합니다.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: "🗺️",
    title: "스마트 루트 추천",
    desc: "목적지를 선택하면 AI가 7가지 최적 루트를 제안하고, 선택한 루트의 상세 일정을 즉시 생성합니다.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: "🎪",
    title: "전국 축제 캘린더",
    desc: "공공 데이터 기반 전국 문화 축제 정보를 연·월별로 한눈에 확인하고 여행 일정에 포함시키세요.",
    color: "from-orange-400 to-pink-500",
  },
  {
    icon: "💬",
    title: "여행자 그룹 채팅",
    desc: "같은 목적지 여행자들과 실시간으로 정보를 공유하고 동행을 구할 수 있는 그룹 채팅방을 제공합니다.",
    color: "from-green-500 to-teal-600",
  },
  {
    icon: "📅",
    title: "일정 저장 & 수정",
    desc: "생성된 일정을 저장하고, AI를 통해 언제든지 세부 항목을 재생성하거나 자유롭게 수정할 수 있습니다.",
    color: "from-pink-500 to-rose-600",
  },
  {
    icon: "🌍",
    title: "외국인 관광객 지원",
    desc: "국적·언어·종교 설정을 통해 외국인 방문객에게도 최적화된 한국 여행 경험을 제공합니다.",
    color: "from-indigo-500 to-purple-600",
  },
];

const APP_SCREENS = [
  { label: "홈", emoji: "🏠", bg: "from-purple-400 to-violet-500" },
  { label: "플래너", emoji: "🗺️", bg: "from-blue-400 to-cyan-500" },
  { label: "일정", emoji: "📅", bg: "from-pink-400 to-rose-500" },
  { label: "채팅", emoji: "💬", bg: "from-green-400 to-teal-500" },
];

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center text-white text-sm font-bold shadow-md">
            ★
          </div>
          <span className="text-xl font-bold text-gray-900">
            Tour<span className="text-purple-600">Star</span>
          </span>
        </div>

        {/* 데스크톱 내비 */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-purple-600 transition-colors">기능 소개</a>
          <a href="#app" className="hover:text-purple-600 transition-colors">앱 미리보기</a>
          <a href="#notices" className="hover:text-purple-600 transition-colors">공지사항</a>
          <a href="#download" className="hover:text-purple-600 transition-colors">다운로드</a>
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href={WEP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 rounded-full border-2 border-purple-600 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors"
          >
            웹으로 이용하기
          </a>
          <a
            href="#download"
            className="px-5 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-md"
          >
            앱 다운로드
          </a>
        </div>

        {/* 모바일 햄버거 */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4 text-sm font-medium text-gray-700">
          <a href="#features" onClick={() => setMenuOpen(false)} className="hover:text-purple-600">기능 소개</a>
          <a href="#app" onClick={() => setMenuOpen(false)} className="hover:text-purple-600">앱 미리보기</a>
          <a href="#notices" onClick={() => setMenuOpen(false)} className="hover:text-purple-600">공지사항</a>
          <a href="#download" onClick={() => setMenuOpen(false)} className="hover:text-purple-600">다운로드</a>
          <a
            href={WEP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="text-center py-2.5 rounded-full border-2 border-purple-600 text-purple-600 font-semibold"
          >
            웹으로 이용하기
          </a>
          <a href="#download" onClick={() => setMenuOpen(false)} className="text-center py-2.5 rounded-full bg-purple-600 text-white font-semibold">
            앱 다운로드
          </a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#f8f7ff] via-white to-purple-50 pt-16">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-purple-200/40 blur-3xl" />
        <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full bg-violet-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-pink-200/30 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center relative z-10">
        {/* 텍스트 */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            AI 기반 맞춤형 여행 서비스
          </span>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            당신만을 위한
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
              스마트 여행
            </span>
            <br />
            플래너
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
            TourStar는 AI가 당신의 취향을 분석해 최적의 여행 루트와 일정을 설계합니다.
            전국 축제 정보부터 그룹 채팅까지, 여행의 모든 것을 한 곳에서.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href={WEP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl border-2 border-purple-600 text-purple-600 font-semibold hover:bg-purple-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              웹으로 이용하기
            </a>
            <a
              href="#download"
              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-700 transition-colors shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              App Store
            </a>
            <a
              href="#download"
              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76c.34.19.75.2 1.11.02l12.09-6.87-2.73-2.76-10.47 9.61zM.35 1.33A1.52 1.52 0 0 0 0 2.35v19.3c0 .38.13.72.35 1.02l.1.09 10.81-10.81v-.26L.45 1.24l-.1.09zm20.49 9.01-2.87-1.63-3.03 3.04 3.03 3.03 2.9-1.65c.83-.47.83-1.32-.03-1.79zm-17.66 12.1l10.48-9.62-2.73-2.76-7.75 12.38z" />
              </svg>
              Google Play
            </a>
          </div>

          <div className="mt-10 flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400 text-base">★★★★★</span>
              <span>4.9 평점</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <span>10,000+ 다운로드</span>
            <div className="w-px h-4 bg-gray-200" />
            <span>무료</span>
          </div>
        </div>

        {/* 앱 목업 */}
        <div className="hidden md:flex justify-center">
          <div className="relative">
            {/* 메인 폰 */}
            <div className="w-64 h-[520px] bg-gray-900 rounded-[3rem] shadow-2xl p-3 relative z-10">
              <div className="w-full h-full bg-gradient-to-b from-[#6c3fc5] to-[#4e2d91] rounded-[2.4rem] overflow-hidden flex flex-col">
                {/* 상태바 */}
                <div className="flex justify-between items-center px-6 pt-4 pb-2 text-white/80 text-xs">
                  <span>9:41</span>
                  <div className="flex gap-1">
                    <span>●●●</span>
                  </div>
                </div>
                {/* 앱 콘텐츠 */}
                <div className="flex-1 px-5 pt-4">
                  <p className="text-white/60 text-xs mb-1">안녕하세요 👋</p>
                  <p className="text-white font-bold text-lg mb-6">어디로 떠나볼까요?</p>

                  <div className="bg-white/20 backdrop-blur rounded-2xl p-3 mb-4">
                    <p className="text-white/60 text-xs mb-2">🔍 목적지 검색</p>
                    <p className="text-white/40 text-sm">제주도, 부산, 경주...</p>
                  </div>

                  <p className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">추천 목적지</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["🌊 제주도", "🏯 경주", "🌉 부산", "🏔️ 강원도"].map((d) => (
                      <div key={d} className="bg-white/15 rounded-xl p-2.5 text-white text-xs font-medium">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 bg-white/10 rounded-2xl p-3">
                    <p className="text-white/60 text-xs mb-1">🎪 이번 달 축제</p>
                    <p className="text-white text-sm font-semibold">진해 군항제</p>
                    <p className="text-white/50 text-xs mt-0.5">3월 22일 ~ 4월 1일</p>
                  </div>
                </div>

                {/* 탭바 */}
                <div className="flex justify-around items-center px-4 py-3 bg-white/10 mx-3 mb-3 rounded-2xl">
                  {["🏠", "🗺️", "📅", "💬", "⚙️"].map((icon) => (
                    <span key={icon} className="text-base">{icon}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 뒤 폰 (장식) */}
            <div className="absolute -right-12 top-8 w-56 h-[460px] bg-gray-800 rounded-[2.6rem] shadow-xl p-2.5 opacity-40 rotate-6">
              <div className="w-full h-full bg-gradient-to-b from-violet-500 to-purple-700 rounded-[2.2rem]" />
            </div>

            {/* 플로팅 카드 */}
            <div className="absolute -left-14 top-20 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 w-44">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="text-xs font-bold text-gray-800">AI 일정 생성</p>
                <p className="text-xs text-gray-400">제주도 3박 4일</p>
              </div>
            </div>

            <div className="absolute -left-10 bottom-32 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 w-44">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-lg">✅</div>
              <div>
                <p className="text-xs font-bold text-gray-800">일정 저장 완료</p>
                <p className="text-xs text-gray-400">5개 장소 추가됨</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 스크롤 힌트 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-400 animate-bounce">
        <span className="text-xs">스크롤</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-4">
            주요 기능
          </span>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
            여행을 더 스마트하게
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            AI 기술과 실시간 데이터를 결합해 당신의 여행을 완전히 새롭게 경험하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-3xl bg-gray-50 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-purple-100 cursor-default"
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}
              >
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppPreview() {
  return (
    <section id="app" className="py-24 bg-gradient-to-br from-[#f8f7ff] to-purple-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-4">
            앱 미리보기
          </span>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
            직관적인 UI, 쉬운 사용
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            복잡한 설정 없이 바로 사용하는 깔끔한 인터페이스로 여행 계획을 시작하세요.
          </p>
        </div>

        {/* 앱 스크린 카드 */}
        <div className="flex flex-wrap justify-center gap-6">
          {APP_SCREENS.map((screen) => (
            <div key={screen.label} className="flex flex-col items-center gap-3">
              <div
                className={`w-36 h-[280px] rounded-[2rem] bg-gradient-to-b ${screen.bg} shadow-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden`}
              >
                {/* 상단 노치 */}
                <div className="absolute top-3 w-16 h-4 bg-black/20 rounded-full" />
                <span className="text-5xl mt-6">{screen.emoji}</span>
                <span className="text-white font-bold text-sm">{screen.label}</span>
                {/* 하단 홈 인디케이터 */}
                <div className="absolute bottom-3 w-20 h-1 bg-white/40 rounded-full" />
              </div>
              <span className="text-sm font-semibold text-gray-600">{screen.label} 화면</span>
            </div>
          ))}
        </div>

        {/* 통계 배너 */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { num: "10K+", label: "다운로드" },
            { num: "4.9★", label: "평균 평점" },
            { num: "50+", label: "지원 여행지" },
            { num: "3초", label: "AI 일정 생성" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 bg-white rounded-3xl shadow-md border border-purple-50"
            >
              <p className="text-3xl font-extrabold text-purple-600 mb-1">{stat.num}</p>
              <p className="text-gray-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Notices() {
  return (
    <section id="notices" className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-4">
            공지사항
          </span>
          <h2 className="text-4xl font-extrabold text-gray-900">최근 소식</h2>
        </div>

        <div className="flex flex-col gap-3">
          {NOTICES.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-200 cursor-pointer group"
            >
              <span
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${n.badgeColor}`}
              >
                {n.badge}
              </span>
              <p className="flex-1 text-gray-800 font-medium text-sm group-hover:text-purple-700 transition-colors">
                {n.title}
              </p>
              <span className="shrink-0 text-gray-400 text-xs">{n.date}</span>
              <svg
                className="shrink-0 w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button className="px-6 py-2.5 rounded-full border-2 border-purple-200 text-purple-600 text-sm font-semibold hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all duration-200">
            전체 공지 보기
          </button>
        </div>
      </div>
    </section>
  );
}

function Download() {
  return (
    <section id="download" className="py-24 bg-gradient-to-br from-purple-700 via-violet-700 to-purple-900 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/10" />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur flex items-center justify-center text-4xl mx-auto mb-8 shadow-xl">
          ★
        </div>

        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5">
          지금 바로 시작하세요
        </h2>
        <p className="text-purple-200 text-lg mb-12 max-w-xl mx-auto">
          TourStar를 무료로 다운로드하고 AI가 설계한 나만의 첫 여행을 경험해보세요.
        </p>

        <div className="flex flex-wrap justify-center gap-5">
          {/* App Store */}
          <a
            href="#"
            className="flex items-center gap-4 px-8 py-4 rounded-2xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors shadow-xl"
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left">
              <p className="text-xs text-gray-500">다운로드</p>
              <p className="text-base font-bold">App Store</p>
            </div>
          </a>

          {/* Google Play */}
          <a
            href="#"
            className="flex items-center gap-4 px-8 py-4 rounded-2xl bg-white/10 backdrop-blur text-white font-semibold border border-white/20 hover:bg-white/20 transition-colors shadow-xl"
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.18 23.76c.34.19.75.2 1.11.02l12.09-6.87-2.73-2.76-10.47 9.61zM.35 1.33A1.52 1.52 0 0 0 0 2.35v19.3c0 .38.13.72.35 1.02l.1.09 10.81-10.81v-.26L.45 1.24l-.1.09zm20.49 9.01-2.87-1.63-3.03 3.04 3.03 3.03 2.9-1.65c.83-.47.83-1.32-.03-1.79zm-17.66 12.1l10.48-9.62-2.73-2.76-7.75 12.38z" />
            </svg>
            <div className="text-left">
              <p className="text-xs text-purple-200">다운로드</p>
              <p className="text-base font-bold">Google Play</p>
            </div>
          </a>
        </div>

        <p className="mt-8 text-purple-300 text-sm">
          iOS 15+ · Android 8.0+ 지원 · 무료 다운로드
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-14">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* 브랜드 */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center text-white text-sm font-bold">
                ★
              </div>
              <span className="text-xl font-bold text-white">
                Tour<span className="text-purple-400">Star</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs text-gray-500">
              AI 기반 맞춤형 여행 플래너 TourStar. 당신만의 특별한 여행을 설계합니다.
            </p>
          </div>

          {/* 서비스 */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">서비스</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li><a href="#features" className="hover:text-purple-400 transition-colors">기능 소개</a></li>
              <li><a href="#app" className="hover:text-purple-400 transition-colors">앱 미리보기</a></li>
              <li><a href="#download" className="hover:text-purple-400 transition-colors">다운로드</a></li>
            </ul>
          </div>

          {/* 회사 */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">회사</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li><a href="#" className="hover:text-purple-400 transition-colors">회사 소개</a></li>
              <li><a href="#notices" className="hover:text-purple-400 transition-colors">공지사항</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">개인정보처리방침</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">이용약관</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
          <p>© 2026 TourStar. All rights reserved.</p>
          <p>사업자등록번호: 000-00-00000 · 대표: 홍길동 · 문의: contact@kroaddy.site</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   메인 페이지
───────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <AppPreview />
        <Notices />
        <Download />
      </main>
      <Footer />
    </>
  );
}
