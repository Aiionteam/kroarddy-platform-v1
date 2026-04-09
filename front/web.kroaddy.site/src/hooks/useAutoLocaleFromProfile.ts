"use client";

import React from "react";
import { useLangStore } from "@/store/slices/langSlice";
import { fetchUserProfile } from "@/lib/api/userProfile";

/**
 * Sets i18n language automatically from user's saved nationality.
 * Runs once on mount; safe to include in layout.
 */
export function useAutoLocaleFromProfile() {
  const setLang = useLangStore((s) => s.setLang);
  const setLangByNationality = useLangStore((s) => s.setLangByNationality);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("kroaddy-lang");
      } catch {
        /* ignore */
      }
    }
    const userId =
      typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;
    if (!userId) return;

    let cancelled = false;
    (async () => {
<<<<<<< HEAD
      const profile = await fetchUserProfile(userId);
      if (cancelled) return;
      // DB 국적이 있으면 그에 맞는 UI 언어. 없거나 조회 실패(null) 시 기본 ko.
      if (profile?.nationality) {
        setLangByNationality(profile.nationality);
      } else {
        setLang("ko");
=======
      try {
        const profile = await fetchUserProfile(userId);
        if (!cancelled && profile?.nationality) {
          setLangByNationality(profile.nationality, { source: "profile" });
        }
      } catch {
        // noop: keep last known language
>>>>>>> eac67b8546948d3c3f4113fce114a347d96206ba
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLang, setLangByNationality]);
}

