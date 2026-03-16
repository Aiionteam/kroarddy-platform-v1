"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

function OptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        selected
          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600"
      }`}
    >
      {label}
    </button>
  );
}

type FormKey = "nationality" | "gender" | "age_band" | "dietary_pref" | "religion";

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useLoginStore();
  const { t, setLangByNationality } = useLangStore();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<FormKey, string>>({
    nationality:  "",
    gender:       "",
    age_band:     "",
    dietary_pref: "",
    religion:     "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!appUserId) return;

    fetchUserProfile(appUserId).then((profile) => {
      if (profile?.is_complete) router.replace("/home");
    });
  }, [isAuthenticated, appUserId, router]);

  // 국적 선택 시 언어 즉시 변경
  useEffect(() => {
    if (form.nationality) {
      setLangByNationality(form.nationality);
    }
  }, [form.nationality, setLangByNationality]);

  const STEPS = [
    {
      key: "nationality" as FormKey,
      title: t("onboarding.nationality.title"),
      subtitle: t("onboarding.nationality.subtitle"),
      options: [...NATIONALITY_OPTIONS],
    },
    {
      key: "gender" as FormKey,
      title: t("onboarding.gender.title"),
      subtitle: t("onboarding.gender.subtitle"),
      options: [...GENDER_OPTIONS],
    },
    {
      key: "age_band" as FormKey,
      title: t("onboarding.age.title"),
      subtitle: t("onboarding.age.subtitle"),
      options: [...AGE_BAND_OPTIONS],
    },
    {
      key: "dietary_pref" as FormKey,
      title: t("onboarding.diet.title"),
      subtitle: t("onboarding.diet.subtitle"),
      options: [...DIETARY_OPTIONS],
    },
    {
      key: "religion" as FormKey,
      title: t("onboarding.religion.title"),
      subtitle: t("onboarding.religion.subtitle"),
      options: [...RELIGION_OPTIONS],
    },
  ];

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const selected = form[current.key];

  const handleSelect = (val: string) => {
    setForm((f) => ({ ...f, [current.key]: val }));
  };

  const handleNext = () => {
    if (isLast) {
      handleSave();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSave = async () => {
    if (!appUserId) return;
    setSaving(true);
    setError(null);
    try {
      await upsertUserProfile({
        userId:      appUserId,
        gender:      form.gender       || undefined,
        ageBand:     form.age_band     || undefined,
        dietaryPref: form.dietary_pref || undefined,
        religion:    form.religion     || undefined,
        nationality: form.nationality  || undefined,
      });
      router.push("/home");
    } catch {
      setError(t("error"));
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push("/home");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🗺️</div>
          <h1 className="text-2xl font-bold text-gray-800">{t("onboarding.title")}</h1>
          <p className="mt-1 text-sm text-gray-400">{t("onboarding.subtitle")}</p>
        </div>

        {/* 진행 바 */}
        <div className="mb-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-violet-500" : "bg-gray-100"
              }`}
            />
          ))}
        </div>

        {/* 질문 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800">{current.title}</h2>
          <p className="mt-0.5 text-sm text-gray-400">{current.subtitle}</p>
        </div>

        {/* 국적 선택 시 언어 변경 힌트 (step 0에만 표시) */}
        {step === 0 && form.nationality && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2">
            <span className="text-lg">🌐</span>
            <p className="text-xs text-violet-600 font-medium">
              {form.nationality} {t("onboarding.nationality.subtitle").split(" ").slice(-3).join(" ")}
            </p>
          </div>
        )}

        {/* 옵션 */}
        <div className="mb-8 flex flex-wrap gap-2">
          {current.options.map((opt) => (
            <OptionChip
              key={opt}
              label={opt}
              selected={selected === opt}
              onClick={() => handleSelect(opt)}
            />
          ))}
        </div>

        {/* 에러 */}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t("onboarding.later")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex-1 rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-60 transition-colors"
          >
            {saving
              ? t("onboarding.saving")
              : isLast
              ? t("onboarding.complete")
              : `${t("next")} (${step + 1}/${STEPS.length})`}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          {t("onboarding.later")} → {t("sidebar.profile")}
        </p>
      </div>
    </div>
  );
}
