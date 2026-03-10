"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { getWhisperInbox, getWhisperSent, type WhisperModel, type WhisperResponse } from "@/lib/api/whisper";
import { AppSidebar } from "@/components/organisms/AppSidebar";

function toList(data: WhisperResponse["data"]): WhisperModel[] {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

export default function WhisperPage() {
  const router = useRouter();
  const { isAuthenticated, logout, restoreAuthState } = useLoginStore();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<WhisperModel[]>([]);
  const [sent, setSent] = useState<WhisperModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    restoreAuthState();
  }, [restoreAuthState]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
  }, [isHydrated, isAuthenticated, router]);

  const load = async () => {
    setLoading(true);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        getWhisperInbox(50),
        getWhisperSent(50),
      ]);
      if (inboxRes.code === 200) setInbox(toList(inboxRes.data));
      if (sentRes.code === 200) setSent(toList(sentRes.data));
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated]);

  if (!isHydrated || !isAuthenticated) return null;

  const list = tab === "inbox" ? inbox : sent;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">귓속말</h1>
        </header>
        <div className="flex border-b border-gray-200 px-6">
          <button
            type="button"
            onClick={() => setTab("inbox")}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "inbox"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            받은 귓속말 ({inbox.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("sent")}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "sent"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            보낸 귓속말 ({sent.length})
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-gray-500">불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="text-gray-500">
              {tab === "inbox" ? "받은 귓속말이 없습니다." : "보낸 귓속말이 없습니다."}
            </p>
          ) : (
            <ul className="space-y-3">
              {list.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
                >
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                    {tab === "inbox" ? (
                      <span>보낸 사람: <strong className="text-gray-700">{w.fromUsername ?? `사용자 ${w.fromUserId}`}</strong></span>
                    ) : (
                      <span>받는 사람: <strong className="text-gray-700">{w.toUsername ?? `사용자 ${w.toUserId}`}</strong></span>
                    )}
                    {w.createdAt && (
                      <span>{new Date(w.createdAt).toLocaleString("ko-KR")}</span>
                    )}
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap break-words">{w.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
