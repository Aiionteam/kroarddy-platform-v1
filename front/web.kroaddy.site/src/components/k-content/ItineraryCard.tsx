"use client";

import React from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

export type ItineraryCardItem = {
  time?: string;
  title: string;
  place: string;
  description: string;
  tips?: string;
  estimated_cost?: string;
  source?: "db" | "external";
  order?: number;
  is_twist?: boolean;
  vibe_reason?: string;
};

export type ItineraryCardProps = {
  packageId?: string;
  item: ItineraryCardItem;
  /** 같은 날짜 블록 안에서의 0-based 순번 */
  stepIndex: number;
  lang: "ko" | "en";
  getLocalizedDescription: (opts: {
    description?: string;
    tips?: string;
    place: string;
    source?: "db" | "external";
    lang: "ko" | "en";
    fallbackDescription?: string;
  }) => string;
  localizeTip: (raw: string | undefined, lang: "ko" | "en") => string;
};

function isKfCafePackage(packageId?: string) {
  return (packageId ?? "").toUpperCase() === "KF_CAFE";
}

export function ItineraryCard({
  packageId,
  item,
  lang,
  getLocalizedDescription,
  localizeTip,
}: ItineraryCardProps) {
  const { t } = useTranslation();
  const isKfCafe = isKfCafePackage(packageId);
  const descriptionText = getLocalizedDescription({
    description:
      isKfCafe && (item.vibe_reason ?? "").trim()
        ? item.vibe_reason
        : item.description,
    tips: item.tips,
    place: item.place || item.title,
    source: item.source,
    lang,
    fallbackDescription: t("planner.kcontent.description_fallback", {
      place: item.place || item.title,
      defaultValue: "{{place}}에서 즐길 수 있는 추천 스팟입니다.",
    }),
  });
  const tipText = localizeTip(item.tips, lang);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0">
          {item.time && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
              {item.time}
            </span>
          )}
          <span className="truncate font-semibold text-gray-900">{item.title}</span>
          {item.source === "db" && (
            <span className="relative inline-flex shrink-0 items-center group">
              <span className="ml-2 animate-kroaddy-float text-[10px] font-semibold text-indigo-700">
                {t("planner.kcontent.kroaddy_pick", { defaultValue: "Kroaddy PICK" })}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {item.estimated_cost && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              {item.estimated_cost}
            </span>
          )}
        </div>
      </div>
      <p className="mt-0.5 text-xs font-medium text-indigo-500">📍 {item.place}</p>
      {descriptionText && (
        <p className="mt-1 text-sm text-gray-600">{descriptionText}</p>
      )}
      {tipText && (
        <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          💡 {tipText}
        </p>
      )}
    </div>
  );
}
