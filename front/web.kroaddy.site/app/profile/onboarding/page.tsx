"use client";

import "@/lib/i18n/config";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useLoginStore } from "@/store";
import { useLangStore } from "@/store/slices/langSlice";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import {
  upsertUserProfile,
  fetchUserProfile,
  GENDER_OPTIONS,
  AGE_BAND_OPTIONS,
  DIETARY_OPTIONS,
  RELIGION_OPTIONS,
  NATIONALITY_OPTIONS,
} from "@/lib/api/userProfile";

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
        selected
          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-600">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

type Form = { nationality: string; gender: string; age_band: string; dietary_pref: string; religion: string };

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useLoginStore();
  const { setLangByNationality } = useLangStore();
  const { t } = useTranslation();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [form, setForm] = useState<Form>({ nationality: "", gender: "", age_band: "", dietary_pref: "", religion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/"); return; }
    if (!appUserId) return;
    fetchUserProfile(appUserId).then((p) => { if (p?.is_complete) router.replace("/home"); });
  }, [isAuthenticated, appUserId, router]);

  const pick = <K extends keyof Form>(key: K, val: string) => {
    setForm((f) => ({ ...f, [key]: f[key] === val ? "" : val }));
    if (key === "nationality") setLangByNationality(val);
  };

  const handleSave = async () => {
    if (!appUserId) return;
    setSaving(true);
    setError(null);
    try {
      await upsertUserProfile({
        userId:      appUserId,
        nationality: form.nationality  || undefined,
        gender:      form.gender       || undefined,
        ageBand:     form.age_band     || undefined,
        dietaryPref: form.dietary_pref || undefined,
        religion:    form.religion     || undefined,
      });
      sessionStorage.removeItem("onboarding_skipped");
      router.push("/home");
    } catch {
      setError(t("common.error"));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
          <span className="text-3xl">🗺️</span>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{t("onboarding.title")}</h1>
            <p className="text-xs text-gray-400">{t("onboarding.subtitle")}</p>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* 1. 국적 */}
          <Section title={`${t("onboarding.nationality.title")}${form.nationality ? ` ✓ ${form.nationality}` : ""}`}>
            {NATIONALITY_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} selected={form.nationality === opt} onClick={() => pick("nationality", opt)} />
            ))}
          </Section>

          {form.nationality && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2">
              <span className="text-base">🌐</span>
              <p className="text-xs font-medium text-violet-600">{t("onboarding.nationality.hint")}</p>
            </div>
          )}

          {/* 2. 성별 */}
          <Section title={t("onboarding.gender.title")}>
            {GENDER_OPTIONS.map((opt) => (
              <Chip key={opt} label={t(`options.gender.${opt}`, opt)} selected={form.gender === opt} onClick={() => pick("gender", opt)} />
            ))}
          </Section>

          {/* 3. 나이대 */}
          <Section title={t("onboarding.age.title")}>
            {AGE_BAND_OPTIONS.map((opt) => (
              <Chip key={opt} label={t(`options.age.${opt}`, opt)} selected={form.age_band === opt} onClick={() => pick("age_band", opt)} />
            ))}
          </Section>

          {/* 4. 식습관 */}
          <Section title={t("onboarding.diet.title")}>
            {DIETARY_OPTIONS.map((opt) => (
              <Chip key={opt} label={t(`options.diet.${opt}`, opt)} selected={form.dietary_pref === opt} onClick={() => pick("dietary_pref", opt)} />
            ))}
          </Section>

          {/* 5. 종교 */}
          <Section title={t("onboarding.religion.title")}>
            {RELIGION_OPTIONS.map((opt) => (
              <Chip key={opt} label={t(`options.religion.${opt}`, opt)} selected={form.religion === opt} onClick={() => pick("religion", opt)} />
            ))}
          </Section>
        </div>

        {error && <p className="mx-6 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 border-t border-gray-100 px-6 py-5">
          <button
            type="button"
            onClick={() => { sessionStorage.setItem("onboarding_skipped", "1"); router.push("/home"); }}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t("onboarding.later")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-60 transition-colors"
          >
            {saving ? t("onboarding.saving") : t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
