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
      try {
        const profile = await fetchUserProfile(userId);
        if (cancelled) return;
        if (profile?.nationality) {
          setLangByNationality(profile.nationality, { source: "profile" });
        } else {
          setLang("ko");
        }
      } catch {
        // noop: keep last known language
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLang, setLangByNationality]);
}
