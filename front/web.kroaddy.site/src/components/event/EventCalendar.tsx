"use client";

import React from "react";
import type { FestivalItem } from "@/lib/api/festival";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const DOT_COLORS = [
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-violet-400",
];

function getCalendarWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const endPad = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < endPad; i++) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** YYYYMMDD 정수 반환 */
function toInt(s: string): number {
  if (!s || s.length < 8) return 0;
  return parseInt(s.replace(/\D/g, "").slice(0, 8), 10) || 0;
}

function getFestivalsForDay(
  year: number,
  month: number,
  day: number,
  items: FestivalItem[]
): FestivalItem[] {
  const d = year * 10000 + month * 100 + day;
  return items.filter((it) => {
    const s = toInt(it.fstvlStartDate);
    const e = toInt(it.fstvlEndDate) || s || 99991231;
    return s > 0 && d >= s && d <= e;
  });
}

interface EventCalendarProps {
  year: number;
  month: number;
  items: FestivalItem[];
  selectedDay?: number | null;
  onSelectDay?: (day: number | null) => void;
}

export function EventCalendar({
  year,
  month,
  items,
  selectedDay,
  onSelectDay,
}: EventCalendarProps) {
  const weeks = getCalendarWeeks(year, month);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {WEEKDAYS.map((w, i) => (
              <th
                key={w}
                className={`border-b border-gray-200 py-2 text-center text-xs font-semibold ${
                  i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-gray-500"
                }`}
              >
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((row, wi) => (
            <tr key={wi}>
              {row.map((day, di) => {
                const isToday = isCurrentMonth && day === todayDate;
                const isSelected = day !== null && day === selectedDay;
                const dayFestivals = day
                  ? getFestivalsForDay(year, month, day, items)
                  : [];
                const hasFestival = dayFestivals.length > 0;
                const isSun = di === 0;
                const isSat = di === 6;

                return (
                  <td
                    key={di}
                    className={`h-14 border-b border-r border-gray-100 p-0 last:border-r-0 ${
                      isSelected ? "bg-indigo-50" : ""
                    }`}
                  >
                    {day !== null ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectDay?.(isSelected ? null : day)
                        }
                        className="flex h-full w-full flex-col items-start px-1.5 pt-1 transition-colors hover:bg-indigo-50/60"
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? "bg-indigo-600 text-white"
                              : isSun
                              ? "text-rose-500"
                              : isSat
                              ? "text-sky-500"
                              : "text-gray-700"
                          }`}
                        >
                          {day}
                        </span>
                        {hasFestival && (
                          <div className="mt-0.5 flex flex-wrap gap-0.5">
                            {dayFestivals.slice(0, 3).map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  DOT_COLORS[i % DOT_COLORS.length]
                                }`}
                              />
                            ))}
                            {dayFestivals.length > 3 && (
                              <span className="text-[9px] leading-none text-gray-400">
                                +{dayFestivals.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="h-full bg-gray-50/50" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
