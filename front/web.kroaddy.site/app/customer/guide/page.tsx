"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useTranslation } from "react-i18next";

function ArrowStep({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {children}
            <span className="text-gray-300">→</span>
        </div>
    );
}

function GuideIcon({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 ring-1 ring-purple-100">
            {children}
        </div>
    );
}

function Card({
    icon,
    title,
    subtitle,
    actions,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <GuideIcon>{icon}</GuideIcon>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-gray-900">{title}</h2>
                        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
                    </div>
                </div>
                {actions}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export default function CustomerGuidePage() {
    const router = useRouter();
    const { isAuthenticated, logout } = useLoginStore();
    const { t } = useTranslation();
    // Keep all visible fallback copy i18n-aware so non-KO locales don't see raw Korean.
    const F = React.useMemo(
        () => ({
            title: t("customer.guide.title", { defaultValue: "이용가이드" }),
            subtitle: t("customer.guide.subtitle", { defaultValue: "홈에서 바로 시작할 수 있는 5가지 기능을 한눈에 정리했어요." }),
            hero: {
                kicker: t("customer.guide.hero.kicker", { defaultValue: "첫 여행은 이렇게 시작하세요" }),
                title: t("customer.guide.hero.title", { defaultValue: "여행 루트 생성 → 일정 정리 → 필요하면 후기/소통" }),
                steps: {
                    planner: t("customer.guide.hero.steps.planner", { defaultValue: "여행플래너" }),
                    schedule: t("customer.guide.hero.steps.schedule", { defaultValue: "일정관리" }),
                    guide: t("customer.guide.hero.steps.guide", { defaultValue: "장소추천" }),
                    social: t("customer.guide.hero.steps.social", { defaultValue: "투어스타/단체채팅" }),
                },
                cta_planner: t("customer.guide.hero.cta_planner", { defaultValue: "여행플래너 시작하기" }),
                cta_groupchat: t("customer.guide.hero.cta_groupchat", { defaultValue: "단체채팅 둘러보기" }),
            },
            cards: {
                tourstar: {
                    title: t("customer.guide.cards.tourstar.title", { defaultValue: "투어스타" }),
                    subtitle: t("customer.guide.cards.tourstar.subtitle", { defaultValue: "여행의 기록(게시글)과 후기/공유를 한 곳에서 만들어보세요." }),
                    cta: t("customer.guide.cards.tourstar.cta", { defaultValue: "투어스타 가기" }),
                    items: {
                        "1": {
                            title: t("customer.guide.cards.tourstar.items.1.title", { defaultValue: "1) 사진/여행기록을 준비" }),
                            body: t("customer.guide.cards.tourstar.items.1.body", { defaultValue: "사진을 올리면 AI가 제목/요약을 돕고, 글 작성 흐름을 빠르게 만들어줘요." }),
                        },
                        "2": {
                            title: t("customer.guide.cards.tourstar.items.2.title", { defaultValue: "2) 공유 범위 선택" }),
                            body: t("customer.guide.cards.tourstar.items.2.body", { defaultValue: "공개/비공개(필요에 따라)로 나눠서 올릴 수 있어요." }),
                        },
                        "3": {
                            title: t("customer.guide.cards.tourstar.items.3.title", { defaultValue: "3) 반응 만들기" }),
                            body: t("customer.guide.cards.tourstar.items.3.body", { defaultValue: "좋아요/댓글로 여행 팁을 주고받고, 친구와도 연결해보세요." }),
                        },
                    },
                    tip: {
                        title: t("customer.guide.cards.tourstar.tip.title", { defaultValue: "팁" }),
                        body: t("customer.guide.cards.tourstar.tip.body", { defaultValue: "제목은 짧고, 본문에는 “언제/어디서/무엇이 좋았는지” 순서로 적으면 읽기 편해요." }),
                    },
                },
                planner: {
                    title: t("customer.guide.cards.planner.title", { defaultValue: "여행플래너" }),
                    subtitle: t("customer.guide.cards.planner.subtitle", { defaultValue: "원하는 스타일에 맞춰 AI가 여행 루트와 일정을 추천해요." }),
                    cta: t("customer.guide.cards.planner.cta", { defaultValue: "여행플래너 가기" }),
                    items: {
                        "1": {
                            label: t("customer.guide.cards.planner.items.1.label", { defaultValue: "스탠다드/K컨텐츠/유저컨텐츠" }),
                            body: t("customer.guide.cards.planner.items.1.body", { defaultValue: " 중 하나를 고르세요." }),
                        },
                        "2": {
                            label: t("customer.guide.cards.planner.items.2.label", { defaultValue: "여행지(또는 테마) 선택" }),
                            body: t("customer.guide.cards.planner.items.2.body", { defaultValue: " : 루트가 이어질 곳을 정하면 AI 추천이 더 정확해져요." }),
                        },
                        "3": { body: t("customer.guide.cards.planner.items.3.body", { defaultValue: "추천된 일정은 자동으로 저장되고, 다음 단계(일정관리)에서 더 다듬을 수 있어요." }) },
                    },
                },
                schedule: {
                    title: t("customer.guide.cards.schedule.title", { defaultValue: "일정관리" }),
                    subtitle: t("customer.guide.cards.schedule.subtitle", { defaultValue: "저장된 플랜을 달력에서 확인하고, AI로 수정/리롤할 수 있어요." }),
                    cta: t("customer.guide.cards.schedule.cta", { defaultValue: "일정관리 보기" }),
                    items: {
                        "1": {
                            title: t("customer.guide.cards.schedule.items.1.title", { defaultValue: "1) 달력에서 날짜 선택" }),
                            body: t("customer.guide.cards.schedule.items.1.body", { defaultValue: " : 날짜를 클릭하면 해당 날짜 일정이 보입니다." }),
                        },
                        "2": {
                            title: t("customer.guide.cards.schedule.items.2.title", { defaultValue: "2) “리롤”로 다른 버전 생성" }),
                            body: t("customer.guide.cards.schedule.items.2.body", { defaultValue: " : 마음에 안 드는 일정만 새로 만들 수 있어요." }),
                        },
                        "3": {
                            title: t("customer.guide.cards.schedule.items.3.title", { defaultValue: "3) AI 수정 요청" }),
                            body: t("customer.guide.cards.schedule.items.3.body", { defaultValue: " : 프롬프트로 “바꿔줘” 같은 요청을 하면 일정이 조정됩니다." }),
                        },
                    },
                    tip: {
                        title: t("customer.guide.cards.schedule.tip.title", { defaultValue: "지도/날씨 확인" }),
                        body: t("customer.guide.cards.schedule.tip.body", { defaultValue: "일정 카드 안에서 지도 보기와 날씨 요약도 함께 확인할 수 있어요." }),
                    },
                },
                discover: {
                    title: t("customer.guide.cards.discover.title", { defaultValue: "장소추천" }),
                    subtitle: t("customer.guide.cards.discover.subtitle", { defaultValue: "맛집/행사 등 지역 기반 추천을 한 화면에서 찾아보세요." }),
                    cta: t("customer.guide.cards.discover.cta", { defaultValue: "장소추천 가기" }),
                    items: {
                        "1": {
                            title: t("customer.guide.cards.discover.items.1.title", { defaultValue: "1) 가이드 선택" }),
                            body: t("customer.guide.cards.discover.items.1.body", { defaultValue: " : “맛집 추천” 또는 “행사 추천” 탭을 선택합니다." }),
                        },
                        "2": {
                            title: t("customer.guide.cards.discover.items.2.title", { defaultValue: "2) 카드/리스트 탐색" }),
                            body: t("customer.guide.cards.discover.items.2.body", { defaultValue: " : 관심 있는 장소를 눌러 정보를 확인해요." }),
                        },
                        "3": { body: t("customer.guide.cards.discover.items.3.body", { defaultValue: "일정에 넣고 싶다면, 여행플래너/일정관리에서 현재 루트에 맞게 조정하세요." }) },
                    },
                },
                groupchat: {
                    title: t("customer.guide.cards.groupchat.title", { defaultValue: "단체채팅" }),
                    subtitle: t("customer.guide.cards.groupchat.subtitle", { defaultValue: "명예도/방 형태에 따라 모임에 참여하고 여행 이야기를 나눠요." }),
                    cta: t("customer.guide.cards.groupchat.cta", { defaultValue: "단체채팅 가기" }),
                    items: {
                        "1": {
                            title: t("customer.guide.cards.groupchat.items.1.title", { defaultValue: "1) 방 목록에서 입장" }),
                            body: t("customer.guide.cards.groupchat.items.1.body", { defaultValue: " : 입장 가능 여부는 명예도에 따라 달라질 수 있어요." }),
                        },
                        "2": {
                            title: t("customer.guide.cards.groupchat.items.2.title", { defaultValue: "2) 메시지 전송" }),
                            body: t("customer.guide.cards.groupchat.items.2.body", { defaultValue: " : 채팅창에 내용을 입력하고 전송하면 실시간으로 공유됩니다." }),
                        },
                        "3": {
                            title: t("customer.guide.cards.groupchat.items.3.title", { defaultValue: "3) 친구/귓속말/명예도 기능" }),
                            body: t("customer.guide.cards.groupchat.items.3.body", { defaultValue: " : 상대 메시지 메뉴에서 귓속말, 친구 추가, 명예도 조작을 할 수 있어요." }),
                        },
                    },
                },
            },
        }),
        [t]
    );

    React.useEffect(() => {
        if (!isAuthenticated) router.replace("/");
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    return (
        <AppLayout onLogout={logout}>
            <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
                <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
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
                            <h1 className="text-xl font-bold text-gray-900">{t("customer.guide.title", { defaultValue: F.title })}</h1>
                            <p className="mt-1 text-sm text-gray-500">{t("customer.guide.subtitle", { defaultValue: F.subtitle })}</p>
                        </div>
                    </div>
                </header>

                <div className="mx-auto w-full max-w-6xl px-6 py-8">
                    <section className="mb-6 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 p-5 text-white shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold opacity-90">{t("customer.guide.hero.kicker", { defaultValue: F.hero.kicker })}</div>
                                <h2 className="mt-1 text-lg font-bold">{t("customer.guide.hero.title", { defaultValue: F.hero.title })}</h2>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm opacity-95">
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">{t("customer.guide.hero.steps.planner", { defaultValue: F.hero.steps.planner })}</span>
                                    </ArrowStep>
                                    <span className="hidden md:inline text-gray-100/50"> </span>
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">{t("customer.guide.hero.steps.schedule", { defaultValue: F.hero.steps.schedule })}</span>
                                    </ArrowStep>
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">{t("customer.guide.hero.steps.guide", { defaultValue: F.hero.steps.guide })}</span>
                                    </ArrowStep>
                                    <span className="rounded-full bg-white/15 px-3 py-1">{t("customer.guide.hero.steps.social", { defaultValue: F.hero.steps.social })}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner")}
                                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-purple-700 shadow hover:bg-white/90"
                                >
                                    {t("customer.guide.hero.cta_planner", { defaultValue: F.hero.cta_planner })}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push("/chat/groupchat")}
                                    className="rounded-2xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                                >
                                    {t("customer.guide.hero.cta_groupchat", { defaultValue: F.hero.cta_groupchat })}
                                </button>
                            </div>
                        </div>
                    </section>

                    <div className="space-y-4">
                        <Card
                            icon={<span aria-hidden>📸</span>}
                            title={t("customer.guide.cards.tourstar.title", { defaultValue: F.cards.tourstar.title })}
                            subtitle={t("customer.guide.cards.tourstar.subtitle", { defaultValue: F.cards.tourstar.subtitle })}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/tourstar")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    {t("customer.guide.cards.tourstar.cta", { defaultValue: F.cards.tourstar.cta })}
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.tourstar.items.1.title", { defaultValue: F.cards.tourstar.items["1"].title })}</span> : {t("customer.guide.cards.tourstar.items.1.body", { defaultValue: F.cards.tourstar.items["1"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.tourstar.items.2.title", { defaultValue: F.cards.tourstar.items["2"].title })}</span> : {t("customer.guide.cards.tourstar.items.2.body", { defaultValue: F.cards.tourstar.items["2"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.tourstar.items.3.title", { defaultValue: F.cards.tourstar.items["3"].title })}</span> : {t("customer.guide.cards.tourstar.items.3.body", { defaultValue: F.cards.tourstar.items["3"].body })}
                                </li>
                            </ul>
                            <div className="mt-4 rounded-xl bg-purple-50 p-4 ring-1 ring-purple-100">
                                <p className="text-sm font-semibold text-purple-800">{t("customer.guide.cards.tourstar.tip.title", { defaultValue: F.cards.tourstar.tip.title })}</p>
                                <p className="mt-1 text-sm text-purple-700">{t("customer.guide.cards.tourstar.tip.body", { defaultValue: F.cards.tourstar.tip.body })}</p>
                            </div>
                        </Card>

                        <Card
                            icon={<span aria-hidden>🗺️</span>}
                            title={t("customer.guide.cards.planner.title", { defaultValue: F.cards.planner.title })}
                            subtitle={t("customer.guide.cards.planner.subtitle", { defaultValue: F.cards.planner.subtitle })}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    {t("customer.guide.cards.planner.cta", { defaultValue: F.cards.planner.cta })}
                                </button>
                            }
                        >
                            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.planner.items.1.label", { defaultValue: F.cards.planner.items["1"].label })}</span> {t("customer.guide.cards.planner.items.1.body", { defaultValue: F.cards.planner.items["1"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.planner.items.2.label", { defaultValue: F.cards.planner.items["2"].label })}</span> {t("customer.guide.cards.planner.items.2.body", { defaultValue: F.cards.planner.items["2"].body })}
                                </li>
                                <li>
                                    {t("customer.guide.cards.planner.items.3.body", { defaultValue: F.cards.planner.items["3"].body })}
                                </li>
                            </ol>
                        </Card>

                        <Card
                            icon={<span aria-hidden>📅</span>}
                            title={t("customer.guide.cards.schedule.title", { defaultValue: F.cards.schedule.title })}
                            subtitle={t("customer.guide.cards.schedule.subtitle", { defaultValue: F.cards.schedule.subtitle })}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner/schedule")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    {t("customer.guide.cards.schedule.cta", { defaultValue: F.cards.schedule.cta })}
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.schedule.items.1.title", { defaultValue: F.cards.schedule.items["1"].title })}</span> : {t("customer.guide.cards.schedule.items.1.body", { defaultValue: F.cards.schedule.items["1"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.schedule.items.2.title", { defaultValue: F.cards.schedule.items["2"].title })}</span> : {t("customer.guide.cards.schedule.items.2.body", { defaultValue: F.cards.schedule.items["2"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.schedule.items.3.title", { defaultValue: F.cards.schedule.items["3"].title })}</span> : {t("customer.guide.cards.schedule.items.3.body", { defaultValue: F.cards.schedule.items["3"].body })}
                                </li>
                            </ul>
                            <div className="mt-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
                                <p className="text-sm font-semibold text-gray-900">{t("customer.guide.cards.schedule.tip.title", { defaultValue: F.cards.schedule.tip.title })}</p>
                                <p className="mt-1 text-sm text-gray-600">{t("customer.guide.cards.schedule.tip.body", { defaultValue: F.cards.schedule.tip.body })}</p>
                            </div>
                        </Card>

                        <Card
                            icon={<span aria-hidden>📍</span>}
                            title={t("customer.guide.cards.discover.title", { defaultValue: F.cards.discover.title })}
                            subtitle={t("customer.guide.cards.discover.subtitle", { defaultValue: F.cards.discover.subtitle })}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/guide")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    {t("customer.guide.cards.discover.cta", { defaultValue: F.cards.discover.cta })}
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.discover.items.1.title", { defaultValue: F.cards.discover.items["1"].title })}</span> : {t("customer.guide.cards.discover.items.1.body", { defaultValue: F.cards.discover.items["1"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.discover.items.2.title", { defaultValue: F.cards.discover.items["2"].title })}</span> : {t("customer.guide.cards.discover.items.2.body", { defaultValue: F.cards.discover.items["2"].body })}
                                </li>
                                <li>
                                    {t("customer.guide.cards.discover.items.3.body", { defaultValue: F.cards.discover.items["3"].body })}
                                </li>
                            </ul>
                        </Card>

                        <Card
                            icon={<span aria-hidden>💬</span>}
                            title={t("customer.guide.cards.groupchat.title", { defaultValue: F.cards.groupchat.title })}
                            subtitle={t("customer.guide.cards.groupchat.subtitle", { defaultValue: F.cards.groupchat.subtitle })}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/chat/groupchat")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    {t("customer.guide.cards.groupchat.cta", { defaultValue: F.cards.groupchat.cta })}
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.groupchat.items.1.title", { defaultValue: F.cards.groupchat.items["1"].title })}</span> : {t("customer.guide.cards.groupchat.items.1.body", { defaultValue: F.cards.groupchat.items["1"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.groupchat.items.2.title", { defaultValue: F.cards.groupchat.items["2"].title })}</span> : {t("customer.guide.cards.groupchat.items.2.body", { defaultValue: F.cards.groupchat.items["2"].body })}
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">{t("customer.guide.cards.groupchat.items.3.title", { defaultValue: F.cards.groupchat.items["3"].title })}</span> : {t("customer.guide.cards.groupchat.items.3.body", { defaultValue: F.cards.groupchat.items["3"].body })}
                                </li>
                            </ul>
                        </Card>
                    </div>
                </div>
            </main>
        </AppLayout>
    );
}

