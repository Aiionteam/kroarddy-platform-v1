"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

/** 펄스 링 + 소프트 글로우 */
function GuideSearchingPulse() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full bg-sky-400/35"
        animate={{ scale: [1, 1.45, 1], opacity: [0.45, 0, 0.45] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute inset-[5px] rounded-full bg-sky-500/45"
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.25, 0.55] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      />
      <span className="relative z-[1] h-2 w-2 rounded-full bg-sky-600 shadow-sm shadow-sky-500/50" />
    </div>
  );
}

export function GuideSearchingSpinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-sky-100 border-t-sky-600 ${className}`}
      aria-hidden
    />
  );
}

const rowMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

export function GuideKroaddySearchingChatRow() {
  const { t } = useTranslation();
  return (
    <motion.li
      {...rowMotion}
      className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-100"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Kroaddy</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] leading-snug text-slate-600">
        <GuideSearchingPulse />
        <span className="font-medium text-slate-700">
          {t("guide.searching.chat", { defaultValue: "Kroaddy is searching" })}
        </span>
      </div>
    </motion.li>
  );
}

export function GuideKroaddySearchingMapOverlay() {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center bg-slate-900/[0.04] p-4"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-[min(92vw,22rem)] items-center gap-4 rounded-md bg-white px-6 py-5 shadow-md backdrop-blur-md">
        <div className="scale-110 shrink-0" aria-hidden>
          <GuideSearchingPulse />
        </div>
        <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">
          {t("guide.searching.map", { defaultValue: "Kroaddy is finding the best places" })}
        </p>
      </div>
    </div>
  );
}
