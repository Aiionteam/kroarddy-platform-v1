"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { getUserIdFromToken, getEnsuredAccessToken } from "@/lib/api/auth";
import {
  getGroupChatRooms,
  getRecentGroupChatMessages,
  sendGroupChatMessage,
  type GroupChatMessage,
  type ChatRoomInfo,
} from "@/lib/api/groupchat";
import { voteHonor } from "@/lib/api/user";
import { sendFriendRequest } from "@/lib/api/friends";
import { sendWhisper } from "@/lib/api/whisper";
import { AppSidebar } from "@/components/organisms/AppSidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const ROOM_LABELS: Record<string, string> = {
  SILVER: "실버",
  GOLD: "골드",
  PLATINUM: "플래티넘",
  DIAMOND: "다이아",
};

/** API 404/오류 시 사용하는 기본 방 목록 (필요 명예도: 실버 0, 골드 100, 플래티넘 500, 다이아 1000) */
const FALLBACK_ROOMS: ChatRoomInfo[] = [
  { roomType: "SILVER", label: "실버", minHonor: 0, accessible: true },
  { roomType: "GOLD", label: "골드", minHonor: 100, accessible: true },
  { roomType: "PLATINUM", label: "플래티넘", minHonor: 500, accessible: true },
  { roomType: "DIAMOND", label: "다이아", minHonor: 1000, accessible: true },
];

export default function GroupChatPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout, restoreAuthState, setAccessToken } = useLoginStore();
  const [rooms, setRooms] = useState<ChatRoomInfo[] | null>(null);
  const [showRoomList, setShowRoomList] = useState(true);
  const [roomType, setRoomType] = useState<string>("SILVER");
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [whisperTarget, setWhisperTarget] = useState<{ userId: number; username: string } | null>(null);
  const [whisperText, setWhisperText] = useState("");
  const [whisperSending, setWhisperSending] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: number; username: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWasFocused = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastMessageIdRef = useRef<number>(0);

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

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getGroupChatRooms();
        if (!cancelled && res.code === 200 && Array.isArray(res.data)) {
          setRooms(res.data as ChatRoomInfo[]);
          return;
        }
      } catch (_) {}
      if (!cancelled) setRooms(FALLBACK_ROOMS);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, accessToken]);

  const loadMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const response = await getRecentGroupChatMessages(roomType, 100);
      if (response.code === 200 && Array.isArray(response.data)) {
        const sorted = [...(response.data as GroupChatMessage[])].reverse();
        setMessages(sorted);
        const last = sorted[sorted.length - 1];
        if (last?.id) lastMessageIdRef.current = last.id;
      } else {
        setError(response.message || "메시지를 불러올 수 없습니다.");
      }
    } catch (err: any) {
      setError(err.message || "메시지 로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || showRoomList) return;
    loadMessages();
  }, [isAuthenticated, showRoomList, roomType, accessToken]);

  const sseReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectSSE = async (tokenOverride?: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (sseReconnectTimerRef.current) {
      clearTimeout(sseReconnectTimerRef.current);
      sseReconnectTimerRef.current = null;
    }

    // 토큰 만료 체크 → 만료됐으면 리프레시 먼저
    const rawToken = tokenOverride ?? accessToken;
    const freshToken = await getEnsuredAccessToken(rawToken);
    if (!freshToken) {
      // 리프레시도 실패 → 로그아웃 처리
      logout();
      return;
    }
    // 갱신된 토큰이 기존과 다르면 store 업데이트
    if (freshToken !== rawToken) {
      setAccessToken(freshToken);
    }

    let url = `${API_BASE}/api/groupchat/stream?roomType=${encodeURIComponent(roomType)}&lastId=${lastMessageIdRef.current}`;
    url += `&token=${encodeURIComponent(freshToken)}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GroupChatMessage;
        if (data.id) {
          if (data.id > lastMessageIdRef.current) lastMessageIdRef.current = data.id;
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data].sort((a, b) => {
              const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tA - tB;
            });
          });
        }
      } catch (_) {}
    };

    eventSource.addEventListener("connected", () => {});
    eventSource.addEventListener("ping", () => {});

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      // 토큰 만료일 가능성이 높으므로 재연결 시 항상 freshToken 재확인
      sseReconnectTimerRef.current = setTimeout(() => {
        if (eventSourceRef.current === null) connectSSE();
      }, 3000);
    };
  };

  useEffect(() => {
    if (!isAuthenticated || showRoomList) return;
    connectSSE();
    return () => {
      if (sseReconnectTimerRef.current) {
        clearTimeout(sseReconnectTimerRef.current);
        sseReconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, showRoomList, roomType, accessToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (inputWasFocused.current) {
      inputRef.current?.focus();
    }
  }, [messages]);

  useEffect(() => {
    if (!isLoading && inputWasFocused.current) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !accessToken) return;
    setInput("");
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendGroupChatMessage(text, { roomType });
      if (response.code === 200 && response.data) {
        const newMsg = Array.isArray(response.data) ? response.data[0] : response.data;
        if (newMsg?.id) {
          lastMessageIdRef.current = newMsg.id;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg].sort((a, b) => {
              const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tA - tB;
            });
          });
        }
      } else {
        setError(response.message || "전송에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "전송 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhisperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whisperTarget || !whisperText.trim()) return;
    setWhisperSending(true);
    setError(null);
    try {
      const res = await sendWhisper(whisperTarget.userId, whisperText.trim());
      if (res.code === 200) {
        setWhisperTarget(null);
        setWhisperText("");
      } else {
        setError(res.message || "귓속말 전송에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "귓속말 전송 중 오류가 발생했습니다.");
    } finally {
      setWhisperSending(false);
    }
  };

  const handleHonorVote = async (targetUserId: number, action: "UP" | "DOWN") => {
    setContextMenu(null);
    try {
      const res = await voteHonor(targetUserId, action);
      setActionMessage({ type: res.code === 200 ? "ok" : "err", text: res.message ?? "" });
      if (res.code === 200) setTimeout(() => setActionMessage(null), 2500);
    } catch (_) {
      setActionMessage({ type: "err", text: "요청 처리에 실패했습니다." });
    }
  };

  const handleFriendAdd = async (toUserId: number) => {
    setContextMenu(null);
    try {
      const res = await sendFriendRequest(toUserId);
      setActionMessage({ type: res.code === 200 ? "ok" : "err", text: res.message ?? "" });
      if (res.code === 200) setTimeout(() => setActionMessage(null), 2500);
    } catch (_) {
      setActionMessage({ type: "err", text: "친구 요청에 실패했습니다." });
    }
  };

  /** 테스트용: 클릭 시 팝업 메뉴를 연습할 수 있도록 상대 메시지를 목록에 추가 */
  const addTestOtherMessage = () => {
    const testMsg: GroupChatMessage = {
      id: -(Date.now()),
      roomType,
      userId: 999,
      username: "테스트유저",
      message: "여행 같이 갈 사람 귓 주세요! (테스트 메시지 — 클릭해 보세요)",
      lookingForBuddy: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, testMsg]);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu]);

  if (!isHydrated || !isAuthenticated) return null;

  const currentUserId = accessToken ? getUserIdFromToken(accessToken) : null;
  const myId = currentUserId != null ? Number(currentUserId) : null;

  // id 기준 중복 제거 (전송 응답 + SSE 동시 수신 시 같은 메시지 두 번 들어오는 것 방지)
  const uniqueMessages = messages.filter(
    (msg, i, arr) => arr.findIndex((m) => m.id === msg.id) === i
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            {showRoomList ? "단체채팅 목록" : `단체채팅 - ${ROOM_LABELS[roomType] ?? roomType}방`}
          </h1>
          {!showRoomList && (
            <button
              type="button"
              onClick={() => setShowRoomList(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              방 목록
            </button>
          )}
        </header>

        {showRoomList ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {rooms === null ? (
              <p className="text-gray-500">목록 불러오는 중...</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600">
                  명예도에 따라 입장 가능한 방이 달라집니다. 상위 등급은 하위 방에도 입장할 수 있습니다.
                </p>
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full min-w-[360px] text-left">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">방 이름</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">필요 명예도</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">입장 가능</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map((room) => (
                        <tr
                          key={room.roomType}
                          className={`border-b border-gray-100 last:border-0 ${
                            room.accessible ? "bg-white hover:bg-purple-50/30" : "bg-gray-50/80"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800">{room.label}방</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="font-medium">{room.minHonor}</span> 이상
                          </td>
                          <td className="px-4 py-3">
                            {room.accessible ? (
                              <span className="text-green-600 font-medium">가능</span>
                            ) : (
                              <span className="text-red-600 font-medium">명예도 부족</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={!room.accessible}
                              onClick={() => {
                                if (!room.accessible) return;
                                setRoomType(room.roomType);
                                setShowRoomList(false);
                              }}
                              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                                room.accessible
                                  ? "bg-purple-600 text-white hover:bg-purple-700"
                                  : "cursor-not-allowed bg-gray-200 text-gray-500"
                              }`}
                            >
                              입장
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : (
        <>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoadingMessages ? (
            <p className="text-center text-gray-500">메시지 불러오는 중...</p>
          ) : (
            <ul className="space-y-3">
              {uniqueMessages.map((msg, index) => {
                const isMine = myId != null && msg.userId != null && Number(msg.userId) === myId;
                return (
                  <li
                    key={`msg-${msg.id ?? "n"}-${index}`}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (msg.userId == null) return;
                        const uid = Number(msg.userId);
                        if (isMine) return;
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          userId: uid,
                          username: msg.username ?? `사용자 ${msg.userId}`,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (msg.userId == null || isMine) return;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setContextMenu({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom,
                            userId: Number(msg.userId),
                            username: msg.username ?? `사용자 ${msg.userId}`,
                          });
                        }
                      }}
                      className={`max-w-[75%] cursor-pointer rounded-2xl px-4 py-2 select-none ${
                        isMine
                          ? "bg-purple-600 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-800 rounded-bl-md hover:bg-gray-200"
                      }`}
                    >
                      {!isMine && (
                        <span className="block text-xs font-medium text-purple-600 mb-0.5">
                          {msg.username ?? `사용자 ${msg.userId}`}
                        </span>
                      )}
                      <span className="block break-words">{msg.message}</span>
                      {msg.createdAt && (
                        <span
                          className={`block text-xs mt-0.5 ${isMine ? "text-purple-200" : "text-gray-400"}`}
                        >
                          {new Date(msg.createdAt).toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {actionMessage && (
            <p
              className={`fixed bottom-24 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg z-50 ${
                actionMessage.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {actionMessage.text}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {contextMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                setWhisperTarget({ userId: contextMenu.userId, username: contextMenu.username });
                setContextMenu(null);
              }}
            >
              귓속말 보내기
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => handleHonorVote(contextMenu.userId, "UP")}
            >
              명예도 올리기
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => handleHonorVote(contextMenu.userId, "DOWN")}
            >
              명예도 내리기
            </button>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => handleFriendAdd(contextMenu.userId)}
            >
              친구추가
            </button>
          </div>
        )}
        <div className="border-t border-gray-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => { inputWasFocused.current = true; }}
                onBlur={() => { inputWasFocused.current = false; }}
                placeholder="메시지를 입력하세요..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-purple-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                전송
              </button>
            </div>
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={addTestOtherMessage}
                className="self-start rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
              >
                테스트: 상대 메시지 추가
              </button>
            )}
          </form>
        </div>
        </>
        )}
      </div>

      {whisperTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">귓속말 보내기</h2>
            <p className="mb-4 text-sm text-gray-600">받는 사람: {whisperTarget.username}</p>
            <form onSubmit={handleWhisperSubmit} className="space-y-3">
              <textarea
                value={whisperText}
                onChange={(e) => setWhisperText(e.target.value)}
                placeholder="메시지를 입력하세요..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-purple-500"
                disabled={whisperSending}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setWhisperTarget(null); setWhisperText(""); }}
                  disabled={whisperSending}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!whisperText.trim() || whisperSending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {whisperSending ? "전송 중..." : "보내기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
