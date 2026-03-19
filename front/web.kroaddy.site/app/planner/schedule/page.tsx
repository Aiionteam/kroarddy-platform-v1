"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import {
  fetchMyPlans,
  deletePlan,
  modifyPlan,
  rerollPlanItem,
  type TravelPlanRecord,
  type ScheduleItem,
} from "@/lib/api/planner";
import { getAppUserIdFromToken } from "@/lib/api/auth";

// ── 플랜별 컬러 팔레트 ────────────────────────────────────────
const COLORS = [
  { dot: "bg-indigo-500",  light: "bg-indigo-50",  border: "border-indigo-200", text: "text-indigo-700",  badge: "bg-indigo-100"  },
  { dot: "bg-purple-500",  light: "bg-purple-50",  border: "border-purple-200", text: "text-purple-700",  badge: "bg-purple-100"  },
  { dot: "bg-teal-500",    light: "bg-teal-50",    border: "border-teal-200",   text: "text-teal-700",    badge: "bg-teal-100"    },
  { dot: "bg-amber-500",   light: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",   badge: "bg-amber-100"   },
  { dot: "bg-rose-500",    light: "bg-rose-50",    border: "border-rose-200",   text: "text-rose-700",    badge: "bg-rose-100"    },
  { dot: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-700", badge: "bg-emerald-100" },
  { dot: "bg-sky-500",     light: "bg-sky-50",     border: "border-sky-200",    text: "text-sky-700",     badge: "bg-sky-100"     },
  { dot: "bg-orange-500",  light: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700",  badge: "bg-orange-100"  },
] as const;

type PlanColor = typeof COLORS[number];
const planColor = (idx: number): PlanColor => COLORS[idx % COLORS.length];

// ── 날짜 유틸 ────────────────────────────────────────────────
function toNum(d: string) { return parseInt(d.replace(/-/g, ""), 10); }

function formatDateKo(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function addDays(base: string, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ScheduleItem → 실제 날짜 YYYY-MM-DD. null이면 날짜 미정. */
function resolveItemDate(item: ScheduleItem, plan: TravelPlanRecord): string | null {
  const raw = item.date ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // "Day N" 또는 day 번호로 추산
  const dayMatch = raw.match(/Day\s*(\d+)/i);
  const n = dayMatch ? parseInt(dayMatch[1]) : item.day;
  if (n && plan.start_date) return addDays(plan.start_date, n - 1);
  return null;
}

/** 해당 날짜(YYYY-MM-DD)에 걸린 플랜들과 그날의 아이템 (flatIdx 포함) */
function getPlansOnDate(
  date: string,
  plans: TravelPlanRecord[],
): { planIdx: number; plan: TravelPlanRecord; items: { item: ScheduleItem; flatIdx: number }[] }[] {
  const dNum = toNum(date);
  return plans
    .map((plan, planIdx) => {
      const items = plan.schedule
        .map((item, flatIdx) => ({ item, flatIdx }))
        .filter(({ item }) => resolveItemDate(item, plan) === date);
      const start = plan.start_date ? toNum(plan.start_date) : null;
      const end   = plan.end_date   ? toNum(plan.end_date)   : start;
      const inRange = start !== null && end !== null && start <= dNum && dNum <= end;
      return { planIdx, plan, items, inRange };
    })
    .filter(({ items, inRange }) => items.length > 0 || inRange);
}

// ── 미니 캘린더 ──────────────────────────────────────────────
const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function PlanCalendar({
  year, month,
  plans,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  year: number; month: number;
  plans: TravelPlanRecord[];
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // 6주 고정 (42칸)
  while (cells.length < 42) cells.push(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-full p-1.5 text-white/80 hover:bg-white/20 transition-colors"
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="text-base font-bold text-white">
          {year}년 {month}월
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-full p-1.5 text-white/80 hover:bg-white/20 transition-colors"
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {WEEK_LABELS.map((w, i) => (
          <div
            key={w}
            className={`py-2 text-center text-xs font-semibold ${
              i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-500"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="h-11 border-b border-r border-gray-50 md:h-16" />;
          }
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const matched = getPlansOnDate(dateStr, plans);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const weekday = (firstDay + day - 1) % 7;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`relative h-11 border-b border-r border-gray-100 p-1 text-left transition-colors md:h-16
                ${isSelected ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400" : "hover:bg-gray-50"}
              `}
            >
              {/* 날짜 숫자 */}
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                  ${isToday ? "bg-indigo-500 text-white" : weekday === 0 ? "text-rose-500" : weekday === 6 ? "text-sky-500" : "text-gray-700"}
                `}
              >
                {day}
              </span>

              {/* 플랜 도트 (최대 3개) */}
              {matched.length > 0 && (
                <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
                  {matched.slice(0, 3).map(({ planIdx }) => (
                    <span
                      key={planIdx}
                      className={`h-1.5 w-1.5 rounded-full ${planColor(planIdx).dot}`}
                    />
                  ))}
                  {matched.length > 3 && (
                    <span className="text-[8px] text-gray-400">+{matched.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 플랜 범례 ─────────────────────────────────────────────────
function PlanLegend({ plans }: { plans: TravelPlanRecord[] }) {
  if (!plans.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-gray-400">플랜 범례</p>
      <ul className="space-y-1.5">
        {plans.map((plan, idx) => {
          const c = planColor(idx);
          return (
            <li key={plan.id} className="flex items-center gap-2 min-w-0">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
              <span className="truncate text-xs text-gray-700">
                {plan.location} · {plan.route_name}
              </span>
              {plan.start_date && (
                <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                  {plan.start_date.slice(5).replace("-", "/")}
                  {plan.end_date && ` ~ ${plan.end_date.slice(5).replace("-", "/")}`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 선택된 날짜 일정 패널 ─────────────────────────────────────
// ── DayPanel 내 단일 플랜 그룹 (리롤 + AI 수정 포함) ──────────
function DayPlanGroup({
  planIdx,
  plan,
  items,
  userId,
  onScheduleChange,
}: {
  planIdx: number;
  plan: TravelPlanRecord;
  items: { item: ScheduleItem; flatIdx: number }[];
  userId: number | null;
  onScheduleChange: (planId: number, schedule: ScheduleItem[]) => void;
}) {
  const c = planColor(planIdx);
  const [rerollingIdx, setRerollingIdx] = useState<number | null>(null);
  const [rerolledIdx,  setRerolledIdx]  = useState<number | null>(null);
  const [prompt,       setPrompt]       = useState("");
  const [modifying,    setModifying]    = useState(false);
  const [modifyError,  setModifyError]  = useState<string | null>(null);
  const [modifyResult, setModifyResult] = useState<{ notPossible: boolean; reason: string } | null>(null);
  const [localSchedule, setLocalSchedule] = useState<ScheduleItem[]>(plan.schedule);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // plan.schedule 외부 변경 시 동기화
  React.useEffect(() => { setLocalSchedule(plan.schedule); }, [plan.schedule]);

  // items를 localSchedule 기반으로 재계산
  const localItems = items.map(({ flatIdx }) => ({
    item: localSchedule[flatIdx] ?? items.find(e => e.flatIdx === flatIdx)!.item,
    flatIdx,
  }));

  async function handleReroll(flatIdx: number) {
    if (rerollingIdx !== null || !userId) return;
    setRerollingIdx(flatIdx);
    setRerolledIdx(null);
    try {
      const res = await rerollPlanItem(plan.id, flatIdx, userId);
      setLocalSchedule(res.schedule);
      onScheduleChange(plan.id, res.schedule);
      setRerolledIdx(flatIdx);
      setTimeout(() => setRerolledIdx(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "리롤에 실패했습니다.");
    } finally {
      setRerollingIdx(null);
    }
  }

  async function handleModify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || !userId || modifying) return;
    setModifying(true);
    setModifyError(null);
    setModifyResult(null);
    try {
      const res = await modifyPlan(plan.id, userId, trimmed);
      if (res.error) throw new Error(res.error);
      setLocalSchedule(res.schedule);
      onScheduleChange(plan.id, res.schedule);
      setPrompt("");
      if (res.reason) {
        setModifyResult({ notPossible: res.not_possible ?? false, reason: res.reason });
        setTimeout(() => setModifyResult(null), 8000);
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setModifying(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleModify(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl border ${c.border}`}>
      {/* 플랜 이름 헤더 */}
      <div className={`flex items-center gap-2 px-3 py-2 ${c.light}`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
        <span className={`truncate text-xs font-bold ${c.text}`}>
          {plan.location} · {plan.route_name}
        </span>
      </div>

      {/* 일정 목록 */}
      <div className="bg-white px-3 py-2">
        {localItems.length === 0 ? (
          <p className={`py-2 text-xs ${c.text} opacity-60`}>여행 기간 중입니다</p>
        ) : (
          <ol className="space-y-2">
            {localItems.map(({ item, flatIdx }, i) => {
              const isRerolling = rerollingIdx === flatIdx;
              const isRerolled  = rerolledIdx  === flatIdx;
              return (
                <li key={flatIdx} className={`rounded-lg border p-2.5 transition-all duration-500 ${
                  isRerolled  ? "border-sky-300 bg-sky-50"
                  : isRerolling ? "border-indigo-200 bg-indigo-50/50 animate-pulse"
                  : "border-gray-100 bg-gray-50"
                }`}>
                  {isRerolled && (
                    <span className="mb-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      🔄 새로 생성됨
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-1 min-w-0 items-center gap-2">
                      <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${c.dot}`}>
                        {i + 1}
                      </span>
                      {item.time && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.badge} ${c.text}`}>
                          {item.time}
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-gray-800">
                        {isRerolling ? "생성 중…" : item.title}
                      </span>
                    </div>
                    {/* 리롤 버튼 */}
                    {userId && (
                      <button
                        type="button"
                        onClick={() => handleReroll(flatIdx)}
                        disabled={rerollingIdx !== null || modifying}
                        title="이 일정 다시 생성"
                        className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                          isRerolling
                            ? "border-indigo-300 bg-indigo-100 text-indigo-500"
                            : "border-gray-200 bg-white text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                        } disabled:pointer-events-none disabled:opacity-40`}
                      >
                        {isRerolling ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {!isRerolling && (
                    <>
                      <p className="mt-1 text-xs text-gray-500">📍 {item.place}</p>
                      <p className="mt-0.5 text-xs text-gray-600">{item.description}</p>
                      {item.tips && (
                        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">💡 {item.tips}</p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* AI 수정 프롬프트 */}
      {userId && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500">
            <span>✏️</span> AI에게 일정 수정 요청
          </p>
          <form onSubmit={handleModify} className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='예) "창덕궁 후원 투어 다른 곳으로 바꿔줘"'
              rows={2}
              disabled={modifying || rerollingIdx !== null}
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-300 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || modifying || rerollingIdx !== null}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              {modifying ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
          {modifyError && (
            <p className="mt-1.5 text-xs text-red-500">{modifyError}</p>
          )}
          {modifyResult && (
            <div className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
              modifyResult.notPossible
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}>
              <span className="mt-0.5 shrink-0">{modifyResult.notPossible ? "⚠️" : "✅"}</span>
              <p className="leading-relaxed">{modifyResult.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DayPanel ─────────────────────────────────────────────────
function DayPanel({
  date,
  plans,
  userId,
  onScheduleChange,
  onClear,
}: {
  date: string;
  plans: TravelPlanRecord[];
  userId: number | null;
  onScheduleChange: (planId: number, schedule: ScheduleItem[]) => void;
  onClear: () => void;
}) {
  const matched = getPlansOnDate(date, plans);
  const [d] = date.split("T");
  const [y, m, day] = d.split("-");

  return (
    <div className="flex h-full flex-col">
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <span className="text-sm font-bold text-gray-800">
            {parseInt(y)}년 {parseInt(m)}월 {parseInt(day)}일
          </span>
          <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {matched.reduce((acc, { items }) => acc + items.length, 0)}개 일정
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          전체 보기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {matched.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">
            이 날 등록된 일정이 없습니다
          </p>
        )}
        {matched.map(({ planIdx, plan, items }) => (
          <DayPlanGroup
            key={plan.id}
            planIdx={planIdx}
            plan={plan}
            items={items}
            userId={userId}
            onScheduleChange={onScheduleChange}
          />
        ))}
      </div>
    </div>
  );
}

// ── 플랜 카드 (리스트 뷰) ─────────────────────────────────────
function PlanCard({
  plan,
  planIdx,
  userId,
  onDelete,
  onScheduleChange,
}: {
  plan: TravelPlanRecord;
  planIdx: number;
  userId: number | null;
  onDelete: (id: number) => void;
  onScheduleChange: (planId: number, schedule: ScheduleItem[]) => void;
}) {
  const c = planColor(planIdx);
  const [expanded, setExpanded] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(plan.schedule);
  const [deleting, setDeleting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [modifyResult, setModifyResult] = useState<{ notPossible: boolean; reason: string } | null>(null);
  const [highlightedTitles, setHighlightedTitles] = useState<Set<string>>(new Set());
  // 리롤 중인 항목 인덱스 (전체 schedule 배열 기준)
  const [rerollingIdx, setRerollingIdx] = useState<number | null>(null);
  const [rerolledIdx, setRerolledIdx] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleDelete() {
    if (!confirm("이 플랜을 삭제하시겠어요?")) return;
    setDeleting(true);
    onDelete(plan.id);
  }

  async function handleModify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || !userId || modifying) return;
    setModifying(true);
    setModifyError(null);
    setModifyResult(null);
    setHighlightedTitles(new Set());
    try {
      const res = await modifyPlan(plan.id, userId, trimmed);
      if (res.error) throw new Error(res.error);
      setSchedule(res.schedule);
      onScheduleChange(plan.id, res.schedule);
      setPrompt("");
      // 이유 표시 (불가능 여부 포함)
      if (res.reason) {
        setModifyResult({ notPossible: res.not_possible ?? false, reason: res.reason });
        setTimeout(() => setModifyResult(null), 8000);
      }
      if (!res.not_possible) {
        setHighlightedTitles(new Set(res.modified_titles));
        setTimeout(() => setHighlightedTitles(new Set()), 3000);
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setModifying(false);
    }
  }

  /** 특정 항목 리롤 – flat schedule 배열 인덱스 기준 */
  async function handleReroll(flatIdx: number) {
    if (rerollingIdx !== null || !userId) return;
    setRerollingIdx(flatIdx);
    setRerolledIdx(null);
    try {
      const res = await rerollPlanItem(plan.id, flatIdx, userId);
      setSchedule(res.schedule);
      onScheduleChange(plan.id, res.schedule);
      setRerolledIdx(flatIdx);
      setTimeout(() => setRerolledIdx(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "리롤에 실패했습니다.");
    } finally {
      setRerollingIdx(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleModify(e as unknown as React.FormEvent);
    }
  }

  // dayGroups 에 flat index도 함께 기록
  const dayGroups = useMemo(() => {
    const groups: Record<number, { item: ScheduleItem; flatIdx: number }[]> = {};
    schedule.forEach((item, flatIdx) => {
      (groups[item.day] ??= []).push({ item, flatIdx });
    });
    return groups;
  }, [schedule]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* 카드 헤더 */}
      <div className={`flex items-center justify-between border-b border-gray-100 px-4 py-3 ${c.light}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.badge}`}>
            <span className={`h-3 w-3 rounded-full ${c.dot}`} />
          </span>
          <div className="min-w-0">
            <p className={`truncate text-sm font-bold ${c.text}`}>
              {plan.location} · {plan.route_name}
            </p>
            <p className="text-[11px] text-gray-400">
              저장일 {formatDateKo(plan.created_at)}
              {plan.start_date && ` · ${plan.start_date}${plan.end_date ? ` ~ ${plan.end_date}` : ""}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`rounded-lg border ${c.border} bg-white px-2.5 py-1 text-xs font-medium ${c.text} hover:opacity-80 transition-opacity`}
          >
            {expanded ? "접기" : "일정 보기"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? "…" : "삭제"}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* 타임라인 */}
          <div className="px-4 py-3 space-y-4">
            {Object.entries(dayGroups).map(([day, entries]) => (
              <div key={day}>
                <h3 className={`mb-2 flex items-center gap-2 text-xs font-bold ${c.text}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${c.dot}`}>
                    {day}
                  </span>
                  {entries[0]?.item.date}
                </h3>
                <ol className="relative border-l-2 border-gray-100 pl-4 space-y-2">
                  {entries.map(({ item, flatIdx }, localIdx) => {
                    const isModified = highlightedTitles.has(item.title);
                    const isRerolling = rerollingIdx === flatIdx;
                    const isRerolled = rerolledIdx === flatIdx;
                    return (
                      <li key={flatIdx} className="relative">
                        <span className={`absolute -left-[1.25rem] top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                          isRerolled ? "bg-sky-400" : isModified ? "bg-green-400" : c.dot
                        }`}>
                          {localIdx + 1}
                        </span>
                        <div className={`rounded-lg border p-2.5 transition-all duration-500 ${
                          isRerolled
                            ? "border-sky-300 bg-sky-50"
                            : isModified
                            ? "border-green-300 bg-green-50"
                            : isRerolling
                            ? "border-indigo-200 bg-indigo-50/50 animate-pulse"
                            : "border-gray-100 bg-gray-50"
                        }`}>
                          {/* 상태 뱃지 */}
                          {isRerolled && (
                            <span className="mb-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              🔄 새로 생성됨
                            </span>
                          )}
                          {isModified && (
                            <span className="mb-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              ✨ AI 수정됨
                            </span>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-1 items-center gap-2 min-w-0">
                              {item.time && (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.badge} ${c.text}`}>
                                  {item.time}
                                </span>
                              )}
                              <span className="truncate text-sm font-semibold text-gray-800">
                                {isRerolling ? "생성 중…" : item.title}
                              </span>
                            </div>

                            {/* 리롤 버튼 */}
                            {userId && (
                              <button
                                type="button"
                                onClick={() => handleReroll(flatIdx)}
                                disabled={rerollingIdx !== null || modifying}
                                title="이 일정 다시 생성"
                                className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                                  isRerolling
                                    ? "border-indigo-300 bg-indigo-100 text-indigo-500"
                                    : "border-gray-200 bg-white text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                                } disabled:pointer-events-none disabled:opacity-40`}
                              >
                                {isRerolling ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>

                          {!isRerolling && (
                            <>
                              <p className="mt-0.5 text-xs text-gray-500">📍 {item.place}</p>
                              <p className="mt-1 text-xs text-gray-600">{item.description}</p>
                              {item.tips && (
                                <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                  💡 {item.tips}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>

          {/* AI 수정 프롬프트 */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-500">
              <span>✏️</span> AI에게 일정 수정 요청
            </p>
            <form onSubmit={handleModify} className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='예) "창덕궁 후원 투어 다른 곳으로 바꿔줘"'
                rows={2}
                disabled={modifying || rerollingIdx !== null || !userId}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-300 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || modifying || rerollingIdx !== null || !userId}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none"
              >
                {modifying ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </form>
            {modifying && <p className="mt-1 text-xs text-indigo-500 animate-pulse">AI가 수정 중…</p>}
            {rerollingIdx !== null && <p className="mt-1 text-xs text-sky-500 animate-pulse">항목 새로 생성 중…</p>}
            {modifyError && <p className="mt-1 text-xs text-red-500">{modifyError}</p>}
            {modifyResult && (
              <div className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
                modifyResult.notPossible
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}>
                <span className="mt-0.5 shrink-0 text-sm">
                  {modifyResult.notPossible ? "⚠️" : "✅"}
                </span>
                <p className="leading-relaxed">{modifyResult.reason}</p>
              </div>
            )}
            {!userId && <p className="mt-1 text-xs text-gray-400">로그인 후 수정 기능 이용 가능</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function SchedulePage() {
  const router = useRouter();
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [plans, setPlans] = useState<TravelPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const loadPlans = useCallback(async (signal?: AbortSignal) => {
    if (!appUserId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyPlans(appUserId, signal);
      if (signal?.aborted) return;
      setPlans(data);
      if (data.length > 0 && data[0].start_date) {
        const [y, m] = data[0].start_date.split("-").map(Number);
        setCalYear(y);
        setCalMonth(m);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "플랜 목록을 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [appUserId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    loadPlans(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadPlans]);

  const handleDelete = useCallback(async (planId: number) => {
    if (!appUserId) return;
    try {
      await deletePlan(planId, appUserId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }, [appUserId]);

  const handleScheduleChange = useCallback((planId: number, schedule: ScheduleItem[]) => {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, schedule } : p)));
  }, []);

  function prevMonth() {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
    setSelectedDate(null);
  }

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <header className="shrink-0 border-b border-gray-200 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-2 md:px-6 md:py-3.5">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 md:text-lg">일정 관리</h1>
            <p className="truncate text-xs text-gray-400">
              {appUserId ? `저장된 플랜 ${plans.length}개 · 날짜를 클릭하면 그날의 일정을 볼 수 있어요` : "로그인 후 이용 가능"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/planner")}
            className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity md:px-4 md:text-sm"
          >
            + 새 루트
          </button>
        </header>

        {/* 본문: 모바일 세로 스택 / 데스크톱 2-패널 */}
        <div className="flex flex-1 flex-col overflow-auto md:flex-row md:overflow-hidden">

          {/* ── 캘린더 + 범례 ── */}
          <aside className="shrink-0 border-b border-gray-200 bg-gray-50 p-4 md:w-80 md:border-b-0 md:border-r md:overflow-y-auto xl:w-96">
            {loading ? (
              <div className="animate-pulse rounded-2xl bg-white h-72 shadow-sm" />
            ) : (
              <>
                <PlanCalendar
                  year={calYear}
                  month={calMonth}
                  plans={plans}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onPrevMonth={prevMonth}
                  onNextMonth={nextMonth}
                />
                <PlanLegend plans={plans} />
              </>
            )}
          </aside>

          {/* ── 날짜 상세 OR 전체 플랜 리스트 ── */}
          <main className="flex flex-1 flex-col overflow-y-auto bg-white md:overflow-hidden">
            {loading && (
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 rounded bg-gray-200" />
                        <div className="h-3 w-1/4 rounded bg-gray-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="p-6">
                <div className="rounded-xl bg-red-50 px-5 py-4 text-sm text-red-600">
                  {error}
                  <button type="button" onClick={() => loadPlans()} className="ml-3 underline text-red-500 hover:text-red-700">다시 시도</button>
                </div>
              </div>
            )}

            {!loading && !error && !appUserId && (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
                <span className="mb-4 text-5xl">🔐</span>
                <p className="text-base font-medium text-gray-600">로그인이 필요합니다</p>
                <p className="mt-2 text-sm text-gray-400">SNS 로그인 후 여행 플랜이 자동으로 저장됩니다</p>
              </div>
            )}

            {!loading && !error && appUserId && plans.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-gray-300">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-base font-medium text-gray-600">저장된 플랜이 없습니다</p>
                <p className="mt-2 text-sm text-gray-400">여행플래너에서 루트를 선택하면<br />AI 일정이 자동으로 저장됩니다</p>
                <button type="button" onClick={() => router.push("/planner")}
                  className="mt-5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity">
                  여행플래너로 이동
                </button>
              </div>
            )}

            {/* 날짜 선택됨 → DayPanel */}
            {!loading && !error && plans.length > 0 && selectedDate && (
              <div className="flex-1 overflow-hidden">
                <DayPanel
                  date={selectedDate}
                  plans={plans}
                  userId={appUserId}
                  onScheduleChange={handleScheduleChange}
                  onClear={() => setSelectedDate(null)}
                />
              </div>
            )}

            {/* 날짜 미선택 → 전체 플랜 리스트 */}
            {!loading && !error && plans.length > 0 && !selectedDate && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <p className="text-xs text-gray-400">전체 플랜 목록 · 날짜를 클릭하면 해당일 일정만 볼 수 있어요</p>
                {plans.map((plan, idx) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    planIdx={idx}
                    userId={appUserId}
                    onDelete={handleDelete}
                    onScheduleChange={handleScheduleChange}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
