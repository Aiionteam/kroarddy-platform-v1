"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";

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

    React.useEffect(() => {
        if (!isAuthenticated) router.replace("/");
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    return (
        <AppLayout onLogout={logout}>
            <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
                <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
                    <h1 className="text-xl font-bold text-gray-900">이용가이드</h1>
                    <p className="mt-1 text-sm text-gray-500">홈에서 바로 시작할 수 있는 5가지 기능을 한눈에 정리했어요.</p>
                </header>

                <div className="mx-auto w-full max-w-6xl px-6 py-8">
                    <section className="mb-6 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 p-5 text-white shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold opacity-90">첫 여행은 이렇게 시작하세요</div>
                                <h2 className="mt-1 text-lg font-bold">여행 루트 생성 → 일정 정리 → 필요하면 후기/소통</h2>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm opacity-95">
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">여행플래너</span>
                                    </ArrowStep>
                                    <span className="hidden md:inline text-gray-100/50"> </span>
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">일정관리</span>
                                    </ArrowStep>
                                    <ArrowStep>
                                        <span className="rounded-full bg-white/15 px-3 py-1">장소추천</span>
                                    </ArrowStep>
                                    <span className="rounded-full bg-white/15 px-3 py-1">투어스타/단체채팅</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner")}
                                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-purple-700 shadow hover:bg-white/90"
                                >
                                    여행플래너 시작하기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push("/chat/groupchat")}
                                    className="rounded-2xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                                >
                                    단체채팅 둘러보기
                                </button>
                            </div>
                        </div>
                    </section>

                    <div className="space-y-4">
                        <Card
                            icon={<span aria-hidden>📸</span>}
                            title="투어스타"
                            subtitle="여행의 기록(게시글)과 후기/공유를 한 곳에서 만들어보세요."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/tourstar")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    투어스타 가기
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">1) 사진/여행기록을 준비</span> : 사진을 올리면 AI가 제목/요약을 돕고, 글 작성 흐름을 빠르게 만들어줘요.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">2) 공유 범위 선택</span> : 공개/비공개(필요에 따라)로 나눠서 올릴 수 있어요.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">3) 반응 만들기</span> : 좋아요/댓글로 여행 팁을 주고받고, 친구와도 연결해보세요.
                                </li>
                            </ul>
                            <div className="mt-4 rounded-xl bg-purple-50 p-4 ring-1 ring-purple-100">
                                <p className="text-sm font-semibold text-purple-800">팁</p>
                                <p className="mt-1 text-sm text-purple-700">
                                    제목은 짧고, 본문에는 “언제/어디서/무엇이 좋았는지” 순서로 적으면 읽기 편해요.
                                </p>
                            </div>
                        </Card>

                        <Card
                            icon={<span aria-hidden>🗺️</span>}
                            title="여행플래너"
                            subtitle="원하는 스타일에 맞춰 AI가 여행 루트와 일정을 추천해요."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    여행플래너 가기
                                </button>
                            }
                        >
                            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">스탠다드/K컨텐츠/유저컨텐츠</span> 중 하나를 고르세요.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">여행지(또는 테마) 선택</span> : 루트가 이어질 곳을 정하면 AI 추천이 더 정확해져요.
                                </li>
                                <li>
                                    추천된 일정은 자동으로 저장되고, 다음 단계(일정관리)에서 더 다듬을 수 있어요.
                                </li>
                            </ol>
                        </Card>

                        <Card
                            icon={<span aria-hidden>📅</span>}
                            title="일정관리"
                            subtitle="저장된 플랜을 달력에서 확인하고, AI로 수정/리롤할 수 있어요."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/planner/schedule")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    일정관리 보기
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">1) 달력에서 날짜 선택</span> : 날짜를 클릭하면 해당 날짜 일정이 보입니다.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">2) “리롤”로 다른 버전 생성</span> : 마음에 안 드는 일정만 새로 만들 수 있어요.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">3) AI 수정 요청</span> : 프롬프트로 “바꿔줘” 같은 요청을 하면 일정이 조정됩니다.
                                </li>
                            </ul>
                            <div className="mt-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
                                <p className="text-sm font-semibold text-gray-900">지도/날씨 확인</p>
                                <p className="mt-1 text-sm text-gray-600">일정 카드 안에서 지도 보기와 날씨 요약도 함께 확인할 수 있어요.</p>
                            </div>
                        </Card>

                        <Card
                            icon={<span aria-hidden>📍</span>}
                            title="장소추천"
                            subtitle="맛집/행사 등 지역 기반 추천을 한 화면에서 찾아보세요."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/guide")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    장소추천 가기
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">1) 가이드 선택</span> : “맛집 추천” 또는 “행사 추천” 탭을 선택합니다.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">2) 카드/리스트 탐색</span> : 관심 있는 장소를 눌러 정보를 확인해요.
                                </li>
                                <li>
                                    일정에 넣고 싶다면, 여행플래너/일정관리에서 현재 루트에 맞게 조정하세요.
                                </li>
                            </ul>
                        </Card>

                        <Card
                            icon={<span aria-hidden>💬</span>}
                            title="단체채팅"
                            subtitle="명예도/방 형태에 따라 모임에 참여하고 여행 이야기를 나눠요."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => router.push("/chat/groupchat")}
                                    className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                                >
                                    단체채팅 가기
                                </button>
                            }
                        >
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li>
                                    <span className="font-semibold text-gray-900">1) 방 목록에서 입장</span> : 입장 가능 여부는 명예도에 따라 달라질 수 있어요.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">2) 메시지 전송</span> : 채팅창에 내용을 입력하고 전송하면 실시간으로 공유됩니다.
                                </li>
                                <li>
                                    <span className="font-semibold text-gray-900">3) 친구/귓속말/명예도 기능</span> : 상대 메시지 메뉴에서 귓속말, 친구 추가, 명예도 조작을 할 수 있어요.
                                </li>
                            </ul>
                        </Card>
                    </div>
                </div>
            </main>
        </AppLayout>
    );
}

