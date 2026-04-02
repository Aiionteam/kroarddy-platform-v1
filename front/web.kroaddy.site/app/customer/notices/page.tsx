"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";

type NoticeType = "점검" | "배포" | "업데이트";

type Notice = {
  id: number;
  type: NoticeType;
  title: string;
  author: string;
  createdAt: number; // epoch ms
  views: number;
  isNew?: boolean;
  content: string;
};

const SEED_NOTICES: Notice[] = [
  {
    id: 7,
    type: "배포",
    title: "v1.0.3 배포 안내 (성능 개선 및 버그 수정)",
    author: "운영팀",
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
    views: 52,
    isNew: true,
    content:
      "이번 배포에서는 화면 로딩 속도 개선과 일부 오류 수정이 포함되어 있습니다.\n업데이트 후에도 문제가 지속되면 고객센터로 문의해 주세요.",
  },
  {
    id: 6,
    type: "점검",
    title: "서버 정기 점검 안내 (예정)",
    author: "운영팀",
    createdAt: Date.now() - 1000 * 60 * 60 * 28,
    views: 18,
    content:
      "정기 점검으로 인해 일부 기능이 일시 중단될 수 있습니다.\n점검 시간 및 영향 범위는 공지 하단을 확인해 주세요.",
  },
  {
    id: 5,
    type: "업데이트",
    title: "공지사항 필터 기능 업데이트 안내",
    author: "운영팀",
    createdAt: Date.now() - 1000 * 60 * 60 * 52,
    views: 31,
    content:
      "공지사항 화면에서 유형/검색 필터가 적용됩니다.\n보다 빠르게 필요한 공지를 찾을 수 있어요.",
  },
  {
    id: 4,
    type: "점검",
    title: "점검사항: 일부 이미지 업로드 지연 해결",
    author: "운영팀",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    views: 24,
    content:
      "특정 환경에서 이미지 업로드가 지연되던 이슈를 수정했습니다.\n재시도 후에도 문제가 있으면 문의해 주세요.",
  },
  {
    id: 3,
    type: "배포",
    title: "v1.0.2 배포 안내 (문의하기 UX 개선)",
    author: "운영팀",
    createdAt: Date.now() - 1000 * 60 * 60 * 96,
    views: 44,
    content:
      "문의하기/문의 내역 UI 탭 전환이 추가되었습니다.\n보다 편리하게 내 문의를 확인할 수 있습니다.",
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

export default function NoticesPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [selectedNotice, setSelectedNotice] = React.useState<Notice | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const normalized = query.trim().toLowerCase();
  const filtered = SEED_NOTICES.filter((n) => {
    if (!normalized) return true;
    return n.title.toLowerCase().includes(normalized) || n.content.toLowerCase().includes(normalized);
  });

  const allSelected = filtered.length > 0 && filtered.every((n) => selectedIds.has(n.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((n) => n.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout onLogout={logout} mobileTitle="공지사항">
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                aria-label="뒤로가기"
              >
                ←
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">공지사항</h1>
                <p className="mt-1 text-sm text-gray-500">공지사항을 확인하세요.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => alert("추후 ‘새 공지사항 작성’ 기능을 추가할게요.")}
              className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
            >
              새 공지사항 작성
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="공지사항 검색 (제목/내용)"
                    className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => {}}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    검색
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>총 {filtered.length}건</span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="전체선택"
                      />
                    </th>
                    <th className="w-20 px-3 py-3 font-semibold text-gray-700">번호</th>
                    <th className="px-3 py-3 font-semibold text-gray-700">제목</th>
                    <th className="w-28 px-3 py-3 font-semibold text-gray-700">작성자</th>
                    <th className="w-32 px-3 py-3 font-semibold text-gray-700">작성일</th>
                    <th className="w-20 px-3 py-3 font-semibold text-gray-700">조회</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(n.id)}
                          onChange={() => toggleOne(n.id)}
                          aria-label={`공지 ${n.id} 선택`}
                        />
                      </td>
                      <td className="px-3 py-3 text-gray-700">{n.id}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedNotice(n)}
                          className="group flex items-center gap-2 text-left"
                        >
                          <span className="min-w-0 truncate font-semibold text-gray-900 group-hover:underline">
                            {n.title}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{n.author}</td>
                      <td className="px-3 py-3 text-gray-700">{formatDate(n.createdAt)}</td>
                      <td className="px-3 py-3 text-gray-700">{n.views}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                1
              </button>
              <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                2
              </button>
              <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                3
              </button>
            </div>
          </section>
        </div>

        {selectedNotice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
                <div className="min-w-0">
                  <h2 className="mt-2 truncate text-lg font-bold text-gray-900">{selectedNotice.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    작성자 {selectedNotice.author} · {formatDate(selectedNotice.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotice(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  닫기
                </button>
              </div>
              <div className="p-5">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">{selectedNotice.content}</pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}

