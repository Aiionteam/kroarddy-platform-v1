"use client";

import React, { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronDown, ChevronUp, MessageSquareText, Send, User } from "lucide-react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
import { guideDebug } from "@/lib/guide/guideDebug";
import { GuideKroaddySearchingChatRow } from "@/components/guide/GuideKroaddySearching";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  /**
   * assistant: `markdown`(기본) — 긴 본문용.
   * `plain` — 장소 요약 한 줄 등(마크다운 파싱 없음).
   */
  assistantBodyFormat?: "markdown" | "plain";
}

export interface ChatDrawerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  messages: ChatMessage[];
  placeholder?: string;
  disabled?: boolean;
  /** 가이드/경로 응답 대기 — 목록 하단에 Kroaddy 검색 중 행 표시 */
  assistantLoading?: boolean;
}

const messageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

/** AI 답변 — 본문 medium, 제목 계층 유지 */
function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div
      className={
        "prose prose-sm max-w-none text-left text-slate-600 " +
        "prose-headings:mb-1 prose-headings:mt-2 prose-headings:font-bold prose-headings:text-slate-900 " +
        "prose-p:my-1 prose-p:font-medium prose-p:leading-relaxed prose-p:text-[13px] " +
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:font-medium prose-li:text-[13px] " +
        "prose-strong:font-bold prose-strong:text-slate-900 " +
        "prose-code:rounded-sm prose-code:bg-sky-50 prose-code:px-1.5 prose-code:text-[12px] prose-code:font-medium prose-code:text-sky-800 " +
        "prose-a:font-medium prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline"
      }
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * 하단 플로팅 가이드 입력 — 카드형 대화 + 글래스 입력 바
 */
export function ChatDrawer({
  value,
  onChange,
  onSend,
  messages,
  placeholder,
  disabled = false,
  assistantLoading = false,
}: ChatDrawerProps) {
  const { t } = useTranslation();
  const ph = placeholder ?? t("guide.chat.placeholder", { defaultValue: "Ask about a place…" });
  const lastEnterRef = useRef(0);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleSendClick = useCallback(() => {
    guideDebug("ChatDrawer.send.click", {
      disabled,
      valueLen: value.trim().length,
      willFire: !disabled && value.trim().length > 0,
    });
    if (disabled) {
      guideDebug("ChatDrawer.send.blocked", { reason: "disabled" });
      return;
    }
    if (!value.trim()) {
      guideDebug("ChatDrawer.send.blocked", { reason: "empty_value" });
      return;
    }
    onSend();
  }, [disabled, onSend, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (disabled || !value.trim()) return;
      const now = Date.now();
      if (now - lastEnterRef.current < 500) return;
      lastEnterRef.current = now;
      onSend();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end px-5 pb-5 pt-2 md:px-10 md:pb-8">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl">
        <AnimatePresence mode="wait" initial={false}>
          {panelOpen ? (
            <motion.div
              key="open"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col"
            >
              {(messages.length > 0 || assistantLoading) && (
                <div className="mb-4 max-h-44 overflow-y-auto rounded-md bg-white p-6 shadow-sm md:max-h-56">
                  <ul className="space-y-4">
                    {messages.slice(-6).map((m) => (
                      <motion.li
                        key={m.id}
                        {...messageMotion}
                        className={
                          m.role === "user"
                            ? "rounded-md bg-sky-50/70 p-6 shadow-sm"
                            : "rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100"
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          {m.role === "user" ? (
                            <User className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
                          ) : (
                            <Bot className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {m.role === "user"
                              ? t("guide.chat.role_user", { defaultValue: "You" })
                              : t("guide.chat.role_bot", { defaultValue: "Kroaddy" })}
                          </span>
                        </div>
                        {m.role === "user" ? (
                          <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-600">
                            {m.content}
                          </p>
                        ) : (
                          <div className="mt-2">
                            {m.assistantBodyFormat === "plain" ? (
                              <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-slate-600">
                                {m.content}
                              </p>
                            ) : (
                              <AssistantMarkdown content={m.content} />
                            )}
                          </div>
                        )}
                      </motion.li>
                    ))}
                    {assistantLoading ? <GuideKroaddySearchingChatRow /> : null}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-white/85 px-3 py-3 shadow-md backdrop-blur-xl sm:gap-3 sm:px-5">
                <motion.button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  title={t("guide.chat.collapse", { defaultValue: "Collapse chat" })}
                  aria-label={t("guide.chat.collapse", { defaultValue: "Collapse chat" })}
                  aria-expanded={true}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  <ChevronDown className="h-5 w-5" strokeWidth={2} aria-hidden />
                </motion.button>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={ph}
                  disabled={disabled}
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:outline-none disabled:opacity-45"
                  autoComplete="off"
                  aria-label={t("guide.chat.input_aria", { defaultValue: "AI guide question" })}
                />
                <motion.button
                  type="button"
                  onClick={handleSendClick}
                  disabled={disabled || !value.trim()}
                  title={
                    disabled
                      ? t("guide.chat.send_wait", { defaultValue: "Please wait for the response." })
                      : !value.trim()
                        ? t("guide.chat.send_empty", { defaultValue: "Enter a question." })
                        : t("guide.chat.send", { defaultValue: "Send" })
                  }
                  aria-label={
                    disabled
                      ? t("guide.chat.send_aria_busy", { defaultValue: "Processing" })
                      : !value.trim()
                        ? t("guide.chat.send_aria_empty", { defaultValue: "Enter a question" })
                        : t("guide.chat.send_aria", { defaultValue: "Send question" })
                  }
                  whileTap={disabled || !value.trim() ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sky-600 text-white shadow-sm shadow-sky-600/25 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <Send className="h-5 w-5" strokeWidth={2} aria-hidden />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="closed"
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setPanelOpen(true)}
              title={t("guide.chat.open", { defaultValue: "Open chat" })}
              aria-label={t("guide.chat.open", { defaultValue: "Open chat" })}
              aria-expanded={false}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-100 bg-white/90 py-3.5 pl-4 pr-5 text-sm font-bold text-slate-700 shadow-md backdrop-blur-xl transition hover:bg-sky-50/90 hover:text-sky-800"
            >
              <MessageSquareText className="h-5 w-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
              <span>{t("guide.chat.open", { defaultValue: "Open chat" })}</span>
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
