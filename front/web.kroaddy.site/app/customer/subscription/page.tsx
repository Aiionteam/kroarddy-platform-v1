"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";
import { useTranslation } from "react-i18next";

type BillingPlanId = "monthly" | "yearly";

function TickIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

function CrownIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7l5 5 4-7 4 7 5-5v14H3V7z" />
        </svg>
    );
}

export default function SubscriptionPage() {
    const router = useRouter();
    const { isAuthenticated, logout } = useLoginStore();
    const { t } = useTranslation();

    const [planId, setPlanId] = React.useState<BillingPlanId>("monthly");
    const [agree1, setAgree1] = React.useState(true);
    const [agree2, setAgree2] = React.useState(true);

    React.useEffect(() => {
        if (!isAuthenticated) router.replace("/");
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    const plans = {
        monthly: {
            title: t("customer.subscription.plan_monthly.title", { defaultValue: "월간 플랜" }),
            badge: t("customer.subscription.plan_monthly.badge", { defaultValue: "기본" }),
            price: t("customer.subscription.plan_monthly.price", { defaultValue: "월 5,900원" }),
            note: t("customer.subscription.plan_monthly.note", { defaultValue: "매월 이용" }),
            oldPrice: undefined as string | undefined,
            features: [
                t("customer.subscription.plan_monthly.features.1", { defaultValue: "전문가 추천 요약 제공" }),
                t("customer.subscription.plan_monthly.features.2", { defaultValue: "개별 문의/가이드 우선 응답" }),
                t("customer.subscription.plan_monthly.features.3", { defaultValue: "최신 기능 업데이트 포함" }),
            ],
        },
        yearly: {
            title: t("customer.subscription.plan_yearly.title", { defaultValue: "연간 플랜" }),
            badge: t("customer.subscription.plan_yearly.badge", { defaultValue: "추천" }),
            price: t("customer.subscription.plan_yearly.price", { defaultValue: "연 46,800원" }),
            note: t("customer.subscription.plan_yearly.note", { defaultValue: "연간 이용" }),
            oldPrice: t("customer.subscription.plan_yearly.oldPrice", { defaultValue: "월 기준 약 7,000원대" }),
            features: [
                t("customer.subscription.plan_yearly.features.1", { defaultValue: "월간 플랜 혜택 전체 포함" }),
                t("customer.subscription.plan_yearly.features.2", { defaultValue: "연간 기간 동안 할인 적용" }),
                t("customer.subscription.plan_yearly.features.3", { defaultValue: "우선 지원 및 서비스 안정성 강화" }),
            ],
        },
    };

    const active = plans[planId];
    const ctaText =
        planId === "monthly"
            ? t("customer.subscription.cta_monthly", { defaultValue: "월간 구독 시작하기" })
            : t("customer.subscription.cta_yearly", { defaultValue: "연간 구독 시작하기" });

    return (
        <AppLayout onLogout={logout} mobileTitle={t("customer.subscription.title_mobile", { defaultValue: "구독 서비스" })}>
            <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
                <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                                aria-label={t("common.back", { defaultValue: "뒤로가기" })}
                            >
                                ←
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{t("customer.subscription.title", { defaultValue: "구독 서비스" })}</h1>
                                <p className="mt-1 text-sm text-gray-500">{t("customer.subscription.subtitle", { defaultValue: "무료 체험 후 원하는 플랜을 선택하세요." })}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                            <CrownIcon />
                            <span>{t("customer.subscription.safety", { defaultValue: "안전한 결제 · 언제든 해지 가능" })}</span>
                        </div>
                    </div>
                </header>

                <div className="mx-auto w-full max-w-md px-6 py-8">
                    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-800">{t("customer.subscription.free.kicker", { defaultValue: "오늘 무료로 시작해요" })}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                    {t("customer.subscription.free.note", { defaultValue: "7일동안 무료 사용 후, 선택한 플랜으로 자동 전환됩니다." })}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                            <div className="grid grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setPlanId("monthly")}
                                    className={`p-4 text-left transition ${planId === "monthly" ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-bold text-gray-900">{plans.monthly.title}</div>
                                        <div className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${planId === "monthly" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                                            {plans.monthly.badge}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-lg font-extrabold text-gray-900">{plans.monthly.price}</div>
                                    <div className="mt-1 text-xs font-semibold text-gray-500">{plans.monthly.note}</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPlanId("yearly")}
                                    className={`p-4 text-left transition ${planId === "yearly" ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-bold text-gray-900">{plans.yearly.title}</div>
                                        <div className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${planId === "yearly" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                                            {plans.yearly.badge}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-lg font-extrabold text-gray-900">{plans.yearly.price}</div>
                                    <div className="mt-1 text-xs font-semibold text-gray-500">{plans.yearly.note}</div>
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{t("customer.subscription.selected.title", { defaultValue: "선택한 플랜" })}</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {active.title} · {active.oldPrice ? t("customer.subscription.selected.compare", { defaultValue: "비교 " }) + active.oldPrice : t("customer.subscription.selected.includes", { defaultValue: "혜택 포함" })}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-extrabold text-gray-900">{active.price}</div>
                                </div>
                            </div>

                            <ul className="mt-3 space-y-2">
                                {active.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-800">
                                        <span className="mt-0.5 inline-flex rounded-full bg-teal-50 p-1 text-teal-700">
                                            <TickIcon />
                                        </span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-4 space-y-3">
                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900">{t("customer.subscription.agree.service_title", { defaultValue: "서비스 이용 동의" })}</div>
                                    <div className="mt-0.5 text-xs text-gray-500">{t("customer.subscription.agree.service_desc", { defaultValue: "구독 결제 및 서비스 이용을 위해 필요합니다." })}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={agree1}
                                    onChange={(e) => setAgree1(e.target.checked)}
                                    className="h-5 w-5 accent-purple-600"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900">{t("customer.subscription.agree.billing_title", { defaultValue: "결제/과금 안내 동의" })}</div>
                                    <div className="mt-0.5 text-xs text-gray-500">{t("customer.subscription.agree.billing_desc", { defaultValue: "자동 전환 및 결제 주기에 대한 안내입니다." })}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={agree2}
                                    onChange={(e) => setAgree2(e.target.checked)}
                                    className="h-5 w-5 accent-purple-600"
                                />
                            </label>
                        </div>

                        <button
                            type="button"
                            disabled={!agree1 || !agree2}
                            onClick={() => alert(`${ctaText}\n${t("customer.subscription.demo_alert", { defaultValue: "(데모 UI) 실제 결제 API 연동은 다음 단계에서 진행합니다." })}`)}
                            className="mt-5 w-full rounded-2xl bg-teal-600 px-4 py-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-teal-700"
                        >
                            {ctaText}
                        </button>

                        <div className="mt-3 text-center text-[11px] leading-relaxed text-gray-500">
                            {t("customer.subscription.demo_note", { defaultValue: "데모 화면입니다. 실제 결제/자동 전환은 운영 환경에서 연동됩니다." })}
                        </div>
                    </section>
                </div>
            </main>
        </AppLayout>
    );
}

