"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import { getAppUserIdFromToken } from "@/lib/api/auth";
import {
  polishRoute,
  saveUserRoute,
  fetchUserRoutes,
  likeUserRoute,
  type UserRoute,
  type RouteItemInput,
  type PolishedRouteItem,
  type PolishResponse,
} from "@/lib/api/userContent";

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
  onLike,
  onOpen,
}: {
  route: UserRoute;
  onLike: (id: number) => void;
  onOpen: (route: UserRoute) => void;
}) {
  const grad = GRAD_FALLBACKS[route.id % GRAD_FALLBACKS.length];
  const imgSrc = route.image_data
    ? `data:${route.image_mime ?? "image/jpeg"};base64,${route.image_data}`
    : null;

  return (
    <div
      className="group relative shrink-0 w-64 cursor-pointer rounded-2xl overflow-hidden shadow-md transition-all duration-200 hover:scale-105 hover:shadow-xl"
      style={{ aspectRatio: "2/3" }}
      onClick={() => onOpen(route)}
    >
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
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
          onLike(route.id);
        }}
        className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
      >
        ❤ {route.likes}
      </button>

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
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 루트 상세 모달
// ────────────────────────────────────────────────────────────

function RouteDetailModal({
  route,
  onClose,
}: {
  route: UserRoute;
  onClose: () => void;
}) {
  const imgSrc = route.image_data
    ? `data:${route.image_mime ?? "image/jpeg"};base64,${route.image_data}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* 사진 헤더 */}
        <div className="relative h-52 shrink-0">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt={route.title} className="h-full w-full object-cover" />
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

        <div className="flex-1 overflow-y-auto p-5">
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
  onClose,
  onSaved,
}: {
  userId: number | null;
  onClose: () => void;
  onSaved: (route: UserRoute) => void;
}) {
  const [step, setStep] = useState<Step>("photo");

  // Step 1 – 사진
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 – 폼
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [stops, setStops] = useState<RouteItemInput[]>([
    { place: "", note: "" },
    { place: "", note: "" },
    { place: "", note: "" },
  ]);

  // Step 3 – AI 결과
  const [polishing, setPolishing] = useState(false);
  const [polished, setPolished] = useState<PolishResponse | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // data:image/jpeg;base64,XXXX → 분리
      const [header, b64] = result.split(",");
      const mime = header.replace("data:", "").replace(";base64", "");
      setImageData(b64);
      setImageMime(mime);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const [header, b64] = result.split(",");
      const mime = header.replace("data:", "").replace(";base64", "");
      setImageData(b64);
      setImageMime(mime);
    };
    reader.readAsDataURL(file);
  };

  const addStop = () => setStops((s) => [...s, { place: "", note: "" }]);
  const removeStop = (i: number) => setStops((s) => s.filter((_, idx) => idx !== i));
  const updateStop = (i: number, field: keyof RouteItemInput, val: string) => {
    setStops((s) => s.map((st, idx) => (idx === i ? { ...st, [field]: val } : st)));
  };

  const handlePolish = useCallback(async () => {
    const validStops = stops.filter((s) => s.place.trim());
    if (!title.trim() || !location.trim() || validStops.length === 0) return;
    setPolishing(true);
    setPolishError(null);
    setStep("polish");
    try {
      const result = await polishRoute({
        title: title.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        route_items: validStops,
      });
      setPolished(result);
    } catch (e) {
      setPolishError(e instanceof Error ? e.message : "AI 폴리시 실패");
    } finally {
      setPolishing(false);
    }
  }, [title, location, description, stops]);

  const handleSave = useCallback(async () => {
    if (!polished) return;
    setSaving(true);
    try {
      const saved = await saveUserRoute({
        user_id: userId,
        title: polished.title,
        location: polished.location,
        description: polished.description,
        route_items: polished.route_items,
        tags: polished.tags,
        image_data: imageData,
        image_mime: imageMime,
      });
      onSaved(saved);
      setStep("done");
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [polished, userId, imageData, imageMime, onSaved]);

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
              {imageData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${imageMime};base64,${imageData}`}
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
            {imageData && (
              <button
                onClick={() => { setImageData(null); setImageMime(null); }}
                className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                ✕ 사진 제거
              </button>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("form")}
                className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
              >
                {imageData ? "다음 →" : "사진 없이 계속"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: 폼 ── */}
        {step === "form" && (
          <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">
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
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600">장소 목록 *</label>
                  <button
                    onClick={addStop}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    + 장소 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {stops.map((stop, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-600 mt-2.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <input
                          value={stop.place}
                          onChange={(e) => updateStop(i, "place", e.target.value)}
                          placeholder="장소명 (예: 안목해변 카페거리)"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                        />
                        <input
                          value={stop.note ?? ""}
                          onChange={(e) => updateStop(i, "note", e.target.value)}
                          placeholder="간단한 메모 (선택)"
                          className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-purple-300"
                        />
                      </div>
                      {stops.length > 1 && (
                        <button
                          onClick={() => removeStop(i)}
                          className="mt-2.5 text-gray-300 hover:text-red-400 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
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
                disabled={!title.trim() || !location.trim() || !stops.some((s) => s.place.trim())}
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
                    {imageData && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:${imageMime};base64,${imageData}`}
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

  const [routes, setRoutes] = useState<UserRoute[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [detailRoute, setDetailRoute] = useState<UserRoute | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  useEffect(() => {
    fetchUserRoutes()
      .then(setRoutes)
      .catch(() => setRoutes([]))
      .finally(() => setFeedLoading(false));
  }, []);

  const handleLike = useCallback(async (id: number) => {
    try {
      const res = await likeUserRoute(id);
      setRoutes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, likes: res.likes } : r))
      );
    } catch {
      // 무시
    }
  }, []);

  const handleSaved = useCallback((saved: UserRoute) => {
    setRoutes((prev) => [saved, ...prev]);
  }, []);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
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
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onLike={handleLike}
                  onOpen={setDetailRoute}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          userId={userId}
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
          onClose={() => setDetailRoute(null)}
        />
      )}
    </div>
  );
}
