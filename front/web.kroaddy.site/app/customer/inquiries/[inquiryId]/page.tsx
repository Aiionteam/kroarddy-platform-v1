"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";
import { useTranslation } from "react-i18next";
import { dateLocaleForI18n } from "@/lib/i18n/dateLocale";

type StoredInquiry = {
  id: string;
  title: string;
  content: string;
  fileNames: string[];
  agree: boolean;
  createdAt: number;
  status: "pending" | "answered";
  answer?: string;
};

function normalizeStatus(status: string): "pending" | "answered" {
  return status === "답변완료" || status === "answered" ? "answered" : "pending";
}

function formatDate(ts: number, locale: string) {
  try {
    return new Date(ts).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export default function InquiryDetailPage() {
  const router = useRouter();
  const params = useParams<{ inquiryId: string }>();
  const { isAuthenticated, logout } = useLoginStore();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocaleForI18n(i18n.language);
  const seedInquiries = React.useMemo<StoredInquiry[]>(
    () => [
      {
        id: "10001",
        title: t("customer.inquiries.seed.10001.title", { defaultValue: "로그인이 되지 않을 때" }),
        content: t("customer.inquiries.seed.10001.content", {
          defaultValue: "로그인 버튼을 눌러도 페이지가 로딩만 되고 로그인이 안 됩니다.\n브라우저 캐시를 지워도 동일해요.",
        }),
        fileNames: [],
        agree: true,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
        status: "pending",
      },
      {
        id: "10002",
        title: t("customer.inquiries.seed.10002.title", { defaultValue: "공지사항 확인 경로 문의" }),
        content: t("customer.inquiries.seed.10002.content", { defaultValue: "공지 및 업데이트 내용을 어디에서 확인할 수 있나요?" }),
        fileNames: ["screenshot.png"],
        agree: true,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
        status: "answered",
        answer: t("customer.inquiries.seed.10002.answer", { defaultValue: "고객센터의 ‘공지사항’ 카테고리에서 최신 변경사항을 확인할 수 있어요." }),
      },
    ],
    [t]
  );

  const inquiryId = params?.inquiryId;
  const [inquiry, setInquiry] = React.useState<StoredInquiry | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (!inquiryId) return;

    try {
      const raw = window.localStorage.getItem("customer_inquiries");
      const list: StoredInquiry[] = raw
        ? (JSON.parse(raw) as StoredInquiry[]).map((it) => ({
            ...it,
            status: normalizeStatus(String(it.status)),
          }))
        : [];
      const found = list.find((it) => it.id === inquiryId) ?? seedInquiries.find((it) => it.id === inquiryId) ?? null;
      setInquiry(found);
    } catch {
      const found = seedInquiries.find((it) => it.id === inquiryId) ?? null;
      setInquiry(found);
    }
  }, [isAuthenticated, inquiryId, seedInquiries]);

  if (!isAuthenticated) return null;

  if (!inquiry) {
    return (
      <AppLayout onLogout={logout} mobileTitle={t("customer.inquiries.detail.mobile_title", { defaultValue: "문의 상세" })}>
        <main className="flex flex-1 flex-col overflow-y-auto">
          <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-800">{t("customer.inquiries.detail.title", { defaultValue: "문의 상세" })}</h1>
              <button
                type="button"
                onClick={() => router.push("/customer/inquiries")}
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                {t("customer.inquiries.detail.back_to_list", { defaultValue: "목록으로" })}
              </button>
            </div>
          </header>
          <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <p className="text-sm text-gray-500">{t("customer.inquiries.detail.not_found", { defaultValue: "해당 문의를 찾을 수 없습니다." })}</p>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout onLogout={logout} mobileTitle={t("customer.inquiries.detail.mobile_title", { defaultValue: "문의 상세" })}>
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-800">{t("customer.inquiries.detail.title", { defaultValue: "문의 상세" })}</h1>
            <button
              type="button"
              onClick={() => router.push("/customer/inquiries")}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              {t("customer.inquiries.detail.back_to_list", { defaultValue: "목록으로" })}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t("customer.inquiries.detail.received_at", { date: formatDate(inquiry.createdAt, dateLocale), defaultValue: "접수일: {{date}}" })}</p>
        </header>

        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-gray-900">{inquiry.title}</h2>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      inquiry.status === "answered" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {inquiry.status === "answered"
                      ? t("customer.inquiries.status.answered", { defaultValue: "답변완료" })
                      : t("customer.inquiries.status.pending", { defaultValue: "처리중" })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-800">{t("customer.inquiries.detail.content", { defaultValue: "문의내용" })}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{inquiry.content}</p>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-800">{t("customer.inquiries.detail.attachments", { defaultValue: "첨부파일" })}</h3>
              {inquiry.fileNames.length ? (
                <ul className="mt-2 list-inside list-disc text-sm text-gray-700">
                  {inquiry.fileNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">{t("customer.inquiries.detail.no_attachments", { defaultValue: "첨부파일이 없습니다." })}</p>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">{t("customer.inquiries.detail.answer", { defaultValue: "답변" })}</h3>
              {inquiry.status === "answered" && inquiry.answer ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{inquiry.answer}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">{t("customer.inquiries.detail.answer_pending", { defaultValue: "현재 답변 준비 중입니다. 조금만 기다려 주세요." })}</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

