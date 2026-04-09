"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";
import { useTranslation } from "react-i18next";

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
  { id: "inquiry", icon: <QuestionIcon /> },
  { id: "guide", icon: <GuideIcon /> },
  { id: "notices", icon: <BellIcon /> },
  { id: "payment", icon: <CardIcon /> },
  { id: "emergency", icon: <EmergencyIcon /> },
] as const;

const TEMP_FAQ_IDS = [
  "login_help",
  "first_steps",
  "update_notes",
  "refund_flow",
  "emergency_help",
] as const;

export default function CustomerPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");

  const faqs = React.useMemo(() => {
    return TEMP_FAQ_IDS.map((id) => {
      const keyBase = `customer.faq.items.${id}` as const;
      return {
        id,
        category: t(`${keyBase}.category`, { defaultValue: "문의사항" }),
        question: t(`${keyBase}.question`, { defaultValue: "질문" }),
        answer: t(`${keyBase}.answer`, { defaultValue: "답변" }),
      };
    });
  }, [t]);

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredFaqs = faqs.filter((faq) => {
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
          <h1 className="text-xl font-bold text-gray-800">
            {t("customer.center.title", { defaultValue: "고객센터" })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("customer.center.subtitle", { defaultValue: "원하는 도움을 빠르게 찾아보세요." })}
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label htmlFor="customer-search" className="mb-2 block text-sm font-semibold text-gray-700">
              {t("customer.search.label", { defaultValue: "무엇을 도와드릴까요?" })}
            </label>
            <input
              id="customer-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("customer.search.placeholder", { defaultValue: "검색어를 입력해 주세요" })}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </section>

          <section className="mt-6">
            <h2 className="text-base font-semibold text-gray-800">
              {t("customer.categories.title", { defaultValue: "카테고리" })}
            </h2>
            <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2">
              {CUSTOMER_CATEGORIES.map((category, idx) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    if (category.id === "inquiry") router.push("/customer/inquiry");
                    if (category.id === "notices") router.push("/customer/notices");
                    if (category.id === "emergency") router.push("/customer/emergency");
                    if (category.id === "payment") router.push("/customer/subscription");
                    if (category.id === "guide") router.push("/customer/guide");
                  }}
                  className={`rounded-2xl border border-gray-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-purple-300 hover:bg-purple-50 ${idx === 0 ? "sm:col-span-2" : ""}`}
                >
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="shrink-0">{category.icon}</span>
                    <p className="text-base font-semibold text-gray-800">
                      {t(`customer.categories.items.${category.id}.title`, {
                        defaultValue:
                          category.id === "inquiry"
                            ? "문의사항"
                            : category.id === "guide"
                              ? "이용가이드"
                              : category.id === "notices"
                                ? "공지사항"
                                : category.id === "payment"
                                  ? "결제 및 서비스 이용"
                                  : "긴급 도움 및 여행 팁",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {t(`customer.categories.items.${category.id}.desc`, {
                      defaultValue:
                        category.id === "inquiry"
                          ? "계정, 기능, 오류 등 일반 문의"
                          : category.id === "guide"
                            ? "서비스 사용 방법과 시작 가이드"
                            : category.id === "notices"
                              ? "점검, 배포, 변경사항 안내"
                              : category.id === "payment"
                                ? "결제, 환불, 구독 관련 안내"
                                : "긴급 상황 대응과 여행 팁",
                    })}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                {t("customer.faq.title", { defaultValue: "자주 묻는 질문" })}
              </h2>
              <span className="text-xs text-gray-500">
                {t("customer.faq.count", { count: filteredFaqs.length, defaultValue: "{{count}}건" })}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {filteredFaqs.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("customer.faq.no_results", { defaultValue: "검색 결과가 없습니다." })}
                </p>
              ) : (
                filteredFaqs.map((faq) => (
                  <article key={faq.id} className="rounded-xl border border-gray-200 px-4 py-4">
                    <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      {t(`customer.faq.items.${faq.id}.category`, { defaultValue: faq.category })}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-gray-800">
                      {t(`customer.faq.items.${faq.id}.question`, { defaultValue: faq.question })}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {t(`customer.faq.items.${faq.id}.answer`, { defaultValue: faq.answer })}
                    </p>
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
