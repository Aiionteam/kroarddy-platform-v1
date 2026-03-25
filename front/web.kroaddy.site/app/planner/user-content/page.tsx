"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppLayout } from "@/components/organisms/AppLayout";
import { getAppUserIdFromToken, getNicknameFromToken } from "@/lib/api/auth";
import {
  polishRoute,
  saveUserRoute,
  fetchUserRoutes,
  likeUserRoute,
  deleteUserRoute,
  uploadImage,
  validateImageAndGetUploadUrl,
  type UserRoute,
  type RouteItemInput,
  type PolishedRouteItem,
  type PolishResponse,
  type ValidateImageResult,
} from "@/lib/api/userContent";
import {
  fetchMyPlans,
  savePlan,
  type ScheduleItem,
  type TravelPlanRecord,
} from "@/lib/api/planner";

// ────────────────────────────────────────────────────────────
// 피드 카드 (넷플릭스 스타일)
// ────────────────────────────────────────────────────────────

const GRAD_FALLBACKS = [
  "from-violet-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-teal-500 to-cyan-600",
  "from-emerald-500 to-green-600",
];

function RouteCard({
  route,
  liked,
  isOwner,
  onLike,
  onOpen,
  onDelete,
}: {
  route: UserRoute;
  liked: boolean;
  isOwner: boolean;
  onLike: (id: number) => void;
  onOpen: (route: UserRoute) => void;
  onDelete: (id: number) => void;
}) {
  const grad = GRAD_FALLBACKS[route.id % GRAD_FALLBACKS.length];

  return (
    <div
      className="group relative shrink-0 w-64 cursor-pointer rounded-2xl overflow-hidden shadow-md transition-all duration-200 hover:scale-105 hover:shadow-xl"
      style={{ aspectRatio: "2/3" }}
      onClick={() => onOpen(route)}
    >
      {route.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={route.image_url}
          alt={route.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
      )}

      {/* 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* 좋아요 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!liked) onLike(route.id);
        }}
        disabled={liked}
        className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-white backdrop-blur-sm transition-all duration-200
          ${liked
            ? "bg-rose-500/80 scale-110 cursor-default"
            : "bg-black/30 hover:bg-rose-500/70 hover:scale-110"
          }`}
        aria-label={liked ? "이미 좋아요" : "좋아요"}
      >
        <span className={`transition-transform duration-200 ${liked ? "scale-125" : "scale-100"}`}>
          {liked ? "❤️" : "🤍"}
        </span>
        <span className="tabular-nums">{route.likes}</span>
      </button>

      {/* 삭제 버튼 (본인 게시물만) */}
      {isOwner && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(route.id); }}
          className="absolute top-3 left-3 flex items-center justify-center rounded-full bg-black/30 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all duration-200"
          aria-label="삭제"
          title="내 루트 삭제"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}

      {/* 본문 */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {route.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="font-bold text-white text-sm leading-snug line-clamp-2">{route.title}</p>
        <p className="mt-1 text-xs text-white/70">📍 {route.location}</p>
        <p className="mt-1.5 text-xs text-white/60 line-clamp-2">{route.description}</p>
        {route.nickname && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-white/80">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">
              👤
            </span>
            {route.nickname}
          </p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 유저 공유 루트 → 플래너 일정(ScheduleItem) 변환
// ────────────────────────────────────────────────────────────

const DEFAULT_DAY_TIMES = ["10:00", "12:30", "15:00", "17:30", "19:00", "20:30"];

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** tripDate: YYYY-MM-DD (플랜 시작·종료일 및 각 일정 행의 날짜) */
function userRouteToScheduleItems(route: UserRoute, tripDate: string): ScheduleItem[] {
  return route.route_items.map((item, idx) => ({
    day: 1,
    date: tripDate,
    time: DEFAULT_DAY_TIMES[idx % DEFAULT_DAY_TIMES.length] ?? "10:00",
    place: item.place,
    title: item.place,
    description: item.description ?? "",
    tips: item.tip?.trim() ? item.tip : undefined,
  }));
}

// ────────────────────────────────────────────────────────────
// 루트 상세 모달
// ────────────────────────────────────────────────────────────

function RouteDetailModal({
  route,
  userId,
  onClose,
}: {
  route: UserRoute;
  userId: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addDone, setAddDone] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tripDate, setTripDate] = useState(todayLocalISO);

  useEffect(() => {
    setAddDone(false);
    setAddError(null);
    setAdding(false);
    setDatePickerOpen(false);
    setTripDate(todayLocalISO());
  }, [route.id]);

  const canAdd = !!userId && route.route_items.length > 0;

  const handleAddToMySchedule = useCallback(async (dateIso: string) => {
    if (!userId || route.route_items.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
    setAdding(true);
    setAddError(null);
    try {
      const schedule = userRouteToScheduleItems(route, dateIso);
      await savePlan({
        location: route.location.trim() || "custom",
        routeName: route.title.trim() || "공유 루트",
        startDate: dateIso,
        endDate: dateIso,
        schedule,
        userId,
      });
      setAddDone(true);
      setDatePickerOpen(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "일정 저장에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  }, [userId, route]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (datePickerOpen) setDatePickerOpen(false);
        else onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 사진 헤더 */}
        <div className="relative h-52 shrink-0">
          {route.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={route.image_url} alt={route.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className={`h-full w-full bg-gradient-to-br ${GRAD_FALLBACKS[route.id % GRAD_FALLBACKS.length]}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50 transition-colors"
          >
            ✕
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {route.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-white">{route.title}</h2>
            <p className="text-sm text-white/80">📍 {route.location}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-2">
          <p className="text-sm text-gray-600 mb-5">{route.description}</p>

          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">루트</h3>
          <ol className="relative border-l-2 border-purple-100 pl-5 space-y-4">
            {route.route_items.map((item, idx) => (
              <li key={idx} className="relative">
                <span className="absolute -left-[1.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-200 text-[10px] font-bold text-purple-700">
                  {idx + 1}
                </span>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="font-semibold text-gray-800 text-sm">📍 {item.place}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                  {item.tip && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">💡 {item.tip}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* 내 일정에 추가 */}
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/90 px-5 py-4 space-y-2">
          {addError && (
            <p className="text-xs text-red-600 text-center">{addError}</p>
          )}
          {addDone ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
              <p className="text-center text-sm font-medium text-emerald-700">✅ 내 일정에 추가되었습니다</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/planner/schedule");
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                일정 관리로 이동
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTripDate(todayLocalISO());
                setDatePickerOpen(true);
              }}
              disabled={!canAdd || adding}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              📅 내 일정에 추가
            </button>
          )}
          {!userId && (
            <p className="text-center text-[11px] text-gray-400">로그인 후 이용할 수 있습니다.</p>
          )}
          {userId && route.route_items.length === 0 && (
            <p className="text-center text-[11px] text-gray-400">저장할 장소가 없습니다.</p>
          )}
        </div>

        {/* 방문 날짜 선택 (저장 직전) */}
        {datePickerOpen && !addDone && (
          <div
            className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6 sm:p-4 rounded-2xl"
            onClick={() => !adding && setDatePickerOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-sm font-bold text-gray-800">언제 다녀오실 예정인가요?</h4>
              <p className="mt-1 text-xs text-gray-500">선택한 날짜가 일정에 반영됩니다.</p>
              <label className="mt-4 block text-xs font-semibold text-gray-600">방문 날짜</label>
              <input
                type="date"
                value={tripDate}
                min={todayLocalISO()}
                onChange={(e) => setTripDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => setDatePickerOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={adding || !tripDate}
                  onClick={() => handleAddToMySchedule(tripDate)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {adding ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      저장 중…
                    </>
                  ) : (
                    "이 날짜로 추가"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 업로드 모달 (3단계 위저드)
// ────────────────────────────────────────────────────────────

type Step = "photo" | "form" | "polish" | "done";

function UploadModal({
  userId,
  nickname,
  onClose,
  onSaved,
}: {
  userId: number | null;
  nickname?: string | null;
  onClose: () => void;
  onSaved: (route: UserRoute) => void;
}) {
  const [step, setStep] = useState<Step>("photo");

  // Step 1 – 사진 (S3 업로드를 위해 File 객체 유지)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // NSFW 검증 결과 캐싱 (presigned URL 포함, 5분 유효)
  const [validatedImage, setValidatedImage] = useState<ValidateImageResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [nsfwError, setNsfwError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 – 폼
  const MAX_STOPS_PER_DAY = 5;
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<{ stops: RouteItemInput[] }[]>([
    { stops: [{ place: "", note: "" }, { place: "", note: "" }, { place: "", note: "" }] },
  ]);

  // Step 3 – AI 결과
  const [polishing, setPolishing] = useState(false);
  const [polished, setPolished] = useState<PolishResponse | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 내 일정 가져오기
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [myPlans, setMyPlans] = useState<TravelPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const applyFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    // 새 파일 선택 시 이전 검증 결과 초기화
    setValidatedImage(null);
    setNsfwError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  // "다음 →" 클릭 시 이미지가 있으면 NSFW 검증 먼저 수행
  const handleNextFromPhoto = useCallback(async () => {
    if (!imageFile) {
      setStep("form");
      return;
    }
    // 이미 검증된 결과가 있으면 바로 다음 단계
    if (validatedImage) {
      setStep("form");
      return;
    }
    setValidating(true);
    setNsfwError(null);
    try {
      const result = await validateImageAndGetUploadUrl(imageFile);
      setValidatedImage(result);
      setStep("form");
    } catch (e) {
      setNsfwError(e instanceof Error ? e.message : "이미지 검증 실패");
    } finally {
      setValidating(false);
    }
  }, [imageFile, validatedImage]);

  const addDay = () =>
    setDays((d) => [...d, { stops: [{ place: "", note: "" }] }]);
  const removeDay = (dayIdx: number) =>
    setDays((d) => d.filter((_, i) => i !== dayIdx));
  const addStopToDay = (dayIdx: number) =>
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx && day.stops.length < MAX_STOPS_PER_DAY
          ? { stops: [...day.stops, { place: "", note: "" }] }
          : day
      )
    );
  const removeStopFromDay = (dayIdx: number, stopIdx: number) =>
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? { stops: day.stops.filter((_, j) => j !== stopIdx) }
          : day
      )
    );
  const updateStopInDay = (dayIdx: number, stopIdx: number, field: keyof RouteItemInput, val: string) =>
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? { stops: day.stops.map((s, j) => (j === stopIdx ? { ...s, [field]: val } : s)) }
          : day
      )
    );

  const openPlanPicker = useCallback(async () => {
    if (!userId) return;
    if (myPlans.length > 0) { setShowPlanPicker(true); return; }
    setPlansLoading(true);
    try {
      const plans = await fetchMyPlans(userId);
      setMyPlans(plans);
      setShowPlanPicker(true);
    } catch {
      // ignore
    } finally {
      setPlansLoading(false);
    }
  }, [userId, myPlans.length]);

  const importFromPlan = useCallback((plan: TravelPlanRecord) => {
    setTitle(plan.route_name);
    setLocation(plan.location);
    setDescription("");
    if (plan.schedule.length === 0) {
      setDays([{ stops: [{ place: "", note: "" }] }]);
    } else {
      // day 필드로 그룹핑, 일차당 최대 5개
      const byDay = new Map<number, RouteItemInput[]>();
      plan.schedule.forEach((item) => {
        const d = item.day ?? 1;
        if (!byDay.has(d)) byDay.set(d, []);
        const arr = byDay.get(d)!;
        if (arr.length < MAX_STOPS_PER_DAY) arr.push({ place: item.place, note: item.title });
      });
      const sorted = [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, stops]) => ({ stops }));
      setDays(sorted);
    }
    setShowPlanPicker(false);
  }, []);

  const handlePolish = useCallback(async () => {
    // 모든 일차의 장소를 순서대로 합쳐서 AI에 전달
    const allStops = days.flatMap((d) => d.stops).filter((s) => s.place.trim());
    if (!title.trim() || !location.trim() || allStops.length === 0) return;
    setPolishing(true);
    setPolishError(null);
    setStep("polish");
    try {
      const result = await polishRoute({
        title: title.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        route_items: allStops,
      });
      setPolished(result);
    } catch (e) {
      setPolishError(e instanceof Error ? e.message : "AI 폴리시 실패");
    } finally {
      setPolishing(false);
    }
  }, [title, location, description, days]);

  const handleSave = useCallback(async () => {
    if (!polished) return;
    setSaving(true);
    try {
      // 이미지가 있으면 S3에 업로드 (검증 결과 presigned URL 재사용)
      let imageUrl: string | null = null;
      if (imageFile) {
        // validatedImage 에 presigned URL이 있으면 재사용, 없으면 재검증
        imageUrl = await uploadImage(imageFile, validatedImage ?? undefined);
      }
      const saved = await saveUserRoute({
        user_id: userId,
        nickname: nickname ?? null,
        title: polished.title,
        location: polished.location,
        description: polished.description,
        route_items: polished.route_items,
        tags: polished.tags,
        image_url: imageUrl,
      });
      onSaved(saved);
      setStep("done");
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [polished, userId, imageFile, validatedImage, onSaved]);

  const STEPS: Record<Step, string> = {
    photo: "사진 선택",
    form: "루트 입력",
    polish: "AI 다듬기",
    done: "완료",
  };
  const stepKeys = Object.keys(STEPS) as Step[];
  const stepIdx = stepKeys.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && step !== "polish" && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* 헤더 + 스텝 인디케이터 */}
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">내 루트 업로드</h3>
            {step !== "polish" && step !== "done" && (
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {stepKeys.filter((s) => s !== "done").map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIdx ? "bg-purple-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{STEPS[step]}</p>
        </div>

        {/* ── Step 1: 사진 ── */}
        {step === "photo" && (
          <div className="px-5 py-5">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-10 text-center transition hover:border-purple-400 hover:bg-purple-50"
              style={{ minHeight: 200 }}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="preview"
                  className="absolute inset-0 h-full w-full object-cover rounded-xl"
                />
              ) : (
                <>
                  <span className="text-5xl">📸</span>
                  <p className="text-sm font-medium text-gray-600">사진을 드래그하거나 클릭해서 업로드</p>
                  <p className="text-xs text-gray-400">JPG, PNG, WEBP 지원</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {previewUrl && (
              <button
                onClick={() => { setImageFile(null); setPreviewUrl(null); setValidatedImage(null); setNsfwError(null); }}
                className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                ✕ 사진 제거
              </button>
            )}

            {/* NSFW 오류 메시지 */}
            {nsfwError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                <span className="text-base shrink-0">🚫</span>
                <p className="text-xs text-red-700 leading-relaxed">{nsfwError}</p>
              </div>
            )}

            {/* 검증 완료 배지 */}
            {validatedImage && !nsfwError && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                <span>✅</span>
                <span>이미지 검증 완료</span>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleNextFromPhoto}
                disabled={validating}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                {validating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    검증 중…
                  </>
                ) : (
                  imageFile ? "다음 →" : "사진 없이 계속"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: 폼 ── */}
        {step === "form" && (
          <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">

            {/* 내 일정 가져오기 버튼 */}
            <div className="mb-4">
              <button
                type="button"
                onClick={openPlanPicker}
                disabled={plansLoading || !userId}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {plansLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                    불러오는 중…
                  </>
                ) : (
                  <>📅 저장된 일정에서 가져오기</>
                )}
              </button>
            </div>

            {/* 플랜 피커 */}
            {showPlanPicker && (
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100">
                  <span className="text-xs font-bold text-indigo-700">저장된 일정 선택</span>
                  <button
                    type="button"
                    onClick={() => setShowPlanPicker(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    닫기
                  </button>
                </div>
                {myPlans.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-center text-gray-400">저장된 일정이 없습니다.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-indigo-100">
                    {myPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => importFromPlan(plan)}
                        className="w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-indigo-100 transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-800 truncate">{plan.route_name}</span>
                        <span className="text-xs text-gray-500">
                          {plan.location}
                          {plan.start_date && ` · ${plan.start_date}${plan.end_date ? ` ~ ${plan.end_date}` : ""}`}
                          {` · ${plan.schedule.length}개 장소`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">루트 제목 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 강릉 감성 당일치기"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">여행지 *</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 강릉, 경포대"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">한 줄 소개 (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="이 루트의 매력을 간단히 써주세요 (AI가 다듬어줘요)"
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-600">
                  장소 목록 * <span className="font-normal text-gray-400">(일차당 최대 {MAX_STOPS_PER_DAY}개)</span>
                </label>

                <div className="space-y-3">
                  {days.map((day, dayIdx) => (
                    <div key={dayIdx} className="rounded-xl border border-gray-200 overflow-hidden">
                      {/* 일차 헤더 */}
                      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-100">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                            {dayIdx + 1}
                          </span>
                          <span className="text-sm font-semibold text-purple-800">{dayIdx + 1}일차</span>
                          <span className="text-[11px] text-gray-400">
                            {day.stops.length}/{MAX_STOPS_PER_DAY}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => addStopToDay(dayIdx)}
                            disabled={day.stops.length >= MAX_STOPS_PER_DAY}
                            className="text-xs text-purple-600 hover:underline disabled:opacity-40 disabled:no-underline"
                          >
                            + 장소 추가
                          </button>
                          {days.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDay(dayIdx)}
                              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 장소 목록 */}
                      <div className="p-3 space-y-2">
                        {day.stops.map((stop, stopIdx) => (
                          <div key={stopIdx} className="flex gap-2 items-start">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600 mt-2.5">
                              {stopIdx + 1}
                            </div>
                            <div className="flex-1 space-y-1">
                              <input
                                value={stop.place}
                                onChange={(e) => updateStopInDay(dayIdx, stopIdx, "place", e.target.value)}
                                placeholder="장소명 (예: 안목해변 카페거리)"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                              />
                              <input
                                value={stop.note ?? ""}
                                onChange={(e) => updateStopInDay(dayIdx, stopIdx, "note", e.target.value)}
                                placeholder="간단한 메모 (선택)"
                                className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-purple-300"
                              />
                            </div>
                            {day.stops.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStopFromDay(dayIdx, stopIdx)}
                                className="mt-2.5 text-gray-300 hover:text-red-400 transition-colors text-sm"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 일차 추가 버튼 */}
                  <button
                    type="button"
                    onClick={addDay}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-purple-200 py-2.5 text-sm font-semibold text-purple-400 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    + {days.length + 1}일차 추가
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStep("photo")}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ←
              </button>
              <button
                onClick={handlePolish}
                disabled={!title.trim() || !location.trim() || !days.some((d) => d.stops.some((s) => s.place.trim()))}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                ✨ AI로 다듬기
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: AI 폴리시 결과 ── */}
        {step === "polish" && (
          <div className="px-5 py-5">
            {polishing ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="relative h-14 w-14">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
                  <span className="absolute inset-0 flex items-center justify-center text-xl">✨</span>
                </div>
                <p className="font-semibold text-gray-700">AI가 루트를 다듬고 있어요</p>
                <p className="text-xs text-gray-400">감성적인 소개와 여행 팁을 추가하는 중…</p>
              </div>
            ) : polishError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="text-4xl">⚠️</span>
                <p className="text-sm text-red-600">{polishError}</p>
                <button
                  onClick={() => setStep("form")}
                  className="rounded-xl border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  돌아가기
                </button>
              </div>
            ) : polished && (
              <div>
                {/* 미리보기 카드 */}
                <div className="mb-4 rounded-2xl overflow-hidden shadow-md">
                  <div
                    className={`relative h-36 bg-gradient-to-br ${GRAD_FALLBACKS[0]}`}
                  >
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="preview"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {polished.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="font-bold text-white text-sm">{polished.title}</p>
                      <p className="text-xs text-white/70">📍 {polished.location}</p>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-gray-600">{polished.description}</p>
                    <div className="mt-3 space-y-1.5">
                      {polished.route_items.map((item, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600 mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{item.place}</p>
                            <p className="text-[11px] text-gray-400">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPolished(null); setStep("form"); }}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    다시 입력
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        저장 중…
                      </>
                    ) : (
                      "🚀 공유하기"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: 완료 ── */}
        {step === "done" && (
          <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
            <span className="text-6xl">🎉</span>
            <p className="text-lg font-bold text-gray-800">루트가 공유됐어요!</p>
            <p className="text-sm text-gray-400">피드에서 내 루트를 확인해보세요</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-xl bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────

export default function UserContentPage() {
  const router = useRouter();
  const { isAuthenticated, logout, accessToken } = useLoginStore();
  const userId = getAppUserIdFromToken(accessToken ?? undefined);
  const myNickname = getNicknameFromToken(accessToken ?? undefined);

  const [routes, setRoutes] = useState<UserRoute[]>([]);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [feedLoading, setFeedLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [detailRoute, setDetailRoute] = useState<UserRoute | null>(null);
  const [nicknameQuery, setNicknameQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "mine">("all");

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const loadRoutes = useCallback((opts?: { query?: string; mode?: "all" | "mine" }) => {
    const { query, mode } = opts ?? {};
    setFeedLoading(true);
    const ownerId = (mode ?? viewMode) === "mine" ? userId : undefined;
    fetchUserRoutes(50, 0, userId, query || undefined, ownerId)
      .then((fetched) => {
        setRoutes(fetched);
        setLikedIds(new Set(fetched.filter((r) => r.liked_by_me).map((r) => r.id)));
      })
      .catch(() => setRoutes([]))
      .finally(() => setFeedLoading(false));
  }, [userId, viewMode]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const handleTabChange = useCallback((mode: "all" | "mine") => {
    setViewMode(mode);
    setSearchInput("");
    setNicknameQuery("");
    loadRoutes({ mode });
  }, [loadRoutes]);

  const handleSearch = useCallback(() => {
    setNicknameQuery(searchInput.trim());
    loadRoutes({ query: searchInput.trim() });
  }, [searchInput, loadRoutes]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setNicknameQuery("");
    loadRoutes({ query: "" });
  }, [loadRoutes]);

  const handleLike = useCallback(async (id: number) => {
    if (!userId) return;
    // 낙관적 업데이트: 즉시 하트 채우기 + 카운트 +1
    setLikedIds((prev) => new Set(prev).add(id));
    setRoutes((prev) => {
      const updated = prev.map((r) => r.id === id ? { ...r, likes: r.likes + 1 } : r);
      return [...updated].sort((a, b) => b.likes - a.likes || b.id - a.id);
    });
    try {
      const res = await likeUserRoute(id, userId);
      if (res.already_liked) {
        // 이미 좋아요: 낙관적 +1 취소하고 서버 값으로 보정
        setLikedIds((prev) => new Set(prev).add(id));
        setRoutes((prev) => {
          const corrected = prev.map((r) => r.id === id ? { ...r, likes: res.likes } : r);
          return [...corrected].sort((a, b) => b.likes - a.likes || b.id - a.id);
        });
        return;
      }
      // 서버 반환 좋아요 수로 보정
      setRoutes((prev) => {
        const updated = prev.map((r) => r.id === id ? { ...r, likes: res.likes } : r);
        return [...updated].sort((a, b) => b.likes - a.likes || b.id - a.id);
      });
    } catch {
      // 실패 시 낙관적 업데이트 롤백
      setLikedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setRoutes((prev) => {
        const reverted = prev.map((r) => r.id === id ? { ...r, likes: Math.max(0, r.likes - 1) } : r);
        return [...reverted].sort((a, b) => b.likes - a.likes || b.id - a.id);
      });
    }
  }, [userId]);

  const handleSaved = useCallback((saved: UserRoute) => {
    setRoutes((prev) => {
      const updated = [saved, ...prev];
      return [...updated].sort((a, b) => b.likes - a.likes || b.id - a.id);
    });
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!userId) return;
    if (!window.confirm("이 루트를 삭제하시겠습니까?")) return;
    try {
      await deleteUserRoute(id, userId);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      if (detailRoute?.id === id) setDetailRoute(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }, [userId, detailRoute]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/planner")}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-800">유저 컨텐츠</h2>
              <p className="text-[11px] text-gray-400">여행자들이 공유한 추천 루트</p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
            >
              <span className="text-base leading-none">＋</span>
              내 루트 업로드
            </button>
          </div>

          {/* 전체 / 내 루트 탭 */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition-all
                ${viewMode === "all"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              🌍 전체 루트
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("mine")}
              disabled={!userId}
              className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition-all disabled:opacity-40
                ${viewMode === "mine"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              👤 내 루트
            </button>
          </div>

          {/* 닉네임 검색창 (전체 탭에서만 표시) */}
          {viewMode === "all" && <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="닉네임으로 검색..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm text-gray-800 outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-xl bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 transition-colors"
            >
              검색
            </button>
          </div>}

          {/* 검색 중 표시 */}
          {viewMode === "all" && nicknameQuery && (
            <p className="text-xs text-purple-600">
              <span className="font-semibold">"{nicknameQuery}"</span> 닉네임 검색 결과
              <button type="button" onClick={handleClearSearch} className="ml-2 text-gray-400 hover:text-gray-600 underline">전체 보기</button>
            </p>
          )}
        </div>

        {/* 피드 */}
        <div className="flex-1 overflow-y-auto p-6">
          {feedLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-64 rounded-2xl bg-gray-200 animate-pulse"
                  style={{ aspectRatio: "2/3" }}
                />
              ))}
            </div>
          ) : routes.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center py-24">
              {viewMode === "mine" ? (
                <>
                  <span className="text-6xl">🗺️</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-700">아직 내가 올린 루트가 없습니다</p>
                    <p className="mt-1.5 text-sm text-gray-400">나만의 여행 루트를 공유해보세요!</p>
                  </div>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 rounded-xl border border-purple-300 bg-white px-5 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors shadow-sm"
                  >
                    ＋ 첫 루트 올리기
                  </button>
                </>
              ) : (
                <>
                  <span className="text-6xl">👥</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-700">아직 공유된 루트가 없습니다</p>
                    <p className="mt-1.5 text-sm text-gray-400">첫 번째로 루트를 공유해보세요!</p>
                  </div>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 rounded-xl border border-purple-300 bg-white px-5 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors shadow-sm"
                  >
                    ＋ 첫 번째로 루트를 공유해보세요
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  liked={likedIds.has(route.id)}
                  isOwner={!!userId && route.user_id === userId}
                  onLike={handleLike}
                  onOpen={setDetailRoute}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          userId={userId}
          nickname={myNickname}
          onClose={() => setShowUpload(false)}
          onSaved={(saved) => {
            handleSaved(saved);
            setShowUpload(false);
          }}
        />
      )}

      {detailRoute && (
        <RouteDetailModal
          route={detailRoute}
          userId={userId}
          onClose={() => setDetailRoute(null)}
        />
      )}
    </AppLayout>
  );
}
