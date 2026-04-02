"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";

type StoredInquiry = {
  id: string;
  title: string;
  content: string;
  fileNames: string[];
  agree: boolean;
  createdAt: number;
  status: "처리중" | "답변완료";
  answer?: string;
};

const SEED_INQUIRIES: StoredInquiry[] = [
  {
    id: "10001",
    title: "로그인이 되지 않을 때",
    content: "로그인 버튼을 눌러도 페이지가 로딩만 되고 로그인이 안 됩니다.\n브라우저 캐시를 지워도 동일해요.",
    fileNames: [],
    agree: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    status: "처리중",
  },
  {
    id: "10002",
    title: "공지사항 확인 경로 문의",
    content: "공지 및 업데이트 내용을 어디에서 확인할 수 있나요?",
    fileNames: ["screenshot.png"],
    agree: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    status: "답변완료",
    answer: "고객센터의 ‘공지사항’ 카테고리에서 최신 변경사항을 확인할 수 있어요.",
  },
];

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString("ko-KR", {
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

export default function InquiriesPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();
  const [inquiries, setInquiries] = React.useState<StoredInquiry[]>(SEED_INQUIRIES);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const raw = window.localStorage.getItem("customer_inquiries");
      const list: StoredInquiry[] = raw ? (JSON.parse(raw) as StoredInquiry[]) : [];
      if (list.length) setInquiries(list);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const normalized = query.trim().toLowerCase();
  const filtered = inquiries.filter((it) => {
    if (!normalized) return true;
    return (
      it.title.toLowerCase().includes(normalized) ||
      it.content.toLowerCase().includes(normalized) ||
      it.status.toLowerCase().includes(normalized)
    );
  });

  return (
    <AppLayout onLogout={logout} mobileTitle="나의 문의 내역">
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-800">나의 문의 내역</h1>
            <div className="flex items-end gap-6">
              <button
                type="button"
                onClick={() => router.push("/customer/inquiry")}
                className="pb-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                1:1 문의하기
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="pb-2 text-sm font-semibold border-b-2 border-black text-black"
              >
                나의 문의 내역
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">문의 상태와 답변 내용을 확인하세요.</p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label htmlFor="inquiry-search" className="mb-2 block text-sm font-semibold text-gray-700">
              검색
            </label>
            <input
              id="inquiry-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목/내용/상태를 검색하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </section>

          <section className="mt-6">
            {filtered.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                검색 결과가 없습니다.
              </p>
            ) : (
              <div className="grid gap-3">
                {filtered.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => router.push(`/customer/inquiries/${it.id}`)}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-300 hover:bg-purple-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-gray-800">{it.title}</h2>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">{it.content}</p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            it.status === "답변완료"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {it.status === "답변완료" ? "답변완료" : "처리중"}
                        </span>
                        <div className="mt-2 text-right text-xs text-gray-500">{formatDate(it.createdAt)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

