"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import {
  listFriends,
  listPendingFriendRequests,
  acceptFriendRequest,
  removeFriend,
  type FriendsResponse,
} from "@/lib/api/friends";
import { sendWhisper } from "@/lib/api/whisper";
import { blockUser } from "@/lib/api/block";
import type { UserModel } from "@/lib/api/user";
import { AppSidebar } from "@/components/organisms/AppSidebar";

const ROOM_LABELS: Record<string, string> = {
  SILVER: "실버",
  GOLD: "골드",
  PLATINUM: "플래티넘",
  DIAMOND: "다이아",
};

function toUserList(data: FriendsResponse["data"]): UserModel[] {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

interface WhisperModal {
  toUserId: number;
  toName: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout, restoreAuthState } = useLoginStore();
  const [friends, setFriends] = useState<UserModel[]>([]);
  const [pending, setPending] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // 귓속말 모달
  const [whisperTarget, setWhisperTarget] = useState<WhisperModal | null>(null);
  const [whisperText, setWhisperText] = useState("");
  const [sendingWhisper, setSendingWhisper] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!accessToken) return;
    setLoading(true);
    setMessage(null);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        listFriends(),
        listPendingFriendRequests(),
      ]);
      if (friendsRes.code === 200) setFriends(toUserList(friendsRes.data));
      if (pendingRes.code === 200) setPending(toUserList(pendingRes.data));
      if (friendsRes.code !== 200 && friendsRes.message)
        setMessage({ type: "err", text: friendsRes.message });
    } catch (_) {
      setMessage({ type: "err", text: "목록을 불러올 수 없습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated]);

  const handleAccept = async (fromUserId: number) => {
    setAcceptingId(fromUserId);
    setMessage(null);
    try {
      const res = await acceptFriendRequest(fromUserId);
      if (res.code === 200) {
        setMessage({ type: "ok", text: "친구 요청을 수락했습니다." });
        await load();
      } else {
        setMessage({ type: "err", text: res.message ?? "수락에 실패했습니다." });
      }
    } catch (_) {
      setMessage({ type: "err", text: "수락 처리에 실패했습니다." });
    } finally {
      setAcceptingId(null);
    }
  };

  const openWhisper = (friend: UserModel) => {
    setWhisperTarget({
      toUserId: Number(friend.id),
      toName: friend.nickname || friend.name || `사용자 ${friend.id}`,
    });
    setWhisperText("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const closeWhisper = () => {
    setWhisperTarget(null);
    setWhisperText("");
  };

  const handleRemoveFriend = async (friend: UserModel) => {
    const id = Number(friend.id);
    const name = friend.nickname || friend.name || `사용자 ${friend.id}`;
    if (!window.confirm(`${name}님을 친구 목록에서 삭제하시겠습니까?`)) return;
    setRemovingId(id);
    try {
      const res = await removeFriend(id);
      if (res.code === 200) {
        setMessage({ type: "ok", text: `${name}님을 친구 목록에서 삭제했습니다.` });
        setFriends((prev) => prev.filter((f) => Number(f.id) !== id));
      } else {
        setMessage({ type: "err", text: res.message ?? "친구 삭제에 실패했습니다." });
      }
    } catch (_) {
      setMessage({ type: "err", text: "친구 삭제에 실패했습니다." });
    } finally {
      setRemovingId(null);
    }
  };

  const handleBlock = async (friend: UserModel) => {
    const id = Number(friend.id);
    const name = friend.nickname || friend.name || `사용자 ${friend.id}`;
    if (!window.confirm(`${name}님을 차단하시겠습니까?\n차단 시 친구 목록에서도 제거되며 귓속말을 받지 않습니다.`)) return;
    setBlockingId(id);
    // 즉시 UI에서 제거
    setFriends((prev) => prev.filter((f) => Number(f.id) !== id));
    try {
      const res = await blockUser(id);
      if (res.code === 200) {
        setMessage({ type: "ok", text: `${name}님을 차단했습니다.` });
      } else {
        // 실패 시 롤백
        await load();
        setMessage({ type: "err", text: res.message ?? "차단에 실패했습니다." });
      }
    } catch (_) {
      await load();
      setMessage({ type: "err", text: "차단에 실패했습니다." });
    } finally {
      setBlockingId(null);
    }
  };

  const handleSendWhisper = async () => {
    if (!whisperTarget || !whisperText.trim()) return;
    setSendingWhisper(true);
    try {
      const res = await sendWhisper(whisperTarget.toUserId, whisperText.trim());
      if (res.code === 200) {
        setMessage({ type: "ok", text: `${whisperTarget.toName}님께 귓속말을 보냈습니다.` });
        closeWhisper();
      } else {
        setMessage({ type: "err", text: res.message ?? "귓속말 전송에 실패했습니다." });
      }
    } catch (_) {
      setMessage({ type: "err", text: "귓속말 전송에 실패했습니다." });
    } finally {
      setSendingWhisper(false);
    }
  };

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">친구 목록</h1>
          <button
            type="button"
            onClick={() => router.push("/chat/whisper")}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            귓속말함
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {message && (
            <p
              className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                message.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {message.text}
            </p>
          )}
          {loading ? (
            <p className="text-gray-500">불러오는 중...</p>
          ) : (
            <>
              <section className="mb-8">
                <h2 className="mb-3 text-base font-medium text-gray-700">친구 ({friends.length})</h2>
                {friends.length === 0 ? (
                  <p className="text-sm text-gray-500">추가된 친구가 없습니다. 단체채팅에서 메시지를 클릭해 친구추가를 요청해 보세요.</p>
                ) : (
                  <ul className="space-y-2">
                    {friends.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3"
                      >
                        <div>
                          <span className="font-medium text-gray-800">
                            {u.nickname || u.name || `사용자 ${u.id}`}
                          </span>
                          {u.tier && (
                            <span className="ml-2 text-xs text-gray-500">
                              {ROOM_LABELS[u.tier] ?? u.tier}
                            </span>
                          )}
                          {u.honor != null && (
                            <span className="ml-2 text-xs text-gray-400">명예도 {u.honor}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openWhisper(u)}
                            className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            귓속말
                          </button>
                          <button
                            type="button"
                            disabled={removingId === Number(u.id)}
                            onClick={() => handleRemoveFriend(u)}
                            title="친구 삭제"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            disabled={blockingId === Number(u.id)}
                            onClick={() => handleBlock(u)}
                            title="사용자 차단"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h2 className="mb-3 text-base font-medium text-gray-700">받은 친구 요청 ({pending.length})</h2>
                {pending.length === 0 ? (
                  <p className="text-sm text-gray-500">대기 중인 요청이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/30 px-4 py-3"
                      >
                        <div>
                          <span className="font-medium text-gray-800">
                            {u.nickname || u.name || `사용자 ${u.id}`}
                          </span>
                          {u.tier && (
                            <span className="ml-2 text-xs text-gray-500">
                              {ROOM_LABELS[u.tier] ?? u.tier}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={acceptingId === u.id}
                          onClick={() => handleAccept(Number(u.id))}
                          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {acceptingId === u.id ? "처리 중..." : "수락"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* 귓속말 전송 모달 */}
      {whisperTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeWhisper(); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                <span className="text-purple-600">{whisperTarget.toName}</span>님께 귓속말
              </h2>
              <button
                type="button"
                onClick={closeWhisper}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={whisperText}
              onChange={(e) => setWhisperText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSendWhisper();
              }}
              placeholder="귓속말 내용을 입력하세요..."
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{whisperText.length} / 500 · Ctrl+Enter로 전송</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeWhisper}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSendWhisper}
                disabled={sendingWhisper || !whisperText.trim()}
                className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {sendingWhisper ? "전송 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
