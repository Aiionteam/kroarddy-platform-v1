"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import {
  getConversationList,
  getConversation,
  sendWhisper,
  markConversationRead,
  deleteConversation,
  type WhisperModel,
  type WhisperConversationSummary,
} from "@/lib/api/whisper";
import { listFriends, type FriendsResponse } from "@/lib/api/friends";
import { blockUser, unblockUser, isBlocked } from "@/lib/api/block";
import type { UserModel } from "@/lib/api/user";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import { getTourstarSharePreview, type TourstarSharePreview } from "@/lib/api/tourstar";
import { extractTourstarPostIdFromMessage } from "@/lib/tourstar-share";
import { AppLayout } from "@/components/organisms/AppLayout";

function toConvList(data: any): WhisperConversationSummary[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
function toMsgList(data: any): WhisperModel[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
function toUserList(data: FriendsResponse["data"]): UserModel[] {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}
function fmtTime(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function WhisperPage() {
  const router = useRouter();
  const { isAuthenticated, logout, accessToken, restoreAuthState } = useLoginStore();
  const myId = getAppUserIdFromToken(accessToken ?? undefined);

  const [isHydrated, setIsHydrated] = useState(false);
  const [conversations, setConversations] = useState<WhisperConversationSummary[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [activePartnerName, setActivePartnerName] = useState("");
  const [messages, setMessages] = useState<WhisperModel[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(true);

  // 새 대화 시작 (친구 선택)
  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState<UserModel[]>([]);

  // 메시지 입력
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // 차단
  const [partnerBlocked, setPartnerBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [deletingConv, setDeletingConv] = useState(false);

  // 더보기 메뉴
  const [showMenu, setShowMenu] = useState(false);
  const [sharePreviewMap, setSharePreviewMap] = useState<Record<string, TourstarSharePreview | null>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsHydrated(true);
    restoreAuthState();
  }, [restoreAuthState]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { router.replace("/"); return; }
  }, [isHydrated, isAuthenticated, router]);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await getConversationList();
      if (res.code === 200) setConversations(toConvList(res.data));
    } catch (_) {}
    finally { setConvLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadConversations();
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    const postIds = Array.from(
      new Set(
        messages
          .map((msg) => extractTourstarPostIdFromMessage(msg.message ?? ""))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const missingIds = postIds.filter((id) => sharePreviewMap[id] === undefined);
    if (missingIds.length === 0) return;

    let cancelled = false;
    (async () => {
      await Promise.all(
        missingIds.map(async (postId) => {
          try {
            const preview = await getTourstarSharePreview(postId);
            if (!cancelled) {
              setSharePreviewMap((prev) => ({ ...prev, [postId]: preview }));
            }
          } catch (_) {
            if (!cancelled) {
              setSharePreviewMap((prev) => ({ ...prev, [postId]: null }));
            }
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, sharePreviewMap]);

  const openConversation = useCallback(async (partnerId: number, partnerName: string) => {
    setActivePartnerId(partnerId);
    setActivePartnerName(partnerName);
    setShowMenu(false);
    setMsgLoading(true);
    try {
      const [msgRes] = await Promise.all([
        getConversation(partnerId),
        markConversationRead(partnerId),
      ]);
      if (msgRes.code === 200) setMessages(toMsgList(msgRes.data));
      // 차단 여부 확인
      const blocked = await isBlocked(partnerId);
      setPartnerBlocked(blocked);
    } catch (_) {}
    finally {
      setMsgLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
    // 읽음 처리 후 대화 목록 갱신
    loadConversations();
  }, [loadConversations]);

  const handleSend = async () => {
    if (!activePartnerId || !inputText.trim() || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText("");
    try {
      await sendWhisper(activePartnerId, text);
      // 낙관적 업데이트
      const optimistic: WhisperModel = {
        fromUserId: myId ?? undefined,
        toUserId: activePartnerId,
        message: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      // 대화 목록 갱신
      loadConversations();
    } catch (_) {
      setInputText(text); // 실패 시 복원
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleBlock = async () => {
    if (!activePartnerId || blockLoading) return;
    setBlockLoading(true);
    try {
      if (partnerBlocked) {
        await unblockUser(activePartnerId);
        setPartnerBlocked(false);
      } else {
        await blockUser(activePartnerId);
        setPartnerBlocked(true);
      }
    } catch (_) {}
    finally { setBlockLoading(false); setShowMenu(false); }
  };

  const handleDeleteConversation = async () => {
    if (!activePartnerId || deletingConv) return;
    if (!window.confirm(`${activePartnerName}님과의 대화를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeletingConv(true);
    setShowMenu(false);
    try {
      await deleteConversation(activePartnerId);
      setMessages([]);
      setActivePartnerId(null);
      setActivePartnerName("");
      loadConversations();
    } catch (_) {}
    finally { setDeletingConv(false); }
  };

  const openNewChat = async () => {
    setShowNewChat(true);
    try {
      const res = await listFriends();
      if (res.code === 200) setFriends(toUserList(res.data));
    } catch (_) {}
  };

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      {/* ── 대화 목록 패널 ── */}
      <div className={`flex flex-col border-r border-gray-200 bg-white ${activePartnerId ? "hidden md:flex w-72" : "flex flex-1 md:flex-none md:w-72"}`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h1 className="text-base font-semibold text-gray-800">귓속말</h1>
          <button
            type="button"
            onClick={openNewChat}
            title="새 대화"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm text-gray-400">대화 없음</p>
              <button
                type="button"
                onClick={openNewChat}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700"
              >
                귓속말 보내기
              </button>
            </div>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c.partnerId}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.partnerId, c.partnerName)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${activePartnerId === c.partnerId ? "bg-purple-50" : ""}`}
                  >
                    {/* 아바타 */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-sm font-bold text-white">
                      {c.partnerName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-gray-800">{c.partnerName}</span>
                        <span className="shrink-0 text-[10px] text-gray-400">{fmtTime(c.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="truncate text-xs text-gray-500">{c.lastMessage}</p>
                        {c.unreadCount > 0 && (
                          <span className="ml-1 shrink-0 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── 대화 스레드 패널 ── */}
      {activePartnerId ? (
        <div className="flex flex-1 flex-col bg-white">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActivePartnerId(null)}
                className="md:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-sm font-bold text-white">
                {activePartnerName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{activePartnerName}</p>
                {partnerBlocked && (
                  <p className="text-[10px] text-red-500">차단된 사용자</p>
                )}
              </div>
            </div>
            {/* 더보기 메뉴 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    disabled={deletingConv}
                    onClick={handleDeleteConversation}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                    {deletingConv ? "삭제 중..." : "대화 삭제"}
                  </button>
                  <div className="mx-2 border-t border-gray-100" />
                  <button
                    type="button"
                    disabled={blockLoading}
                    onClick={handleBlock}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${partnerBlocked ? "text-gray-700 hover:bg-gray-50" : "text-orange-600 hover:bg-orange-50"}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    {blockLoading ? "처리 중..." : partnerBlocked ? "차단 해제" : "사용자 차단"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" onClick={() => setShowMenu(false)}>
            {msgLoading ? (
              <div className="flex justify-center pt-8">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-gray-400 pt-12">
                {activePartnerName}님과의 대화를 시작해보세요
              </p>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.fromUserId === myId;
                const sharedPostId = extractTourstarPostIdFromMessage(msg.message ?? "");
                const sharedPreview = sharedPostId ? sharePreviewMap[sharedPostId] : null;
                return (
                  <div key={msg.id ?? i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-xs font-bold text-white self-end">
                        {activePartnerName.charAt(0)}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                          isMe
                            ? "rounded-br-sm bg-purple-600 text-white"
                            : "rounded-bl-sm bg-gray-100 text-gray-800"
                        }`}
                      >
                        {sharedPostId && sharedPreview ? (
                          <a
                            href={`/tourstar?postId=${encodeURIComponent(sharedPostId)}`}
                            className={`block overflow-hidden rounded-lg border ${
                              isMe
                                ? "border-purple-300 bg-white/10 hover:bg-white/20"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex">
                              <div
                                className="h-20 w-20 shrink-0 bg-cover bg-center bg-gray-200"
                                style={
                                  sharedPreview.thumbnail_url
                                    ? { backgroundImage: `url(${sharedPreview.thumbnail_url})` }
                                    : undefined
                                }
                              />
                              <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                                <p className={`truncate text-xs font-semibold ${isMe ? "text-white" : "text-gray-800"}`}>
                                  {sharedPreview.title}
                                </p>
                                <p className={`mt-0.5 truncate text-[11px] ${isMe ? "text-purple-100" : "text-gray-500"}`}>
                                  {sharedPreview.location}
                                </p>
                                <p className={`mt-1 text-[10px] ${isMe ? "text-purple-200" : "text-purple-600"}`}>
                                  Tourstar 게시글 보기
                                </p>
                              </div>
                            </div>
                          </a>
                        ) : (
                          msg.message
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{fmtTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="border-t border-gray-200 px-4 py-3">
            {partnerBlocked ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-500">
                차단된 사용자에게는 메시지를 보낼 수 없습니다.
                <button type="button" onClick={handleBlock} className="ml-2 underline">
                  차단 해제
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
                  rows={1}
                  maxLength={500}
                  className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  style={{ maxHeight: "120px", overflowY: "auto" }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !inputText.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50 gap-3">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-gray-400">대화를 선택하거나 새 귓속말을 보내보세요</p>
          <button
            type="button"
            onClick={openNewChat}
            className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm text-white hover:bg-purple-700"
          >
            + 새 귓속말
          </button>
        </div>
      )}

      {/* 새 대화 시작 모달 (친구 선택) */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewChat(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-800">새 귓속말</h2>
              <button
                type="button"
                onClick={() => setShowNewChat(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {friends.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  친구가 없습니다.{" "}
                  <button
                    type="button"
                    onClick={() => { setShowNewChat(false); router.push("/chat/friends"); }}
                    className="text-purple-600 underline"
                  >
                    친구 추가하기
                  </button>
                </div>
              ) : (
                friends.map((f) => {
                  const name = f.nickname || f.name || `사용자 ${f.id}`;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setShowNewChat(false);
                        openConversation(Number(f.id), name);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-purple-50 transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-sm font-bold text-white">
                        {name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-800">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
