"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
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

const STEPS = [
  { key: "nationality",  title: "어느 나라에서 오셨나요?",     subtitle: "현지화된 여행 추천에 활용돼요",          options: [...NATIONALITY_OPTIONS] },
  { key: "gender",       title: "성별을 알려주세요",           subtitle: "맞춤 여행지 추천에 활용돼요",          options: [...GENDER_OPTIONS]      },
  { key: "age_band",     title: "나이대를 선택해주세요",        subtitle: "연령대에 맞는 루트를 추천해드려요",      options: [...AGE_BAND_OPTIONS]    },
  { key: "dietary_pref", title: "식습관을 알려주세요",          subtitle: "먹거리 루트 구성에 반영돼요",           options: [...DIETARY_OPTIONS]     },
  { key: "religion",     title: "종교가 있으신가요?",           subtitle: "여행 장소·음식 선정 시 고려해드려요",    options: [...RELIGION_OPTIONS]    },
] as const;

type FormKey = (typeof STEPS)[number]["key"];

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useLoginStore();
  const appUserId = getAppUserIdFromToken(accessToken ?? undefined);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<FormKey, string>>({
    gender:       "",
    age_band:     "",
    dietary_pref: "",
    religion:     "",
    nationality:  "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!appUserId) return;

    // 이미 프로필이 완성된 경우 홈으로
    fetchUserProfile(appUserId).then((profile) => {
      if (profile?.is_complete) router.replace("/home");
    });
  }, [isAuthenticated, appUserId, router]);

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
    } catch (e) {
      setError("저장 중 오류가 발생했어요. 다시 시도해주세요.");
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push("/home");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 px-4">
      {/* 카드 */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🗺️</div>
          <h1 className="text-2xl font-bold text-gray-800">여행 취향 설정</h1>
          <p className="mt-1 text-sm text-gray-400">
            AI 맞춤 여행 추천을 위한 정보를 입력해주세요
          </p>
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
            나중에 하기
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex-1 rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-60 transition-colors"
          >
            {saving
              ? "저장 중..."
              : isLast
              ? "완료"
              : `다음 (${step + 1}/${STEPS.length})`}
          </button>
        </div>

        {/* 건너뛰기 안내 */}
        <p className="mt-4 text-center text-xs text-gray-400">
          나중에 설정 → 여행 프로필에서 변경할 수 있어요
        </p>
      </div>
    </div>
  );
}
