"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import {
  listFriends,
  listPendingFriendRequests,
  acceptFriendRequest,
  type FriendsResponse,
} from "@/lib/api/friends";
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

export default function FriendsPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout, restoreAuthState } = useLoginStore();
  const [friends, setFriends] = useState<UserModel[]>([]);
  const [pending, setPending] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
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

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">친구 목록</h1>
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
    </div>
  );
}
