"use client";

import { useCallback, useRef, useState } from "react";
import { useLoginStore } from "@/store";
import { fetchUserProfile } from "@/lib/api/userProfile";
import { fetchWeatherAtCoords } from "@/lib/api/weather";
import { getCurrentPositionOrNull } from "@/lib/guide/geolocation";
import { postGuideAsk } from "@/lib/guide/guideClient";
import { guideDebug } from "@/lib/guide/guideDebug";
import { sanitizeGuideAskResponse } from "@/lib/guide/sanitizeAnswer";
import type { GuideAskResponse } from "@/lib/guide/types";

/** 백엔드 부하 완화: 연속 ask 호출 최소 간격(ms) */
const MIN_ASK_INTERVAL_MS = 1000;

function readAppUserId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = sessionStorage.getItem("app_user_id");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * ask 요청용 컨텍스트 — 항상 직렬화 가능한 구조 + 누락 시 기본값으로 백엔드 파싱 오류 방지
 */
export async function buildGuideContext(): Promise<Record<string, unknown>> {
  const appUserId = readAppUserId();

  let profile: Record<string, unknown> = {};
  if (appUserId != null) {
    try {
      const p = await fetchUserProfile(appUserId);
      if (p) {
        profile = {
          dietary_pref: p.dietary_pref ?? "",
          age_band: p.age_band ?? "",
          gender: p.gender ?? "",
          religion: p.religion ?? "",
          nationality: p.nationality ?? "",
        };
      }
    } catch {
      profile = { load_error: "profile_unavailable" };
    }
  }

  let location: Record<string, unknown> | null = null;
  try {
    const pos = await getCurrentPositionOrNull();
    if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
      location = { lat: pos.lat, lng: pos.lng, available: true };
    } else {
      location = { available: false, reason: "geolocation_denied_or_unavailable" };
    }
  } catch {
    location = { available: false, reason: "geolocation_error" };
  }

  let weather: Record<string, unknown> = { available: false, reason: "not_requested" };
  if (location && location.available === true && typeof location.lat === "number" && typeof location.lng === "number") {
    try {
      const w = await fetchWeatherAtCoords(location.lat, location.lng);
      if (w != null && typeof w === "object") {
        weather = { available: true, forecast: w };
      } else {
        weather = { available: false, reason: "weather_fetch_null" };
      }
    } catch {
      weather = { available: false, reason: "weather_fetch_error" };
    }
  } else {
    weather = { available: false, reason: "no_location_for_weather" };
  }

  return {
    user: {
      /** 닉네임은 API에 보내지 않음 — LLM 호칭 오남용 방지 (나이·취향 등은 profile 로만 전달) */
      app_user_id: appUserId ?? null,
      profile,
    },
    location,
    weather,
  };
}

export function useGuide() {
  const { isAuthenticated } = useLoginStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAskStartRef = useRef(0);

  const ask = useCallback(
    async (question: string): Promise<GuideAskResponse> => {
      const q = question.trim();
      if (!q) throw new Error("질문이 비었습니다.");

      const now = Date.now();
      if (now - lastAskStartRef.current < MIN_ASK_INTERVAL_MS) {
        guideDebug("useGuide.ask.throttled", {
          waitMs: MIN_ASK_INTERVAL_MS - (now - lastAskStartRef.current),
        });
        throw new Error(`요청이 너무 빈번합니다. ${MIN_ASK_INTERVAL_MS / 1000}초 후 다시 시도해 주세요.`);
      }
      lastAskStartRef.current = now;

      guideDebug("useGuide.ask.begin", { qLen: q.length, isAuthenticated });
      /** 프로필·위치·날씨(context) 수집 + postGuideAsk 전 구간에서 로딩 유지 */
      setLoading(true);
      setError(null);
      try {
        const tCtx = typeof performance !== "undefined" ? performance.now() : 0;
        const context = await buildGuideContext();
        const ctxMs = typeof performance !== "undefined" ? Math.round(performance.now() - tCtx) : 0;
        guideDebug("useGuide.context.built", { ms: ctxMs });
        guideDebug("useGuide.fetch.ask.start", { qLen: q.length });
        const res = await postGuideAsk({
          question: q,
          context: isAuthenticated ? context : { ...context, note: "guest_or_unsigned" },
        });
        const cleaned = sanitizeGuideAskResponse(res);
        guideDebug("useGuide.fetch.ask.done", { source: cleaned.source });
        return cleaned;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        guideDebug("useGuide.fetch.ask.catch", { message: msg });
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  return { loading, error, ask, setError, minAskIntervalMs: MIN_ASK_INTERVAL_MS };
}
