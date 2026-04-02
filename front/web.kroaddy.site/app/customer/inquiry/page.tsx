"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function InquiryPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = React.useState<"write" | "list">(initialTab === "list" ? "list" : "write");

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [agree, setAgree] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

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

  const normalizedSearch = query.trim().toLowerCase();
  const filteredInquiries = inquiries.filter((it) => {
    if (!normalizedSearch) return true;
    return (
      it.title.toLowerCase().includes(normalizedSearch) ||
      it.content.toLowerCase().includes(normalizedSearch) ||
      it.status.toLowerCase().includes(normalizedSearch)
    );
  });

  const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const images = list.filter((f) => /^image\/(gif|png|jpe?g)$/i.test(f.type)).slice(0, 3);
    setFiles(images);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);

    const fileNames = files.map((f) => f.name).slice(0, 3);
    const newInquiry: StoredInquiry = {
      id: `${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      fileNames,
      agree,
      createdAt: Date.now(),
      status: "처리중",
    };

    try {
      const key = "customer_inquiries";
      const raw = window.localStorage.getItem(key);
      const prev: StoredInquiry[] = raw ? (JSON.parse(raw) as StoredInquiry[]) : [];
      const next = [newInquiry, ...prev].slice(0, 200);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // 저장 실패해도 UX는 진행합니다.
    }

    alert("문의가 접수되었습니다. 빠르게 답변드릴게요!");
    router.push(`/customer/inquiries/${newInquiry.id}`);
  };

  return (
    <AppLayout onLogout={logout} mobileTitle={tab === "write" ? "1:1 문의하기" : "나의 문의 내역"}>
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                aria-label="뒤로가기"
              >
                ←
              </button>
              <h1 className="text-xl font-bold text-gray-800">문의하기</h1>
            </div>

            <div className="flex items-end gap-6">
              <button
                type="button"
                onClick={() => setTab("write")}
                className={`pb-2 text-sm font-semibold ${tab === "write" ? "border-b-2 border-black text-black" : "text-gray-500"
                  }`}
              >
                1:1 문의하기
              </button>
              <button
                type="button"
                onClick={() => setTab("list")}
                className={`pb-2 text-sm font-semibold ${tab === "list" ? "border-b-2 border-black text-black" : "text-gray-500"
                  }`}
              >
                나의 문의 내역
              </button>
            </div>
          </div>
        </header>

        {tab === "write" ? (
          <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl px-6 py-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700">제목</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700">문의내용</span>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="상세 내용을 입력해 주세요"
                    rows={8}
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </label>

                <div>
                  <span className="mb-1 block text-sm font-semibold text-gray-700">첨부파일</span>
                  <div className="flex items-center gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <label
                        key={i}
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-purple-300"
                      >
                        {files[i] ? (
                          <img
                            src={URL.createObjectURL(files[i])}
                            alt="preview"
                            className="h-full w-full rounded-lg object-cover"
                          />
                        ) : (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M8 13l3-3 4 5 2-2 2 3H5z" />
                          </svg>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={onSelectFiles} />
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    이미지 파일(GIF, PNG, JPG) 기준 최대 10MB 이하, 최대 3개 가능
                  </p>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">개인정보 수집 및 이용 동의</span>
                </label>

                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!agree || submitting}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-teal-700"
                  >
                    {submitting ? "전송 중..." : "작성 완료"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 py-8">
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
              {filteredInquiries.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <div className="grid gap-3">
                  {filteredInquiries.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => router.push(`/customer/inquiries/${it.id}`)}
                      className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-300 hover:bg-purple-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-gray-800">{it.title}</h2>
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{it.content}</p>
                        </div>
                        <div className="shrink-0">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${it.status === "답변완료"
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
        )}
      </main>
    </AppLayout>
  );
}
