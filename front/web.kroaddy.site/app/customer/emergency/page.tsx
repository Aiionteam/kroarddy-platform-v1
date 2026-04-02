"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";
import { fetchUserProfile } from "@/lib/api/userProfile";

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.79.62 2.65a2 2 0 0 1-.45 2.11L8.1 9.91a16 16 0 0 0 6 6l1.43-1.18a2 2 0 0 1 2.11-.45c.86.29 1.75.5 2.65.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PassportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h10a2 2 0 0 1 2 2v14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M16 10h4v10h-4z" />
      <path d="M6.5 8.5h5" />
    </svg>
  );
}

function LostIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 13c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5z" />
      <path d="M20 7l-2 2" />
      <path d="M18 7l2 2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}

function MedicalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12a2 2 0 0 1 2 2v16H4V4a2 2 0 0 1 2-2z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 3.5L3.8 15a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.5 3.5a1.5 1.5 0 0 0-3 0z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16v-2a1 1 0 0 0-.55-.89l-8.5-4.25V3a1 1 0 0 0-2 0v6l-8.5 4.25A1 1 0 0 0 3 14v2l9 3 9-3z" />
      <path d="M2 22l5-3" />
    </svg>
  );
}

function InterpreterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12c1.5-2 6.5-2 8 0" />
      <path d="M9 18h6" />
      <path d="M12 7v4" />
    </svg>
  );
}

type EmergencyCategory = {
  id: string;
  title: string;
  short: string;
  icon: React.ReactNode;
  steps: string[];
};

const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  {
    id: "passport",
    title: "여권/체류·비자 도움",
    short: "여권 분실, 비자/체류 문제, 대사관 방문이 필요할 때",
    icon: <PassportIcon />,
    steps: [
      "가능하면 여권 사본/사진을 먼저 확보하고, 분실 사실을 주변 도움처(숙소/경찰서)와 함께 확인합니다.",
      "영사관/대사관 연락 후 재발급 또는 임시 서류 절차를 안내받으세요.",
      "현지 경찰/사건번호가 필요한 경우 함께 준비합니다.",
    ],
  },
  {
    id: "lost",
    title: "분실/도난 신고",
    short: "지갑, 휴대폰, 중요 물품을 잃어버린 경우",
    icon: <LostIcon />,
    steps: [
      "휴대폰/계정이 탈취됐을 가능성이 있으면 즉시 본인 인증을 중단하고 비밀번호 변경을 진행합니다.",
      "가까운 경찰서/분실물 센터에 신고하고 사건번호를 확보합니다.",
      "여권/카드가 함께 분실된 경우 영사관에 연락해 긴급 조치를 요청합니다.",
    ],
  },
  {
    id: "safety",
    title: "범죄·폭력·안전 위협",
    short: "사기, 폭행, 협박, 주변 위험 상황이 있을 때",
    icon: <ShieldIcon />,
    steps: [
      "즉시 안전한 장소로 이동하고 주변 사람/직원에게 도움을 요청합니다.",
      "상해가 있으면 119(응급) 또는 112(경찰)로 연락합니다.",
      "사건 경위/시간/장소를 메모하고 가능한 증거(사진, 문자)를 보관합니다.",
    ],
  },
  {
    id: "medical",
    title: "응급 의료/사고·부상",
    short: "갑작스러운 질병, 사고로 인한 부상 발생 시",
    icon: <MedicalIcon />,
    steps: [
      "상황에 따라 119 또는 112에 연락하고 응급처치를 받습니다.",
      "병원에서 통역이 필요하면 영사관/대사관 연결 후 지원을 요청합니다.",
      "알레르기/복용약/기저질환 정보가 있다면 의료진에 공유합니다.",
    ],
  },
  {
    id: "disaster",
    title: "화재/재난·대피",
    short: "화재, 폭우, 정전 등 재난 상황에서 행동하는 법",
    icon: <WarningIcon />,
    steps: [
      "경보/안내에 따라 안전한 대피로 이동합니다.",
      "부상자가 있으면 안전을 먼저 확보한 뒤 구조 요청을 합니다.",
      "영사관/숙소 측에 위치와 상황을 공유해 도움을 받습니다.",
    ],
  },
  {
    id: "immigration",
    title: "출입국/강제퇴거·체류 문제",
    short: "체류 위반, 강제퇴거 우려 등 행정적 문제 발생 시",
    icon: <PlaneIcon />,
    steps: [
      "혼자 대응하기보다 문서/통지서를 사진으로 보관하고, 영사관에 신속히 연락합니다.",
      "필요 시 변호사/통역 지원을 안내받습니다.",
      "출입국 절차에 영향을 줄 수 있으니 무단 대응을 피합니다.",
    ],
  },
  {
    id: "interpreter",
    title: "영사관·통역/연락 요청",
    short: "언어 문제로 도움 요청이 어려울 때",
    icon: <InterpreterIcon />,
    steps: [
      "상황을 간단히 정리한 뒤(언제/어디서/무엇이 문제인지) 영사관에 공유합니다.",
      "연락 가능한 전화번호, 주소, 숙소 정보를 준비해 두세요.",
      "긴급 전화(경찰/응급)와 병행이 필요할 수 있습니다.",
    ],
  },
];

function normalizeNationality(n: string | null | undefined) {
  if (!n) return null;
  const v = String(n).trim();
  if (!v) return null;
  return v;
}

function nationalityToLabel(n: string | null | undefined) {
  const v = normalizeNationality(n);
  if (!v) return "알 수 없음";
  const map: Record<string, string> = {
    韓國: "한국",
    한국: "한국",
    USA: "미국",
    日本: "일본",
    中国: "중국",
    "United Kingdom": "영국",
    France: "프랑스",
    Deutschland: "독일",
    Canada: "캐나다",
    Australia: "호주",
    "Việt Nam": "베트남",
    Thailand: "태국",
    Philippines: "필리핀",
    Indonesia: "인도네시아",
    Singapore: "싱가포르",
    Malaysia: "말레이시아",
    India: "인도",
    Other: "기타",
  };
  return map[v] ?? v;
}

function buildEmbassySearchUrl(nationality: string | null) {
  const label = nationalityToLabel(nationality);
  if (!nationality || nationality === "한국") {
    return "https://www.google.com/search?q=%EC%98%81%EC%82%AC%EC%82%AC%EC%9D%B8%EC%9D%B4+%EB%8C%80%ED%95%9C+%EC%97%AC%ED%96%89+%EC%95%88%EB%82%B4";
  }
  if (nationality === "Other") {
    return "https://www.google.com/search?q=%EC%A3%BC%ED%95%9C+%EC%99%B8%EA%B5%AD%EC%9D%98+%EB%8C%80%EC%82%AC%EA%B4%80+%EC%97%8C%EC%82%AC%EA%B4%80+%EC%97%B0%EB%9D%BD";
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`주한 ${label} 대사관 영사 연락처`)}`;
}

export default function EmergencyPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  const [nationality, setNationality] = React.useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);

  const [activeId, setActiveId] = React.useState<string>(EMERGENCY_CATEGORIES[0]?.id ?? "");

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    const userId = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;
    if (!userId) {
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      const profile = await fetchUserProfile(userId);
      if (cancelled) return;
      setNationality(profile?.nationality ?? null);
      setLoadingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const active = EMERGENCY_CATEGORIES.find((c) => c.id === activeId) ?? EMERGENCY_CATEGORIES[0];
  const embassyUrl = buildEmbassySearchUrl(nationality);
  const nationalityLabel = nationalityToLabel(nationality);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout} mobileTitle="긴급 도움">
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                aria-label="뒤로가기"
              >
                ←
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">긴급 도움 및 여행 팁</h1>
                <p className="mt-1 text-sm text-gray-500">외국인이 국내에서 겪을 수 있는 긴급 상황을 카테고리별로 안내합니다.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/customer/emergency/share")}
              className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
            >
              <span className="text-base">📣</span>
              긴급상황 공유
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">대사관/영사관 연결</div>
                <div className="mt-1 text-sm text-gray-600">
                  국적: {loadingProfile ? "불러오는 중..." : nationalityLabel}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={embassyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  <PhoneIcon />
                  영사관 연락처 찾기
                </a>
                <a
                  href="tel:0232100404"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  24시간 영사콜센터 02-3210-0404
                </a>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-gray-800">긴급 상황 카테고리</h2>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {EMERGENCY_CATEGORIES.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${activeId === c.id ? "bg-purple-50" : "hover:bg-gray-50"
                        }`}
                    >
                      <div className="mt-0.5 shrink-0 text-gray-800">{c.icon}</div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-gray-900">{c.title}</p>
                          <span className="shrink-0 text-xs text-gray-500">{activeId === c.id ? "선택됨" : "보기"}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-gray-600">{c.short}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">대응 가이드</span>
                  <h2 className="truncate text-base font-bold text-gray-900">{active?.title}</h2>
                </div>
                <p className="mt-2 text-sm text-gray-600">{active?.short}</p>
              </div>
            </div>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              {(active?.steps ?? []).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                href="tel:112"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                112 경찰
              </a>
              <a
                href="tel:119"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                119 응급
              </a>
              <a
                href="tel:1339"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700"
              >
                1339 질병관리(의료상담)
              </a>
              <a
                href={embassyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                영사관 연락처
              </a>
            </div>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

