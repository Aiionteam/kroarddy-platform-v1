"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";

function QuestionIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.24 1.77c-.68.67-1.24 1.1-1.24 2.23" /><circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" /></svg>;
}
function GuideIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" /></svg>;
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
}
function CardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>;
}
function EmergencyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 3.5L3.8 15a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.5 3.5a1.5 1.5 0 0 0-3 0z" /><path d="M12 8v4.5" /><circle cx="12" cy="15.5" r=".8" fill="currentColor" stroke="none" /></svg>;
}

const CUSTOMER_CATEGORIES = [
  { title: "문의사항", description: "계정, 기능, 오류 등 일반 문의", icon: <QuestionIcon /> },
  { title: "이용가이드", description: "서비스 사용 방법과 시작 가이드", icon: <GuideIcon /> },
  { title: "공지사항", description: "점검, 배포, 변경사항 안내", icon: <BellIcon /> },
  { title: "결제 및 서비스 이용", description: "결제, 환불, 구독 관련 안내", icon: <CardIcon /> },
  { title: "긴급 도움 및 여행 팁", description: "긴급 상황 대응과 여행 팁", icon: <EmergencyIcon /> },
] as const;

const TEMP_FAQS = [
  {
    category: "문의사항",
    question: "로그인이 되지 않을 때 어떻게 해야 하나요?",
    answer: "앱을 새로고침한 뒤 다시 시도해 주세요. 계속 실패하면 고객센터로 문의해 주세요.",
  },
  {
    category: "이용가이드",
    question: "처음 사용하는데 어떤 기능부터 보면 좋나요?",
    answer: "홈에서 여행 플래너와 장소 추천을 먼저 확인한 뒤, 일정 관리 기능을 사용해 보세요.",
  },
  {
    category: "공지사항",
    question: "업데이트 내용은 어디서 확인하나요?",
    answer: "고객센터의 공지사항 카테고리에서 최신 변경사항을 확인할 수 있습니다.",
  },
  {
    category: "결제 및 서비스 이용",
    question: "결제 취소(환불)는 어떻게 진행되나요?",
    answer: "결제 내역과 주문번호를 포함해 문의사항으로 접수해 주시면 순차적으로 안내해 드립니다.",
  },
  {
    category: "긴급 도움 및 여행 팁",
    question: "여행 중 긴급 상황에서 어떤 도움을 받을 수 있나요?",
    answer: "긴급 연락처 및 기본 대응 가이드를 우선 확인하고, 필요 시 고객센터로 즉시 연락해 주세요.",
  },
] as const;

export default function CustomerPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredFaqs = TEMP_FAQS.filter((faq) => {
    if (!normalizedSearch) return true;
    return (
      faq.category.toLowerCase().includes(normalizedSearch) ||
      faq.question.toLowerCase().includes(normalizedSearch) ||
      faq.answer.toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <AppLayout onLogout={logout}>
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <h1 className="text-xl font-bold text-gray-800">고객센터</h1>
          <p className="mt-1 text-sm text-gray-500">원하는 도움을 빠르게 찾아보세요.</p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label htmlFor="customer-search" className="mb-2 block text-sm font-semibold text-gray-700">
              무엇을 도와드릴까요?
            </label>
            <input
              id="customer-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색어를 입력해 주세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </section>

          <section className="mt-6">
            <h2 className="text-base font-semibold text-gray-800">카테고리</h2>
            <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2">
              {CUSTOMER_CATEGORIES.map((category, idx) => (
                <button
                  key={category.title}
                  type="button"
                  onClick={() => {
                    if (category.title === "문의사항") router.push("/customer/inquiry");
                    if (category.title === "공지사항") router.push("/customer/notices");
                    if (category.title === "긴급 도움 및 여행 팁") router.push("/customer/emergency");
                    if (category.title === "결제 및 서비스 이용") router.push("/customer/subscription");
                    if (category.title === "이용가이드") router.push("/customer/guide");
                  }}
                  className={`rounded-2xl border border-gray-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-purple-300 hover:bg-purple-50 ${idx === 0 ? "sm:col-span-2" : ""}`}
                >
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="shrink-0">{category.icon}</span>
                    <p className="text-base font-semibold text-gray-800">{category.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{category.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">자주 묻는 질문</h2>
              <span className="text-xs text-gray-500">{filteredFaqs.length}건</span>
            </div>

            <div className="mt-4 space-y-3">
              {filteredFaqs.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  검색 결과가 없습니다.
                </p>
              ) : (
                filteredFaqs.map((faq) => (
                  <article key={faq.question} className="rounded-xl border border-gray-200 px-4 py-4">
                    <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      {faq.category}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-gray-800">{faq.question}</h3>
                    <p className="mt-1 text-sm text-gray-600">{faq.answer}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
