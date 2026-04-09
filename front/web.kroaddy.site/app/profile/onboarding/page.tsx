"use client";

import "@/lib/i18n/config";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useLoginStore } from "@/store";
import { useLangStore } from "@/store/slices/langSlice";
import {
  upsertUserProfile,
  fetchUserProfile,
  GENDER_OPTIONS,
  AGE_BAND_OPTIONS,
  DIETARY_OPTIONS,
  RELIGION_OPTIONS,
  NATIONALITY_OPTIONS,
  toOptionI18nSlug,
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
  const { isAuthenticated } = useLoginStore();
  const { setLangByNationality } = useLangStore();
  const { t } = useTranslation();
  const appUserId = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;

  const [form, setForm] = useState<Form>({ nationality: "", gender: "", age_band: "", dietary_pref: "", religion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Avoid hydration mismatch: server renders with initial i18n language, but client may rehydrate to a different language.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // In production require login, but allow direct access on local hosts so language can be tested without auth.
    if (!isAuthenticated) {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "";
      if (process.env.NODE_ENV === "production" && !isLocalHost) {
        router.replace("/");
      }
      return;
    }

    if (!appUserId) return;

    fetchUserProfile(appUserId).then((p) => {
      if (p?.is_complete) router.replace("/home");
    });
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
      setError(t("common.error", { defaultValue: "오류가 발생했습니다." }));
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
            <h1 className="text-lg font-bold text-gray-800">{mounted ? t("onboarding.title", { defaultValue: "여행 취향 설정" }) : ""}</h1>
            <p className="text-xs text-gray-400">{mounted ? t("onboarding.subtitle", { defaultValue: "AI 맞춤 여행 추천을 위한 정보를 입력해 주세요" }) : ""}</p>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* 1. 국적 */}
          <Section
            title={`${
              mounted ? t("onboarding.nationality.title", { defaultValue: "국가 / 국적" }) : ""
            }${form.nationality ? ` ✓ ${form.nationality}` : ""}`}
          >
            {NATIONALITY_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={t(`options.nationality.${toOptionI18nSlug(opt)}`, { defaultValue: opt })}
                selected={form.nationality === opt}
                onClick={() => pick("nationality", opt)}
              />
            ))}
          </Section>

          {form.nationality && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2">
              <span className="text-base">🌐</span>
              <p className="text-xs font-medium text-violet-600">{mounted ? t("onboarding.nationality.hint", { defaultValue: "선택한 국적에 맞춰 앱 언어가 자동 변경됩니다" }) : ""}</p>
            </div>
          )}

          {mounted && (
            <>
              {/* 2. 성별 */}
              <Section title={t("onboarding.gender.title", { defaultValue: "성별" })}>
                {GENDER_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={t(`options.gender.${toOptionI18nSlug(opt)}`, { defaultValue: opt })}
                    selected={form.gender === opt}
                    onClick={() => pick("gender", opt)}
                  />
                ))}
              </Section>

              {/* 3. 나이대 */}
              <Section title={t("onboarding.age.title", { defaultValue: "나이대" })}>
                {AGE_BAND_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={t(`options.age.${toOptionI18nSlug(opt)}`, { defaultValue: opt })}
                    selected={form.age_band === opt}
                    onClick={() => pick("age_band", opt)}
                  />
                ))}
              </Section>

              {/* 4. 식습관 */}
              <Section title={t("onboarding.diet.title", { defaultValue: "식습관" })}>
                {DIETARY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={t(`options.diet.${toOptionI18nSlug(opt)}`, { defaultValue: opt })}
                    selected={form.dietary_pref === opt}
                    onClick={() => pick("dietary_pref", opt)}
                  />
                ))}
              </Section>

              {/* 5. 종교 */}
              <Section title={t("onboarding.religion.title", { defaultValue: "종교" })}>
                {RELIGION_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={t(`options.religion.${toOptionI18nSlug(opt)}`, { defaultValue: opt })}
                    selected={form.religion === opt}
                    onClick={() => pick("religion", opt)}
                  />
                ))}
              </Section>
            </>
          )}
        </div>

        {error && <p className="mx-6 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 border-t border-gray-100 px-6 py-5">
          <button
            type="button"
            onClick={() => { sessionStorage.setItem("onboarding_skipped", "1"); router.push("/home"); }}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {mounted ? t("onboarding.later", { defaultValue: "나중에 할게요" }) : ""}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-60 transition-colors"
          >
            {mounted ? (saving ? t("onboarding.saving", { defaultValue: "저장 중..." }) : t("common.done", { defaultValue: "완료" })) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
