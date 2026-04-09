"use client";

import React from "react";
import { useLangStore } from "@/store/slices/langSlice";
import { fetchUserProfile } from "@/lib/api/userProfile";

/**
 * Sets i18n language automatically from user's saved nationality.
 * Runs once on mount; safe to include in layout.
 */
export function useAutoLocaleFromProfile() {
  const setLangByNationality = useLangStore((s) => s.setLangByNationality);

  React.useEffect(() => {
    const userId =
      typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchUserProfile(userId);
        if (!cancelled && profile?.nationality) {
          setLangByNationality(profile.nationality);
        }
      } catch {
        // noop: keep last known language
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLangByNationality]);
}

