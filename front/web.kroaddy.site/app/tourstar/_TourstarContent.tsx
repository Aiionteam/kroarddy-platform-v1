"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginStore } from "@/store";
import { findUserById, findUserByNickname } from "@/lib/api/user";
import { listFriends, sendFriendRequest } from "@/lib/api/friends";
import type { UserModel } from "@/lib/api/user";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useTranslation } from "react-i18next";
import {
  buildTourstarImageUrl,
  buildTourstarShareUrl,
  createTourstarComment,
  createTourstarPost,
  finalizeTourstarUploads,
  generateTourstarAutoComment,
  generateTourstarPost,
  getTourstarJobStatus,
  listTourstarPosts,
  localArtifactPathToUrl,
  deleteTourstarPost,
  toggleTourstarLike,
  updateTourstarPost,
  uploadProfileImage,
  fetchProfileImage,
  type TourstarPostRecord,
  type TourstarStyleFilter,
  uploadTourstarPhotos,
} from "@/lib/api/tourstar";
import { fetchMyPlans, type TravelPlanRecord } from "@/lib/api/planner";

/* ────────────────────────── 타입 정의 ────────────────────────── */
type Visibility = "public" | "private";
type ViewMode = "grid" | "feed";
type FilterType = "all" | "mine" | "bookmarked" | "friends";
type SortType = "latest" | "likes" | "comments";
type SearchField = "all" | "author" | "title" | "content" | "tags" | "location";

const PLACEHOLDER_AUTHOR_KO = "내 여행기록";

type RelativeTimeLabels = {
  now: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
};

function formatRelativeTime(isoLike: string, labels?: RelativeTimeLabels): string {
  const t = Date.parse(isoLike);
  if (Number.isNaN(t)) return "";
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 0) return labels?.now ?? "방금 전";
  if (diffSec < 60) return labels?.now ?? "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return (labels?.minutesAgo ?? "{{count}}분 전").replace("{{count}}", String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return (labels?.hoursAgo ?? "{{count}}시간 전").replace("{{count}}", String(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return (labels?.daysAgo ?? "{{count}}일 전").replace("{{count}}", String(diffDay));
  return isoLike.slice(0, 10);
}

interface TourPhoto {
  id: string;
  gradient: string;
  selected: boolean;
  imageUrl?: string;
  fileName?: string;
  /** 업로드 전 클라이언트에서 읽은 촬영 시각(EXIF). 없으면 null */
  shotAt?: string | null;
  sourceImagePath?: string;
  aiRank?: number;
  aiScore?: number;
}

interface TourPostComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  authorProfileImageUrl?: string | null;
}

interface TourPost {
  id: string;
  userId?: number | null;
  author: string;
  authorProfileImageUrl?: string | null;
  title: string;
  location: string;
  date: string;
  comment: string;
  visibility: Visibility;
  photos: TourPhoto[];
  likes: number;
  liked: boolean;
  tags: string[];
  comments: TourPostComment[];
  isOwner: boolean;
  bookmarked: boolean;
  isFriend: boolean;
  /** 서버 `attached_schedule` — 플래너 일정 스냅샷 */
  attachedSchedule?: Record<string, unknown> | null;
}

function stripHashtags(text: string): string {
  return text.replace(/#[\w\uAC00-\uD7A3\uAC00-\uD7A3]+/g, "").replace(/\s{2,}/g, " ").trim();
}

function attachedScheduleFromTravelPlan(plan: TravelPlanRecord): Record<string, unknown> {
  return {
    plan_id: plan.id,
    route_name: plan.route_name,
    location: plan.location,
    start_date: plan.start_date,
    end_date: plan.end_date,
    schedule: plan.schedule.map((s) => ({
      day: s.day,
      date: s.date,
      time: s.time,
      place: s.place,
      title: s.title,
      description: s.description,
      tips: s.tips,
      estimated_cost: s.estimated_cost,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      business_hours: s.business_hours,
    })),
  };
}

function parseAttachedScheduleRaw(raw: unknown): Record<string, unknown> | null {
  let v: unknown = raw;
  for (let i = 0; i < 2; i += 1) {
    if (v == null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      if (s === "" || s === "null") return null;
      try {
        v = JSON.parse(s) as unknown;
      } catch {
        return null;
      }
      continue;
    }
    break;
  }
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function tourstarAttachedScheduleIsEmpty(data: Record<string, unknown> | null | undefined): boolean {
  if (!data || Object.keys(data).length === 0) return true;
  const planId = data.plan_id;
  if (planId != null && String(planId).trim() !== "") return false;
  const sched = data.schedule;
  if (Array.isArray(sched) && sched.length > 0) return false;
  const title = `${String(data.route_name ?? "")}${String(data.location ?? "")}`.trim();
  return title.length === 0;
}

function postHasAttachedSchedule(post: TourPost): boolean {
  return !tourstarAttachedScheduleIsEmpty(post.attachedSchedule ?? null);
}

/** DB user_id 와 JWT 를 같은 숫자 기준으로 맞춤.
 *  user_id가 있으면 숫자 비교 우선. 없거나 불일치 시 닉네임 폴백 허용. */
function computeIsOwner(
  postUserId: number | null | undefined,
  currentUserId: number | null | undefined,
  postAuthor: string,
  sessionAuthorLabel: string,
): boolean {
  const cur = currentUserId != null && Number.isFinite(Number(currentUserId)) ? Number(currentUserId) : null;
  const pid = postUserId != null && Number.isFinite(Number(postUserId)) ? Number(postUserId) : null;
  // 숫자 ID가 둘 다 있으면 숫자로만 판별
  if (cur != null && pid != null) return pid === cur;
  // 게시글 또는 세션에 숫자 ID가 없으면 닉네임으로 폴백
  // (플레이스홀더 "내 여행기록"은 실제 닉네임이 아니므로 제외)
  const safePost = postAuthor.trim();
  const safeSession = sessionAuthorLabel.trim();
  if (
    safeSession &&
    safeSession !== PLACEHOLDER_AUTHOR_KO &&
    safePost &&
    safePost !== PLACEHOLDER_AUTHOR_KO &&
    safePost === safeSession
  ) {
    return true;
  }
  return false;
}

const STYLE_FILTER_AUTO: { value: TourstarStyleFilter; label: string; i18nKey: string } = {
  value: "AUTO",
  label: "자동 (기본)",
  i18nKey: "tourstar.create.style_auto",
};

const STYLE_FILTER_GROUPS: Array<{
  title: string;
  i18nKey: string;
  options: Array<{ value: TourstarStyleFilter; label: string }>;
}> = [
    {
      title: "분석/전략형 (NT)",
      i18nKey: "tourstar.create.style_group.nt",
      options: [
        { value: "INTJ", label: "INTJ" },
        { value: "INTP", label: "INTP" },
        { value: "ENTJ", label: "ENTJ" },
        { value: "ENTP", label: "ENTP" },
      ],
    },
    {
      title: "외교/감성형 (NF)",
      i18nKey: "tourstar.create.style_group.nf",
      options: [
        { value: "INFJ", label: "INFJ" },
        { value: "INFP", label: "INFP" },
        { value: "ENFJ", label: "ENFJ" },
        { value: "ENFP", label: "ENFP" },
      ],
    },
    {
      title: "관리/실무형 (SJ)",
      i18nKey: "tourstar.create.style_group.sj",
      options: [
        { value: "ISTJ", label: "ISTJ" },
        { value: "ISFJ", label: "ISFJ" },
        { value: "ESTJ", label: "ESTJ" },
        { value: "ESFJ", label: "ESFJ" },
      ],
    },
    {
      title: "탐험/즉흥형 (SP)",
      i18nKey: "tourstar.create.style_group.sp",
      options: [
        { value: "ISTP", label: "ISTP" },
        { value: "ISFP", label: "ISFP" },
        { value: "ESTP", label: "ESTP" },
        { value: "ESFP", label: "ESFP" },
      ],
    },
  ];

/* ───────────────────── 플레이스홀더 그라디언트 ───────────────────── */
const GRADIENTS = [
  "from-sky-300 to-blue-500",
  "from-orange-300 to-rose-400",
  "from-emerald-300 to-teal-500",
  "from-violet-300 to-purple-500",
  "from-pink-300 to-fuchsia-500",
  "from-amber-200 to-orange-400",
  "from-cyan-300 to-sky-500",
  "from-lime-300 to-emerald-400",
  "from-rose-300 to-pink-500",
  "from-indigo-300 to-blue-500",
];

function randomGradient() {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
}

/* ───────────────────── 아이콘 컴포넌트들 ───────────────────── */
function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TourstarAttachedSchedulePreview({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const route = String(data.route_name ?? "");
  const loc = String(data.location ?? "");
  const start = data.start_date != null ? String(data.start_date) : "";
  const end = data.end_date != null ? String(data.end_date) : "";
  const dateParts = [start, end].filter((x) => x.length > 0);
  const dateLine = dateParts.join(" ~ ");
  const raw = data.schedule;
  const byDay = new Map<number, Record<string, unknown>[]>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const d = typeof row.day === "number" ? row.day : Number(row.day) || 1;
      const arr = byDay.get(d) ?? [];
      arr.push(row);
      byDay.set(d, arr);
    }
  }
  const dayKeys = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50/90 p-3 text-left shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gray-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-indigo-600">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {t("tourstar.schedule.section_title", { defaultValue: "일정표" })}
      </div>
      {route ? <p className="text-sm font-semibold text-gray-900">{route}</p> : null}
      {(loc || dateLine) ? (
        <p className="mt-0.5 text-xs text-gray-500">
          {[loc, dateLine].filter((s) => s.length > 0).join(" · ")}
        </p>
      ) : null}
      {dayKeys.length > 0 ? (
        <div className="mt-3 space-y-3">
          {dayKeys.map((day) => (
            <div key={day}>
              <p className="mb-1.5 text-xs font-semibold text-indigo-600">
                {t("tourstar.schedule.day_n", { n: day, defaultValue: "{{n}}일차" })}
              </p>
              <ul className="space-y-1.5">
                {(byDay.get(day) ?? []).map((s, idx) => {
                  const place = String(s.place ?? "");
                  const time = String(s.time ?? "");
                  const title = String(s.title ?? "");
                  const line = [time, place].filter((x) => x.length > 0).join(" · ");
                  const sub = title && title !== place ? title : "";
                  return (
                    <li key={`${day}-${idx}`} className="text-xs text-gray-700">
                      <span className="text-gray-400">• </span>
                      {line ? <span>{line}</span> : null}
                      {sub ? <span className="mt-0.5 block pl-3 text-[11px] text-gray-500">{sub}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────── 새 게시물 작성 모달 ───────────────────── */
interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (post: Omit<TourPost, "id" | "author" | "likes" | "liked" | "comments" | "isOwner" | "bookmarked" | "userId" | "isFriend">) => Promise<void> | void;
  onJobStatusChange?: (status: string) => void;
  currentUserId?: number | null;
}

function CreatePostModal({ open, onClose, onCreate, onJobStatusChange, currentUserId }: CreateModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    comment: "",
    location: "",
    styleFilter: "AUTO" as TourstarStyleFilter,
    styleTemplate: "",
    visibility: "public" as Visibility,
  });
  const [photos, setPhotos] = useState<TourPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFilteringByDate, setIsFilteringByDate] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: "",
    includeUnknownDate: false,
  });
  const [openStyleGroup, setOpenStyleGroup] = useState<string | null>(
    STYLE_FILTER_GROUPS[0]?.title ?? null,
  );
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [myPlans, setMyPlans] = useState<TravelPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [attachedScheduleSnapshot, setAttachedScheduleSnapshot] = useState<Record<string, unknown> | null>(null);
  const prevCreateOpen = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open && !prevCreateOpen.current) {
      setPlanPickerOpen(false);
      setAttachedScheduleSnapshot(null);
      setMyPlans([]);
    }
    prevCreateOpen.current = open;
  }, [open]);

  const openPlanPicker = async () => {
    if (currentUserId == null || !Number.isFinite(Number(currentUserId))) return;
    if (myPlans.length > 0) {
      setPlanPickerOpen(true);
      return;
    }
    setPlansLoading(true);
    try {
      const plans = await fetchMyPlans(Number(currentUserId));
      setMyPlans(plans);
      setPlanPickerOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setPlansLoading(false);
    }
  };

  const togglePhoto = (id: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const computeInDateRange = React.useCallback((shotAt: string | null | undefined) => {
    const hasStart = Boolean(dateFilter.startDate);
    const hasEnd = Boolean(dateFilter.endDate);
    if (!hasStart && !hasEnd) return true;

    if (!shotAt) return Boolean(dateFilter.includeUnknownDate);
    const shotDate = new Date(shotAt);
    if (Number.isNaN(shotDate.getTime())) return Boolean(dateFilter.includeUnknownDate);

    const startAt = hasStart ? new Date(`${dateFilter.startDate}T00:00:00`) : null;
    const endAt = hasEnd ? new Date(`${dateFilter.endDate}T23:59:59.999`) : null;
    const inStart = startAt ? shotDate >= startAt : true;
    const inEnd = endAt ? shotDate <= endAt : true;
    return inStart && inEnd;
  }, [dateFilter.endDate, dateFilter.includeUnknownDate, dateFilter.startDate]);

  const parseExifShotDate = async (file: File): Promise<Date | null> => {
    try {
      const exifr = await import("exifr");
      const meta = await exifr.parse(file, [
        "DateTimeOriginal",
        "CreateDate",
        "DateTimeDigitized",
        "ModifyDate",
      ]);
      const raw =
        meta?.DateTimeOriginal ?? meta?.CreateDate ?? meta?.DateTimeDigitized ?? meta?.ModifyDate;
      if (!raw) return null;
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
      if (typeof raw === "string") {
        const normalized = raw
          .trim()
          .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
          .replace(" ", "T");
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    } catch {
      // 일부 파일(특히 메신저/편집 앱 경유)은 EXIF가 없거나 파싱 실패할 수 있다.
      // UX 관점에서 기간 필터가 너무 보수적으로 빠지지 않도록 브라우저 파일 메타(lastModified)로 폴백한다.
      const lm = typeof file.lastModified === "number" ? file.lastModified : NaN;
      if (!Number.isNaN(lm) && lm > 0) {
        const d = new Date(lm);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
  };

  const filterFilesByDateRange = async (files: File[]) => {
    const hasStart = Boolean(dateFilter.startDate);
    const hasEnd = Boolean(dateFilter.endDate);
    if (!hasStart && !hasEnd) {
      return { filteredFiles: files, excludedCount: 0, unknownCount: 0 };
    }

    const startAt = hasStart ? new Date(`${dateFilter.startDate}T00:00:00`) : null;
    const endAt = hasEnd ? new Date(`${dateFilter.endDate}T23:59:59.999`) : null;
    const filteredFiles: File[] = [];
    let unknownCount = 0;

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const shotDate = await parseExifShotDate(file);
      if (!shotDate) {
        unknownCount += 1;
        if (dateFilter.includeUnknownDate) {
          filteredFiles.push(file);
        }
        continue;
      }

      const inStart = startAt ? shotDate >= startAt : true;
      const inEnd = endAt ? shotDate <= endAt : true;
      if (inStart && inEnd) {
        filteredFiles.push(file);
      }
    }

    return {
      filteredFiles,
      excludedCount: Math.max(0, files.length - filteredFiles.length),
      unknownCount,
    };
  };

  const handleUploadPhotos = async (files: File[]) => {
    if (files.length === 0 || isUploading) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    try {
      // 업로드 전에 촬영일(EXIF)을 읽어 두고, 이후 기간 변경 시 자동 선택에 활용한다.
      const shotDates = await Promise.all(imageFiles.map((f) => parseExifShotDate(f)));
      const result = await uploadTourstarPhotos(imageFiles);
      const mapped: TourPhoto[] = result.uploaded.map((item, idx) => ({
        id: `upload-${Date.now()}-${idx}`,
        gradient: randomGradient(),
        shotAt: shotDates[idx] ? shotDates[idx]!.toISOString() : null,
        selected: computeInDateRange(shotDates[idx] ? shotDates[idx]!.toISOString() : null),
        imageUrl: buildTourstarImageUrl(item.url),
        fileName: item.name,
      }));
      setPhotos((prev) => [...prev, ...mapped]);
      if (result.pipeline_job?.job_id) {
        console.log("[tourstar] pipeline queued:", result.pipeline_job.job_id);
        onJobStatusChange?.(t("tourstar.status.photo_queued", { defaultValue: "AI 사진 분석 대기중..." }));
        const jobId = result.pipeline_job.job_id;
        for (let i = 0; i < 60; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // eslint-disable-next-line no-await-in-loop
          const status = await getTourstarJobStatus(jobId);
          if (status.status === "queued") { onJobStatusChange?.(t("tourstar.status.photo_queued", { defaultValue: "AI 사진 분석 대기중..." })); continue; }
          if (status.status === "running") { onJobStatusChange?.(t("tourstar.status.photo_running", { defaultValue: "AI 사진 분석중..." })); continue; }
          if (status.status === "failed") { onJobStatusChange?.(t("tourstar.status.photo_failed", { defaultValue: "AI 분석 실패" })); break; }
          if (status.status === "completed") {
            const rankedRows = status.result?.ranked ?? [];
            if (rankedRows.length > 0) {
              setPhotos((prev) => {
                const ranked = prev
                  .map((p) => {
                    const key = (p.imageUrl ?? "").replace(/\\/g, "/").toLowerCase();
                    const row = rankedRows.find((r) => {
                      const srcUrl = localArtifactPathToUrl(r.source_image).replace(/\\/g, "/").toLowerCase();
                      return srcUrl === key;
                    });
                    if (!row) return { ...p, selected: false, sourceImagePath: undefined, aiRank: undefined, aiScore: undefined };
                    return { ...p, selected: false, sourceImagePath: row.source_image, aiRank: row.rank, aiScore: row.final_score };
                  })
                  .sort((a, b) => (a.aiRank ?? Number.MAX_SAFE_INTEGER) - (b.aiRank ?? Number.MAX_SAFE_INTEGER));
                return ranked;
              });
              onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" }));
              try {
                const topImagePaths = rankedRows.map((r) => r.source_image).filter((v) => !!v).slice(0, 3);
                if (topImagePaths.length > 0) {
                  onJobStatusChange?.(t("tourstar.status.comment_draft_running", { defaultValue: "AI 분석 완료 (코멘트 초안 생성중...)" }));
                  const auto = await generateTourstarAutoComment(topImagePaths, 3);
                  if ((auto.comment || "").trim()) {
                    setForm((prev) => { if (prev.comment.trim().length > 0) return prev; return { ...prev, comment: auto.comment.trim() }; });
                    onJobStatusChange?.(t("tourstar.status.comment_draft_done", { defaultValue: "AI 분석 완료 (코멘트 초안 생성됨)" }));
                  } else { onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" })); }
                }
              } catch (error) { console.error(error); onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" })); }
            } else {
              const bestRows = status.result?.best ?? [];
              if (bestRows.length > 0) {
                setPhotos((prev) => prev.map((p) => {
                  const key = (p.imageUrl ?? "").replace(/\\/g, "/").toLowerCase();
                  const row = bestRows.find((r) => {
                    const srcUrl = localArtifactPathToUrl(r.source_image).replace(/\\/g, "/").toLowerCase();
                    return srcUrl === key;
                  });
                  return { ...p, selected: false, sourceImagePath: row?.source_image, aiRank: row?.rank, aiScore: row?.final_score, imageUrl: row ? localArtifactPathToUrl(row.saved_image) || p.imageUrl : p.imageUrl };
                }));
                onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" }));
                try {
                  const topImagePaths = bestRows.map((r) => r.source_image).filter((v) => !!v).slice(0, 3);
                  if (topImagePaths.length > 0) {
                    onJobStatusChange?.(t("tourstar.status.comment_draft_running", { defaultValue: "AI 분석 완료 (코멘트 초안 생성중...)" }));
                    const auto = await generateTourstarAutoComment(topImagePaths, 3);
                    if ((auto.comment || "").trim()) {
                      setForm((prev) => { if (prev.comment.trim().length > 0) return prev; return { ...prev, comment: auto.comment.trim() }; });
                      onJobStatusChange?.(t("tourstar.status.comment_draft_done", { defaultValue: "AI 분석 완료 (코멘트 초안 생성됨)" }));
                    } else { onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" })); }
                  }
                } catch (error) { console.error(error); onJobStatusChange?.(t("tourstar.status.photo_done_pick", { defaultValue: "AI 분석 완료 (순위 확인 후 사진 선택)" })); }
              } else { onJobStatusChange?.(t("tourstar.status.photo_done", { defaultValue: "AI 분석 완료" })); }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert(t("tourstar.error.upload_photo", { defaultValue: "사진 업로드에 실패했습니다. tourstar 서버 실행 상태를 확인해 주세요." }));
      onJobStatusChange?.(t("tourstar.status.upload_failed", { defaultValue: "업로드 실패" }));
    } finally {
      setIsUploading(false);
    }
  };

  // 기간이 설정/변경되면, 이미 업로드된 사진도 자동으로 기간 내 항목만 선택 상태로 맞춘다.
  React.useEffect(() => {
    setPhotos((prev) => prev.map((p) => ({ ...p, selected: computeInDateRange(p.shotAt) })));
  }, [computeInDateRange]);

  const handleUploadPhotosWithDateFilter = async (files: File[] | null) => {
    if (!files || files.length === 0 || isUploading || isFilteringByDate) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setIsFilteringByDate(true);
    try {
      onJobStatusChange?.(t("tourstar.status.checking_metadata", { defaultValue: "촬영일 메타데이터 확인중..." }));
      const { filteredFiles, excludedCount, unknownCount } = await filterFilesByDateRange(imageFiles);
      if (filteredFiles.length === 0) {
        onJobStatusChange?.(t("tourstar.status.no_photo_in_range", { defaultValue: "조건에 맞는 사진 없음" }));
        alert(t("tourstar.error.no_photo_for_period", { unknownCount, excludedCount, defaultValue: "선택한 기간에 해당하는 사진이 없습니다.\n(메타데이터 없음: {{unknownCount}}장, 제외: {{excludedCount}}장)" }));
        return;
      }
      if (excludedCount > 0) {
        onJobStatusChange?.(t("tourstar.status.filtered_uploading", { excludedCount, filteredCount: filteredFiles.length, defaultValue: "기간 조건으로 {{excludedCount}}장 제외, {{filteredCount}}장 자동 업로드중..." }));
      } else {
        onJobStatusChange?.(t("tourstar.status.uploading_count", { count: filteredFiles.length, defaultValue: "{{count}}장 업로드중..." }));
      }
      await handleUploadPhotos(filteredFiles);
    } finally {
      setIsFilteringByDate(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-800">{t("tourstar.create.title", { defaultValue: "새 여행 기록 만들기" })}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <p className="mb-5 text-xs text-gray-400">{t("tourstar.create.subtitle", { defaultValue: "사진을 올리면 AI가 잘 나온 사진을 자동으로 추려드려요 ✨" })}</p>
        <div className="space-y-4">
          <div>
            <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-semibold text-gray-600">{t("tourstar.create.filter_by_date", { defaultValue: "촬영일 기간 자동 선별 (메타데이터 기반)" })}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">{t("tourstar.create.start_date", { defaultValue: "시작일" })}
                  <input type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">{t("tourstar.create.end_date", { defaultValue: "종료일" })}
                  <input type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none" />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                <input type="checkbox" checked={dateFilter.includeUnknownDate}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, includeUnknownDate: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-400" />
                {t("tourstar.create.include_unknown_shot_date", { defaultValue: "촬영일 메타데이터가 없는 사진도 포함" })}
              </label>
              <p className="mt-1 text-[10px] text-gray-400">{t("tourstar.create.date_filter_note", { defaultValue: "날짜를 입력하면 해당 기간에 촬영된 사진만 자동 업로드됩니다. (OpenAI 미사용)" })}</p>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">
                {t("tourstar.create.photo_selected_count", {
                  selected: photos.filter((p) => p.selected).length,
                  total: photos.length,
                  defaultValue: "사진 ({{selected}}/{{total}} 선택됨)",
                })}
              </label>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">{t("tourstar.create.file_upload", { defaultValue: "파일 업로드" })}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <button key={photo.id} type="button" onClick={() => togglePhoto(photo.id)}
                  className={`group relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${photo.gradient} transition-all ${photo.selected ? "ring-3 ring-purple-500 ring-offset-2" : "opacity-50 hover:opacity-75"}`}>
                  {photo.imageUrl ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} /> : null}
                  <div className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white transition-all ${photo.selected ? "bg-purple-500" : "bg-black/30"}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  {photo.aiRank ? <div className="absolute top-1.5 left-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 backdrop-blur-sm">#{photo.aiRank}</div> : null}
                  {!photo.imageUrl ? <div className="absolute inset-0 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div> : null}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isFilteringByDate}
                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors">
                {isFilteringByDate
                  ? t("tourstar.create.checking_shot_date", { defaultValue: "촬영일 확인중..." })
                  : isUploading
                  ? t("tourstar.create.uploading", { defaultValue: "업로드 중..." })
                  : t("tourstar.create.upload_files", { defaultValue: "+ 사진 파일 올리기" })}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async (e) => { await handleUploadPhotosWithDateFilter(e.target.files ? Array.from(e.target.files) : null); e.target.value = ""; }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.create.location_optional", { defaultValue: "장소 (선택)" })}</label>
            <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
              placeholder={t("tourstar.create.location_placeholder", { defaultValue: "예: 서울 강남, 부산 해운대 (비워두면 AI가 자동 추정)" })} value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.create.one_line_comment", { defaultValue: "한줄 코멘트" })}</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none resize-none"
              rows={2} placeholder={t("tourstar.create.comment_placeholder", { defaultValue: "간단한 코멘트만 남기면 자동으로 예쁘게 게시됩니다" })} value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>
          <div>
            <button
              type="button"
              disabled={isGeneratingPost || plansLoading || currentUserId == null}
              onClick={() => void openPlanPicker()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-indigo-200 bg-white py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {plansLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              )}
              {t("tourstar.create.import_saved_schedule", { defaultValue: "저장된 일정에서 가져오기" })}
            </button>
            {currentUserId == null ? (
              <p className="mt-1 text-[10px] text-amber-600">{t("tourstar.create.import_schedule_login", { defaultValue: "로그인 후 플래너에 저장된 일정을 불러올 수 있어요." })}</p>
            ) : null}
            {planPickerOpen ? (
              <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/80 p-2">
                <div className="flex items-center justify-between border-b border-indigo-100 px-1 pb-2">
                  <span className="text-xs font-bold text-indigo-800">{t("tourstar.create.select_saved_plan_title", { defaultValue: "저장된 일정 선택" })}</span>
                  <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setPlanPickerOpen(false)}>{t("common.close", { defaultValue: "닫기" })}</button>
                </div>
                {myPlans.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-500">{t("tourstar.create.no_saved_plans", { defaultValue: "저장된 일정이 없습니다." })}</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-indigo-100">
                    {myPlans.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-2 py-2.5 text-left text-sm hover:bg-white/60"
                          onClick={() => {
                            setAttachedScheduleSnapshot(attachedScheduleFromTravelPlan(p));
                            setPlanPickerOpen(false);
                          }}
                        >
                          <span className="font-semibold text-gray-900">{p.route_name}</span>
                          <span className="mt-0.5 block text-[11px] text-gray-500">
                            {p.location}{p.start_date ? ` · ${p.start_date}` : ""} · {p.schedule.length}
                            {t("tourstar.create.stops_unit", { defaultValue: "곳" })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {attachedScheduleSnapshot != null && !tourstarAttachedScheduleIsEmpty(attachedScheduleSnapshot) ? (
              <div className="mt-3 space-y-1">
                <TourstarAttachedSchedulePreview data={attachedScheduleSnapshot} />
                <div className="text-right">
                  <button type="button" className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setAttachedScheduleSnapshot(null)}>
                    {t("tourstar.create.remove_attached_schedule", { defaultValue: "붙인 일정 제거" })}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.create.style_preset", { defaultValue: "문체 프리셋 (MBTI)" })}</label>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({ ...form, styleFilter: STYLE_FILTER_AUTO.value })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${form.styleFilter === STYLE_FILTER_AUTO.value ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-600"}`}>
                    {t(STYLE_FILTER_AUTO.i18nKey, { defaultValue: STYLE_FILTER_AUTO.label })}
                  </button>
                </div>
                {STYLE_FILTER_GROUPS.map((group) => (
                  <div key={group.title}>
                    <button type="button" onClick={() => setOpenStyleGroup((prev) => (prev === group.title ? null : group.title))}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-semibold text-gray-500 hover:bg-gray-50">
                      <span>{t(group.i18nKey, { defaultValue: group.title })}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        className={`transition-transform ${openStyleGroup === group.title ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openStyleGroup === group.title ? (
                      <div className="flex flex-wrap gap-2 pb-1">
                        {group.options.map((option) => (
                          <button key={option.value} type="button" onClick={() => setForm({ ...form, styleFilter: option.value })}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${form.styleFilter === option.value ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-600"}`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.create.user_template_optional", { defaultValue: "사용자 템플릿 (선택)" })}</label>
              <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                placeholder={t("tourstar.create.style_template_placeholder", { defaultValue: "예) 잔잔하고 여백 있는 감성, 해시태그 3개" })} value={form.styleTemplate}
                onChange={(e) => setForm({ ...form, styleTemplate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">{t("common.cancel", { defaultValue: "취소" })}</button>
          <button type="button" disabled={isGeneratingPost}
            onClick={async () => {
              const selectedPhotos = photos.filter((p) => p.selected);
              if (selectedPhotos.length === 0) return;
              setIsGeneratingPost(true);
              onJobStatusChange?.(t("tourstar.status.post_generating", { defaultValue: "AI 게시글 생성중..." }));
              let generated = {
                title: t("tourstar.create.generated_title", { date: new Date().toLocaleDateString(undefined), defaultValue: "AI 추천 여행 기록 {{date}}" }),
                location: t("tourstar.create.location_empty", { defaultValue: "여행지 미입력" }),
                comment: form.comment || t("tourstar.create.comment_default", { defaultValue: "여행의 소중한 순간을 기록합니다." }),
                tags: [] as string[],
              };
              try {
                const selectedImagePaths = selectedPhotos.map((p) => p.sourceImagePath).filter((v): v is string => Boolean(v && v.trim()));
                generated = await generateTourstarPost(form.comment, form.styleFilter, form.styleTemplate, selectedImagePaths);
              } catch (error) { console.error(error); } finally { setIsGeneratingPost(false); }
              try {
                await onCreate({
                  title: generated.title,
                  location: form.location.trim() || generated.location,
                  date: new Date().toISOString().split("T")[0],
                  comment: generated.comment,
                  visibility: form.visibility,
                  photos: selectedPhotos,
                  tags: generated.tags,
                  attachedSchedule: attachedScheduleSnapshot,
                });
                setForm({ comment: "", location: "", styleFilter: "AUTO", styleTemplate: "", visibility: "public" });
                setPhotos([]);
                onJobStatusChange?.(t("tourstar.status.post_generated", { defaultValue: "AI 게시글 생성 완료" }));
                onClose();
              } catch (error) { console.error(error); onJobStatusChange?.(t("tourstar.status.post_save_failed", { defaultValue: "게시글 저장 실패" })); }
            }}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity">
            {isGeneratingPost ? t("tourstar.create.generating", { defaultValue: "생성중..." }) : t("tourstar.create.submit", { defaultValue: "게시하기" })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── 게시물 수정 모달 ───────────────────── */
interface EditModalProps {
  post: TourPost | null;
  onClose: () => void;
  onSave: (postId: string, updates: {
    title: string;
    location: string;
    comment: string;
    tags: string[];
    keepPhotoUrls: string[];
    photosChanged: boolean;
  }) => Promise<void>;
  onDelete: (postId: string) => Promise<boolean>;
}

function EditPostModal({ post, onClose, onSave, onDelete }: EditModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(post?.title ?? "");
  const [location, setLocation] = useState(post?.location === t("tourstar.placeholder.location_unknown", { defaultValue: "위치 미확인" }) ? "" : (post?.location ?? ""));
  const [comment, setComment] = useState(stripHashtags(post?.comment ?? ""));
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(", "));
  const [existingPhotos, setExistingPhotos] = useState<Array<{ id: string; imageUrl: string; storedUrl: string; keep: boolean }>>([]);
  const [newPhotos, setNewPhotos] = useState<TourPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (post) {
      setTitle(post.title);
      setLocation(post.location === t("tourstar.placeholder.location_unknown", { defaultValue: "위치 미확인" }) ? "" : post.location);
      setComment(stripHashtags(post.comment));
      setTagsInput(post.tags.join(", "));
      setExistingPhotos(
        post.photos
          .map((p, idx) => {
            const storedUrl = (p.sourceImagePath || p.imageUrl || "").trim();
            const imageUrl = (p.imageUrl || (storedUrl ? buildTourstarImageUrl(storedUrl) : "")).trim();
            return { id: `existing-${idx}`, imageUrl, storedUrl, keep: true };
          })
          .filter((p) => !!p.storedUrl),
      );
      setNewPhotos([]);
    }
  }, [post]);

  if (!post) return null;

  const handleUploadNewPhotos = async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setUploading(true);
    try {
      const result = await uploadTourstarPhotos(imageFiles);
      const mapped: TourPhoto[] = result.uploaded.map((item, idx) => ({
        id: `edit-upload-${Date.now()}-${idx}`,
        gradient: randomGradient(),
        selected: true,
        imageUrl: buildTourstarImageUrl(item.url),
        sourceImagePath: item.url,
        fileName: item.name,
      }));
      setNewPhotos((prev) => [...prev, ...mapped]);
    } catch (error) {
      console.error(error);
      window.alert(t("tourstar.error.upload_photo_simple", { defaultValue: "사진 업로드에 실패했습니다." }));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    try {
      const ok = await onDelete(post.id);
      if (ok) onClose();
    } catch (error) {
      console.error(error);
      window.alert(t("tourstar.error.delete_retry", { defaultValue: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }));
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean);
      const keepUrls = existingPhotos.filter((p) => p.keep).map((p) => p.storedUrl).filter(Boolean);
      const newPaths = newPhotos.map((p) => p.sourceImagePath).filter((v): v is string => Boolean(v?.trim()));
      const existingPhotosRemoved = existingPhotos.some((p) => !p.keep);

      // 신규 사진이 있으면 저장 전에 S3 업로드를 먼저 완료한 뒤 S3 URL을 keep_photo_urls에 포함
      let finalKeepUrls = keepUrls;
      if (newPaths.length > 0) {
        const { s3_urls, failed_count } = await finalizeTourstarUploads(newPaths);
        finalKeepUrls = [...keepUrls, ...s3_urls];
        if (failed_count > 0 && s3_urls.length === 0) {
          throw new Error(
            t("tourstar.error.upload_failed_count", {
              count: failed_count,
              defaultValue: "사진 업로드에 실패했습니다. ({{count}}장 실패)",
            })
          );
        }
        if (failed_count > 0) {
          window.alert(
            t("tourstar.error.partial_upload_failed", {
              count: failed_count,
              defaultValue: "{{count}}장의 사진 업로드에 실패했습니다. 성공한 사진만 저장됩니다.",
            })
          );
        }
      }

      const photosChanged = existingPhotosRemoved || newPaths.length > 0;
      await onSave(post.id, {
        title: title.trim(),
        location: location.trim() || t("tourstar.placeholder.location_unknown", { defaultValue: "위치 미확인" }),
        comment: stripHashtags(comment),
        tags,
        keepPhotoUrls: finalKeepUrls,
        photosChanged,
      });
      onClose();
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : String(error);
      window.alert(t("tourstar.error.edit_failed_with_detail", { detail, defaultValue: "게시글 수정에 실패했습니다.\n{{detail}}" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">{t("tourstar.edit.title", { defaultValue: "게시글 수정" })}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.edit.field_title", { defaultValue: "제목" })}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tourstar.edit.title_placeholder", { defaultValue: "제목을 입력하세요" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.edit.field_location", { defaultValue: "장소" })}</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder={t("tourstar.edit.location_placeholder", { defaultValue: "예: 서울 강남, 부산 해운대" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.edit.field_body", { defaultValue: "본문" })}</label>
            <textarea rows={6} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={t("tourstar.edit.body_placeholder", { defaultValue: "본문을 입력하세요" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none resize-none" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-500">{t("tourstar.edit.photo_edit", { defaultValue: "사진 수정" })}</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors disabled:opacity-50"
              >
                {uploading ? t("tourstar.create.uploading", { defaultValue: "업로드 중..." }) : t("tourstar.edit.add_photo", { defaultValue: "+ 사진 추가" })}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  await handleUploadNewPhotos(e.target.files ? Array.from(e.target.files) : []);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {existingPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setExistingPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, keep: !p.keep } : p))}
                  className={`relative aspect-square overflow-hidden rounded-lg border transition-all ${
                    photo.keep ? "border-purple-300 ring-2 ring-purple-200" : "border-gray-200 opacity-40"
                  }`}
                >
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} />
                  <div className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-white ${photo.keep ? "bg-purple-500" : "bg-black/30"}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                </button>
              ))}
              {newPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setNewPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                  className="relative aspect-square overflow-hidden rounded-lg border border-emerald-300 ring-2 ring-emerald-200"
                  title={t("tourstar.edit.click_to_remove", { defaultValue: "클릭하면 목록에서 제거됩니다." })}
                >
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} />
                  <div className="absolute top-1 right-1 rounded-full bg-emerald-500 px-1 text-[10px] text-white">{t("tourstar.edit.new", { defaultValue: "신규" })}</div>
                </button>
              ))}
            </div>
            {(existingPhotos.length > 0 || newPhotos.length > 0) && (
              <p className="mt-1 text-[10px] text-gray-400">{t("tourstar.edit.photo_help", { defaultValue: "기존 사진은 클릭해서 유지/제거 선택, 신규 사진은 클릭하면 제거됩니다." })}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tourstar.edit.tags_label", { defaultValue: "태그 (쉼표 또는 공백으로 구분)" })}</label>
            <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t("tourstar.edit.tags_placeholder", { defaultValue: "예: 겨울산책, 힐링, 여행기록" })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button type="button" onClick={handleDelete} disabled={saving || deleting}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
            {deleting ? t("tourstar.edit.deleting", { defaultValue: "삭제중..." }) : t("tourstar.edit.delete_post", { defaultValue: "게시글 삭제" })}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">{t("common.cancel", { defaultValue: "취소" })}</button>
            <button type="button" onClick={handleSave} disabled={saving || deleting || !title.trim()}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? t("tourstar.edit.saving", { defaultValue: "저장중..." }) : t("common.save", { defaultValue: "저장" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── 게시물 상세 모달 ───────────────────── */
interface DetailModalProps {
  post: TourPost | null;
  onClose: () => void;
  onToggleLike: (id: string) => void;
  onAddComment: (postId: string, content: string) => Promise<void> | void;
  onShare: (postId: string) => Promise<void> | void;
  onEdit: (post: TourPost) => void;
  onBookmark: (id: string) => void;
  onDeletePost: (postId: string) => Promise<boolean>;
  onOpenAuthorFeed?: (userId: number | null, authorName: string) => void;
  currentUserId?: number | null;
  ownerProfileImage?: string | null;
  ownerNickname?: string;
  authorProfileMap?: Map<string, string>;
}

function PostDetailModal({ post, onClose, onToggleLike, onAddComment, onShare, onEdit, onBookmark, onDeletePost, onOpenAuthorFeed, currentUserId, ownerProfileImage, ownerNickname, authorProfileMap }: DetailModalProps) {
  const { t } = useTranslation();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [scheduleExpanded, setScheduleExpanded] = useState(false);

  React.useEffect(() => { setPhotoIndex(0); setCommentInput(""); setScheduleExpanded(false); }, [post]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex w-1/2 items-center justify-center bg-gray-900">
          <div className={`h-full w-full ${post.photos[photoIndex]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[photoIndex]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
            style={post.photos[photoIndex]?.imageUrl ? { backgroundImage: `url(${post.photos[photoIndex].imageUrl})` } : undefined}>
            <div className="flex h-full items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
          </div>
          {post.photos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoIndex((prev) => (prev > 0 ? prev - 1 : post.photos.length - 1)); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoIndex((prev) => (prev < post.photos.length - 1 ? prev + 1 : 0)); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {post.photos.map((_, i) => (
                  <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white overflow-hidden">
                {(post.isOwner ? (ownerProfileImage || post.authorProfileImageUrl) : post.authorProfileImageUrl)
                  ? <img src={(post.isOwner ? (ownerProfileImage || post.authorProfileImageUrl) : post.authorProfileImageUrl)!} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : post.author.slice(0, 1).toUpperCase()
                }
              </div>
              <div>
                {onOpenAuthorFeed ? (
                  <button
                    type="button"
                    onClick={() => {
                      const uid = post.userId ?? (post.isOwner ? currentUserId ?? null : null);
                      onOpenAuthorFeed(uid, post.author);
                      onClose();
                    }}
                    className="text-left text-sm font-semibold text-gray-800 hover:underline"
                  >
                    {post.author}
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">{post.author}</p>
                )}
                <p className="text-[11px] text-gray-500">{post.location}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {post.isOwner ? (
                <>
                  <button type="button" onClick={() => onEdit(post)}
                    className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    {t("common.edit", { defaultValue: "수정" })}
                  </button>
                  {postHasAttachedSchedule(post) ? (
                    <button type="button" onClick={() => setScheduleExpanded((v) => !v)}
                      className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {scheduleExpanded
                        ? t("tourstar.schedule.collapse", { defaultValue: "일정 접기" })
                        : t("tourstar.schedule.view", { defaultValue: "일정 보기" })}
                    </button>
                  ) : null}
                  <button type="button" onClick={async () => {
                    const ok = await onDeletePost(post.id);
                    if (ok) onClose();
                  }}
                    className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    {t("common.delete", { defaultValue: "삭제" })}
                  </button>
                </>
              ) : null}
              {!post.isOwner && postHasAttachedSchedule(post) ? (
                <button type="button" onClick={() => setScheduleExpanded((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {scheduleExpanded
                    ? t("tourstar.schedule.collapse", { defaultValue: "일정 접기" })
                    : t("tourstar.schedule.view", { defaultValue: "일정 보기" })}
                </button>
              ) : null}
              {!post.isOwner ? (
                <button type="button" onClick={() => onBookmark(post.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${post.bookmarked ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100" : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                  <BookmarkIcon filled={post.bookmarked} />
                  {post.bookmarked ? t("tourstar.bookmarked", { defaultValue: "스크랩됨" }) : t("tourstar.bookmark", { defaultValue: "스크랩" })}
                </button>
              ) : null}
              <button type="button" onClick={onClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <h2 className="text-base font-bold text-gray-800">{post.title}</h2>
            <p className="text-sm leading-relaxed text-gray-700">{stripHashtags(post.comment)}</p>
            {postHasAttachedSchedule(post) && scheduleExpanded && post.attachedSchedule ? (
              <div className="pt-1">
                <TourstarAttachedSchedulePreview data={post.attachedSchedule} />
              </div>
            ) : null}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (<span key={tag} className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600">#{tag}</span>))}
              </div>
            )}
            <p className="text-xs text-gray-400">{post.date}</p>
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-semibold text-gray-700">{t("tourstar.comments_count", { count: post.comments.length, defaultValue: "댓글 {{count}}개" })}</p>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {post.comments.length > 0 ? post.comments.map((item) => {
                  // 댓글 작성자 프로필 이미지: authorProfileMap에서 조회 (모든 사용자 커버)
                  const commentAvatarUrl = item.authorProfileImageUrl ?? (authorProfileMap?.get(item.author) ?? null);
                  return (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-[10px] font-bold text-white overflow-hidden">
                        {commentAvatarUrl
                          ? <img src={commentAvatarUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : <span>{(item.author || "?").slice(0, 1).toUpperCase()}</span>
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span className="font-semibold text-gray-700">{item.author}</span><span>·</span><span>{item.createdAt}</span>
                        </div>
                        <p className="text-xs text-gray-700">{item.content}</p>
                      </div>
                    </div>
                  );
                }) : <p className="text-xs text-gray-400">{t("tourstar.first_comment", { defaultValue: "첫 댓글을 남겨보세요." })}</p>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { const v = commentInput.trim(); if (!v) return; onAddComment(post.id, v); setCommentInput(""); } }}
                  placeholder={t("tourstar.comment_placeholder", { defaultValue: "댓글을 입력하세요" })} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
                <button type="button" onClick={() => { const v = commentInput.trim(); if (!v) return; onAddComment(post.id, v); setCommentInput(""); }}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 transition-colors">{t("common.submit", { defaultValue: "등록" })}</button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-5 py-3">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onToggleLike(post.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"}`}>
                <HeartIcon filled={post.liked} /><span>{post.likes}</span>
              </button>
              <span className="text-xs text-gray-400">{t("tourstar.comments_count", { count: post.comments.length, defaultValue: "댓글 {{count}}개" })}</span>
              <span className="text-xs text-gray-300">{t("tourstar.photos_count", { count: post.photos.length, defaultValue: "사진 {{count}}장" })}</span>
              <button type="button" onClick={() => onShare(post.id)}
                className="ml-auto rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100">{t("tourstar.copy_share_link", { defaultValue: "공유 링크 복사" })}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── 작성자 닉네임 (클릭 시 해당 작성자 피드로) ───────────────────── */
function AuthorNameButton({
  post,
  currentUserId,
  onViewAuthorPosts,
}: {
  post: TourPost;
  currentUserId: number | null;
  onViewAuthorPosts: (userId: number | null, authorName: string) => void;
}) {
  const { t } = useTranslation();
  const uid = post.userId ?? (post.isOwner ? currentUserId : null);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onViewAuthorPosts(uid, post.author);
      }}
      className="flex min-w-0 max-w-full items-center gap-1 text-left hover:underline focus:outline-none"
    >
      <span className="truncate text-sm font-semibold text-gray-800">{post.author}</span>
      {post.isFriend && (
        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
          {t("tourstar.friend_badge", { defaultValue: "친구" })}
        </span>
      )}
    </button>
  );
}

/* ───────────────────── 게시물 카드 (피드 뷰) ───────────────────── */
function FeedCard({ post, onClick, onToggleLike, onShare, onBookmark, onEdit, onDeletePost, currentUserId, onViewAuthorPosts, ownerProfileImage }: {
  post: TourPost;
  onClick: () => void;
  onToggleLike: (id: string) => void;
  onShare: (id: string) => void;
  onBookmark: (id: string) => void;
  onEdit: (post: TourPost) => void;
  onDeletePost: (postId: string) => Promise<boolean>;
  currentUserId: number | null;
  onViewAuthorPosts: (userId: number | null, authorName: string) => void;
  ownerProfileImage: string | null;
}) {
  const { t } = useTranslation();
  // 표시할 아바타: 내 게시물이면 ownerProfileImage(최신 업로드 우선), 아니면 post.authorProfileImageUrl
  const avatarUrl = post.isOwner
    ? (ownerProfileImage || post.authorProfileImageUrl || null)
    : (post.authorProfileImageUrl || null);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
      {/* 작성자 헤더 */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white overflow-hidden">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <span>{post.author.slice(0, 1).toUpperCase()}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <AuthorNameButton post={post} currentUserId={currentUserId} onViewAuthorPosts={onViewAuthorPosts} />
          {post.location && (
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span className="truncate">{post.location}</span>
            </div>
          )}
        </div>
        {post.isOwner ? (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(post); }}
              className="rounded-full p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
              title={t("common.edit", { defaultValue: "수정" })}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button type="button" onClick={(e) => {
              e.stopPropagation();
              void onDeletePost(post.id);
            }}
              className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title={t("common.delete", { defaultValue: "삭제" })}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </div>
        ) : (
          <button type="button" onClick={(e) => { e.stopPropagation(); onBookmark(post.id); }}
            className={`rounded-full p-1.5 transition-colors ${post.bookmarked ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-amber-400"}`}
            title={post.bookmarked ? t("tourstar.cancel_bookmark", { defaultValue: "스크랩 취소" }) : t("tourstar.bookmark", { defaultValue: "스크랩" })}>
            <BookmarkIcon filled={post.bookmarked} />
          </button>
        )}
      </div>

      {/* 사진 */}
      <button type="button" onClick={onClick} className="relative w-full">
        <div className={`aspect-[4/3] w-full ${post.photos[0]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[0]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
          style={post.photos[0]?.imageUrl ? { backgroundImage: `url(${post.photos[0].imageUrl})` } : undefined}>
          <div className="flex h-full items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          </div>
        </div>
        {post.photos.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
            {post.photos.length}
          </div>
        )}
      </button>

      {/* 액션 바 */}
      <div className="flex items-center gap-1 px-3 pt-2.5">
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleLike(post.id); }}
          className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors ${post.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"}`}>
          <HeartIcon filled={post.liked} /><span className="text-[12px]">{post.likes}</span>
        </button>
        <button type="button" onClick={onClick}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span className="text-[12px]">{post.comments.length}</span>
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onShare(post.id); }}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
          <span className="text-[11px]">{t("common.share", { defaultValue: "공유" })}</span>
        </button>
      </div>

      {/* 본문 + 태그 */}
      <div className="px-3 pb-3 pt-1.5 space-y-1.5">
        <h3 className="truncate text-xs font-semibold text-gray-800">{post.title}</h3>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-700">{stripHashtags(post.comment)}</p>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">#{tag}</span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-400">{post.date}</p>
      </div>
    </div>
  );
}

/* ───────────────────── 그리드 카드 ───────────────────── */
function GridCard({ post, onClick }: { post: TourPost; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className="group relative aspect-square overflow-hidden rounded-xl">
      <div className={`h-full w-full ${post.photos[0]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[0]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
        style={post.photos[0]?.imageUrl ? { backgroundImage: `url(${post.photos[0].imageUrl})` } : undefined}>
        <div className="flex h-full items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1 text-sm font-medium text-white"><HeartIcon filled={true} />{post.likes}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
            {post.photos.length}
          </span>
        </div>
      </div>
      {post.isOwner && (
        <div className="absolute top-2 left-2 rounded-full bg-purple-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{t("tourstar.my_post", { defaultValue: "내 글" })}</div>
      )}
      {post.bookmarked && !post.isOwner && (
        <div className="absolute top-2 left-2 rounded-full bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{t("tourstar.bookmark", { defaultValue: "스크랩" })}</div>
      )}
      {post.photos.length > 1 && (
        <div className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">+{post.photos.length}</div>
      )}
    </button>
  );
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
function computeIsFriend(
  uid: number | null,
  author: string,
  isOwner: boolean,
  friendUserIds: Set<number>,
  friendNicknames: Set<string>,
): boolean {
  if (isOwner) return false;
  if (uid != null && friendUserIds.has(uid)) return true;
  // userId가 없는 레거시 게시물은 닉네임으로 판단
  if (author && author !== PLACEHOLDER_AUTHOR_KO && friendNicknames.has(author.trim())) return true;
  return false;
}

function mapRecordToPost(
  record: TourstarPostRecord,
  fallbackAuthor = PLACEHOLDER_AUTHOR_KO,
  currentUserId?: number | null,
  bookmarkedIds: Set<string> = new Set(),
  friendUserIds: Set<number> = new Set(),
  friendNicknames: Set<string> = new Set(),
  locationUnknown = "위치 미확인",
  timeLabels?: RelativeTimeLabels,
): TourPost {
  const author = record.author_nickname?.trim() || fallbackAuthor;
  const uid = record.user_id != null ? Number(record.user_id) : null;
  const isOwner = computeIsOwner(uid, currentUserId, author, fallbackAuthor);
  const bookmarked = bookmarkedIds.has(record.id);
  const isFriend = computeIsFriend(uid, author, isOwner, friendUserIds, friendNicknames);
  const photos: TourPhoto[] = (record.photo_urls || []).map((url, idx) => ({
    id: `photo-${record.id}-${idx}`,
    gradient: randomGradient(),
    selected: true,
    imageUrl: buildTourstarImageUrl(url),
    sourceImagePath: url,
    fileName: url.split("/").pop() || `photo-${idx + 1}`,
  }));
  return {
    id: record.id,
    userId: uid,
    author,
    authorProfileImageUrl: record.author_profile_image_url ?? null,
    title: record.title,
    location: record.location || locationUnknown,
    date: (record.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    comment: record.comment,
    visibility: record.visibility,
    photos,
    likes: Number(record.likes ?? 0),
    liked: Boolean(record.liked ?? false),
    tags: record.tags || [],
    comments: (record.comments || []).map((item) => ({
      id: item.id,
      author: item.author,
      content: item.content,
      createdAt: formatRelativeTime(item.created_at, timeLabels),
      authorProfileImageUrl: item.author_profile_image_url ?? null,
    })),
    isOwner,
    bookmarked,
    isFriend,
    attachedSchedule: parseAttachedScheduleRaw(record.attached_schedule ?? record.attachedSchedule),
  };
}

export default function TourstarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, logout } = useLoginStore();
  const { t } = useTranslation();
  const relativeTimeLabels = useMemo<RelativeTimeLabels>(() => ({
    now: t("tourstar.time.now", { defaultValue: "방금 전" }),
    minutesAgo: t("tourstar.time.minutes_ago", { defaultValue: "{{count}}분 전" }),
    hoursAgo: t("tourstar.time.hours_ago", { defaultValue: "{{count}}시간 전" }),
    daysAgo: t("tourstar.time.days_ago", { defaultValue: "{{count}}일 전" }),
  }), [t]);
  const locationUnknown = t("tourstar.placeholder.location_unknown", { defaultValue: "위치 미확인" });
  const anonymousAuthor = t("tourstar.placeholder.anonymous", { defaultValue: "익명" });

  const [authorName, setAuthorName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tourstar_author_name") || PLACEHOLDER_AUTHOR_KO;
    }
    return PLACEHOLDER_AUTHOR_KO;
  });
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [friendUserIds, setFriendUserIds] = useState<Set<number>>(new Set());
  const [friendList, setFriendList] = useState<UserModel[]>([]);
  const [viewAuthorId, setViewAuthorId] = useState<number | null>(null);
  const [viewAuthorName, setViewAuthorName] = useState<string>("");
  const [viewAuthorProfileImageUrl, setViewAuthorProfileImageUrl] = useState<string | null>(null);
  const [authorFeedFriendRequestSending, setAuthorFeedFriendRequestSending] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("tourstar_profile_image");
    return null;
  });
  const profileInputRef = React.useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<TourPost[]>([]);
  // 전체 피드는 리스트(인스타 피드 느낌), 특정 작성자 피드는 그리드
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<TourPost | null>(null);
  const [editTargetPost, setEditTargetPost] = useState<TourPost | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");

  /* userId 추출 — sessionStorage에 로그인 시 저장된 app_user_id를 읽습니다 */
  React.useEffect(() => {
    if (!isAuthenticated) { setCurrentUserId(null); return; }
    const id = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;
    setCurrentUserId(id);
  }, [isAuthenticated]);

  /* 북마크 로드 */
  React.useEffect(() => {
    if (!currentUserId) return;
    const key = `tourstar_bookmarks_${currentUserId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setBookmarkedIds(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, [currentUserId]);

  /* 친구 목록 로드 함수 */
  const loadFriendList = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await listFriends();
      if (res.code !== 200) {
        console.warn("[tourstar] Friend list response error:", res.code, res.message);
        return;
      }
      const users: UserModel[] = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      const nextFriendUserIds = new Set(users.map((u) => u.id).filter((id): id is number => id != null));
      const nextFriendNicknames = new Set(
        users.map((u) => (u.nickname || u.name || "").trim()).filter(Boolean),
      );
      setFriendList(users);
      setFriendUserIds(nextFriendUserIds);

      // 친구 목록이 로드되면 즉시 posts/detail의 isFriend를 재계산한다.
      // (일부 브라우저/상황에서 effect 타이밍이 밀려 배지가 늦게 뜨는 문제 방지)
      setPosts((prev) => prev.map((p) => {
        const isOwner = computeIsOwner(p.userId ?? null, currentUserId, p.author, authorName);
        return {
          ...p,
          isFriend: computeIsFriend(p.userId ?? null, p.author, isOwner, nextFriendUserIds, nextFriendNicknames),
        };
      }));
      setDetailPost((prev) => {
        if (!prev) return null;
        const isOwner = computeIsOwner(prev.userId ?? null, currentUserId, prev.author, authorName);
        return {
          ...prev,
          isFriend: computeIsFriend(prev.userId ?? null, prev.author, isOwner, nextFriendUserIds, nextFriendNicknames),
        };
      });
    } catch (err) {
      console.error("[tourstar] Failed to fetch friend list:", err);
    }
  }, [isAuthenticated, currentUserId, authorName]);

  /* 친구 목록 로드 — 초기 로드 + 탭 포커스 시 갱신 */
  React.useEffect(() => {
    loadFriendList();
  }, [loadFriendList]);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadFriendList();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadFriendList]);

  /* 친구 닉네임 Set (userId 없는 레거시 게시물 isFriend 판단용) */
  const friendNicknames = useMemo(
    () => new Set(friendList.map((u) => (u.nickname || u.name || "").trim()).filter(Boolean)),
    [friendList],
  );

  const hasAuthorFeedOpen = Boolean(viewAuthorName.trim());
  const isSelfAuthorFeed = useMemo(() => {
    if (!viewAuthorName.trim()) return false;
    if (viewAuthorId != null && currentUserId != null) return viewAuthorId === currentUserId;
    const safe = authorName.trim();
    return safe !== PLACEHOLDER_AUTHOR_KO && viewAuthorName.trim() === safe;
  }, [viewAuthorName, viewAuthorId, currentUserId, authorName]);

  /** 현재 보고 있는 작성자 피드 주인이 내 친구인지 */
  const isViewingFriend = useMemo(() => {
    if (!viewAuthorName.trim() || isSelfAuthorFeed) return false;
    const name = viewAuthorName.trim();
    if (viewAuthorId != null && friendUserIds.has(viewAuthorId)) return true;
    if (friendNicknames.has(name)) return true;
    return false;
  }, [viewAuthorName, viewAuthorId, isSelfAuthorFeed, friendUserIds, friendNicknames]);

  const handleSendFriendRequestFromAuthorFeed = React.useCallback(async () => {
    if (!currentUserId || !viewAuthorName.trim() || isSelfAuthorFeed || isViewingFriend) return;
    setAuthorFeedFriendRequestSending(true);
    try {
      let targetUserId = viewAuthorId;
      if (!targetUserId) {
        const found = await findUserByNickname(viewAuthorName.trim());
        if (!found?.id) {
          window.alert(t("tourstar.error.author_not_found", { name: viewAuthorName, defaultValue: "{{name}}님의 계정을 찾을 수 없습니다." }));
          return;
        }
        targetUserId = found.id;
      }
      if (targetUserId === currentUserId) return;
      const res = await sendFriendRequest(targetUserId);
      if (res.code === 200) {
        window.alert(t("tourstar.friend_request_sent", { name: viewAuthorName, defaultValue: "{{name}}님에게 친구 요청을 보냈습니다." }));
        await loadFriendList();
      } else {
        window.alert(res.message || t("tourstar.error.friend_request_failed", { defaultValue: "친구 요청 전송에 실패했습니다." }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(t("tourstar.error.friend_request_failed_with_detail", { detail: msg, defaultValue: "친구 요청 전송에 실패했습니다.\n{{detail}}" }));
    } finally {
      setAuthorFeedFriendRequestSending(false);
    }
  }, [currentUserId, viewAuthorName, viewAuthorId, isSelfAuthorFeed, isViewingFriend, loadFriendList, t]);

  /* 친구 작성자 피드: 프로필 이미지 로드 (본인 피드는 기존 profileImageUrl 사용) */
  React.useEffect(() => {
    if (!hasAuthorFeedOpen || isSelfAuthorFeed) {
      setViewAuthorProfileImageUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (viewAuthorId != null) {
          const url = await fetchProfileImage(viewAuthorId);
          if (!cancelled) setViewAuthorProfileImageUrl(url || null);
          return;
        }
        const fallback = posts.find((p) => p.author === viewAuthorName && p.authorProfileImageUrl)?.authorProfileImageUrl || null;
        if (!cancelled) setViewAuthorProfileImageUrl(fallback);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [hasAuthorFeedOpen, isSelfAuthorFeed, viewAuthorId, viewAuthorName, posts]);

  /* 비동기 게시글 로드 완료 시점의 최신 친구/북마크/닉네임 매핑용 (늦은 응답이 빈 Set 클로저로 덮어쓰는 버그 방지) */
  const tourstarMapContextRef = useRef({
    currentUserId: null as number | null,
    authorName: PLACEHOLDER_AUTHOR_KO,
    bookmarkedIds: new Set<string>(),
    friendUserIds: new Set<number>(),
    friendNicknames: new Set<string>(),
    locationUnknown: "위치 미확인",
    relativeTimeLabels: undefined as RelativeTimeLabels | undefined,
  });
  tourstarMapContextRef.current = {
    currentUserId,
    authorName,
    bookmarkedIds,
    friendUserIds,
    friendNicknames,
    locationUnknown,
    relativeTimeLabels,
  };

  /* 닉네임 조회 */
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // 1순위: sessionStorage에 로그인 시 저장된 nickname
    const sessionNickname = sessionStorage.getItem("nickname");
    if (sessionNickname) {
      setAuthorName(sessionNickname);
      localStorage.setItem("tourstar_author_name", sessionNickname);
      sessionStorage.setItem("_tourstar_author", sessionNickname);
    }

    // 2순위: sessionStorage 캐시 (profile/settings 페이지에서 갱신됨)
    const cached = sessionStorage.getItem("_tourstar_author");
    if (cached && !sessionNickname) {
      setAuthorName(cached);
      localStorage.setItem("tourstar_author_name", cached);
    }

    // 3순위: profile API 호출 (가장 정확)
    const userId = typeof window !== "undefined" ? Number(sessionStorage.getItem("app_user_id")) || null : null;
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await findUserById(userId);
        if (!cancelled && res.data) {
          const name = (res.data.nickname || res.data.name || "").trim();
          if (name) {
            setAuthorName(name);
            sessionStorage.setItem("_tourstar_author", name);
            localStorage.setItem("tourstar_author_name", name);
          }
        }
      } catch (err) {
        console.error("[tourstar] Failed to fetch nickname:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  React.useEffect(() => { if (!isAuthenticated) { router.replace("/"); } }, [isAuthenticated, router]);

  /* 게시글 목록 로드 — 응답이 늦게 올 때 친구 목록이 이미 로드된 뒤여도 stale 클로저로 배지가 지워지지 않도록 ref로 최신 값 매핑 */
  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const viewerId = currentUserId;
    (async () => {
      try {
        const rows = await listTourstarPosts(viewerId);
        if (!cancelled) {
          const ctx = tourstarMapContextRef.current;
          setPosts(rows.map((r) =>
            mapRecordToPost(r, ctx.authorName, ctx.currentUserId, ctx.bookmarkedIds, ctx.friendUserIds, ctx.friendNicknames, ctx.locationUnknown, ctx.relativeTimeLabels),
          ));
        }
      } catch (error) { console.error("[tourstar] Failed to fetch post list:", error); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentUserId]);

  /* authorName 갱신 시 기존 포스트 반영 */
  React.useEffect(() => {
    if (authorName === PLACEHOLDER_AUTHOR_KO) return;
    setPosts((prev) => prev.map((p) => (p.author === PLACEHOLDER_AUTHOR_KO ? { ...p, author: authorName } : p)));
    setDetailPost((prev) => (prev && prev.author === PLACEHOLDER_AUTHOR_KO ? { ...prev, author: authorName } : prev));
  }, [authorName]);

  /* currentUserId / bookmarkedIds / friendUserIds / friendNicknames / 닉네임 변경 시 재계산 */
  React.useEffect(() => {
    setPosts((prev) => prev.map((p) => {
      const isOwner = computeIsOwner(p.userId, currentUserId, p.author, authorName);
      return {
        ...p,
        isOwner,
        bookmarked: bookmarkedIds.has(p.id),
        isFriend: computeIsFriend(p.userId ?? null, p.author, isOwner, friendUserIds, friendNicknames),
      };
    }));
    setDetailPost((prev) => {
      if (!prev) return null;
      const isOwner = computeIsOwner(prev.userId, currentUserId, prev.author, authorName);
      return {
        ...prev,
        isOwner,
        bookmarked: bookmarkedIds.has(prev.id),
        isFriend: computeIsFriend(prev.userId ?? null, prev.author, isOwner, friendUserIds, friendNicknames),
      };
    });
  }, [currentUserId, bookmarkedIds, authorName, friendUserIds, friendNicknames]);

  /* currentUserId 확보 시 → DB에서 최신 presigned 프로필 이미지 URL 조회 */
  React.useEffect(() => {
    if (!currentUserId) return;
    fetchProfileImage(currentUserId).then((url) => {
      if (url) {
        setProfileImageUrl(url);
        localStorage.setItem("tourstar_profile_image", url);
      }
    });
  }, [currentUserId]);

  /* posts 로드 후 authorProfileImageUrl로 보완 (fetchProfileImage 실패 시 fallback) */
  React.useEffect(() => {
    if (posts.length === 0 || profileImageUrl) return;
    const myPost = posts.find((p) => p.isOwner && p.authorProfileImageUrl);
    if (myPost?.authorProfileImageUrl) {
      setProfileImageUrl(myPost.authorProfileImageUrl);
    }
  }, [posts, profileImageUrl]);

  /* URL postId 파라미터 처리 */
  React.useEffect(() => {
    const requestedPostId = searchParams.get("postId");
    if (!requestedPostId || posts.length === 0) return;
    const target = posts.find((item) => item.id === requestedPostId);
    if (!target) return;
    setDetailPost(target);
  }, [posts, searchParams]);

  /* ── 필터 + 검색 + 정렬 ── */
  const filteredPosts = useMemo(() => {
    let result = posts;

    if (viewAuthorName.trim()) {
      result = result.filter((p) =>
        (viewAuthorId != null && p.userId === viewAuthorId) ||
        p.author === viewAuthorName,
      );
    } else if (filter === "mine") result = result.filter((p) => p.isOwner);
    else if (filter === "bookmarked") result = result.filter((p) => p.bookmarked);
    else if (filter === "friends") result = result.filter((p) => p.isFriend);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        const body = stripHashtags(p.comment).toLowerCase();
        switch (searchField) {
          case "author": return p.author.toLowerCase().includes(q);
          case "title": return p.title.toLowerCase().includes(q);
          case "content": return body.includes(q);
          case "tags": return p.tags.some((t) => t.toLowerCase().includes(q));
          case "location": return p.location.toLowerCase().includes(q);
          default:
            return p.author.toLowerCase().includes(q) ||
              p.title.toLowerCase().includes(q) ||
              body.includes(q) ||
              p.tags.some((t) => t.toLowerCase().includes(q)) ||
              p.location.toLowerCase().includes(q);
        }
      });
    }

    switch (sortType) {
      case "likes": return [...result].sort((a, b) => b.likes - a.likes);
      case "comments": return [...result].sort((a, b) => b.comments.length - a.comments.length);
      default: return result;
    }
  }, [posts, filter, searchQuery, searchField, sortType, viewAuthorId, viewAuthorName]);

  const stats = useMemo(() => ({
    total: posts.length,
    mine: posts.filter((p) => p.isOwner).length,
    bookmarked: posts.filter((p) => p.bookmarked).length,
    friends: posts.filter((p) => p.isFriend).length,
    totalPhotos: posts.reduce((acc, p) => acc + p.photos.length, 0),
    // 내 게시물이 받은 좋아요 합계
    myLikes: posts.filter((p) => p.isOwner).reduce((acc, p) => acc + p.likes, 0),
  }), [posts]);

  const authorFeedProfileStats = useMemo(() => {
    if (!viewAuthorName.trim()) return null;
    const authorPosts = posts.filter((p) =>
      (viewAuthorId != null && p.userId === viewAuthorId) || p.author === viewAuthorName,
    );
    const postCount = authorPosts.length;
    const selfScraps = posts.filter((p) => p.bookmarked).length;
    const scrapsInAuthorPosts = authorPosts.filter((p) => p.bookmarked).length;
    return {
      postCount,
      scrapCount: isSelfAuthorFeed ? selfScraps : scrapsInAuthorPosts,
      friendCount: friendList.length,
    };
  }, [viewAuthorName, viewAuthorId, posts, isSelfAuthorFeed, friendList.length]);

  // 닉네임 → 프로필 이미지 URL 맵 (댓글 아바타 표시용)
  const authorProfileMap = useMemo(() => {
    const map = new Map<string, string>();
    // 게시물 작성자 이미지 수집
    for (const p of posts) {
      if (p.author && p.authorProfileImageUrl) {
        map.set(p.author, p.authorProfileImageUrl);
      }
    }
    // 현재 로그인 사용자 이미지 (최신값으로 덮어쓰기)
    if (authorName && profileImageUrl) {
      map.set(authorName, profileImageUrl);
    }
    return map;
  }, [posts, authorName, profileImageUrl]);

  /* ── 핸들러 ── */
  const toggleLike = async (id: string) => {
    if (!currentUserId) {
      window.alert(t("common.login_needed", { defaultValue: "로그인이 필요합니다." }));
      return;
    }
    try {
      const res = await toggleTourstarLike(id, currentUserId);
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked: res.liked, likes: res.likes } : p));
      setDetailPost((prev) => prev && prev.id === id ? { ...prev, liked: res.liked, likes: res.likes } : prev);
    } catch (error) {
      console.error(error);
      window.alert(t("tourstar.error.like_failed", { defaultValue: "좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요." }));
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (currentUserId) {
        const key = `tourstar_bookmarks_${currentUserId}`;
        localStorage.setItem(key, JSON.stringify([...next]));
      }
      return next;
    });
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, bookmarked: !p.bookmarked } : p));
    setDetailPost((prev) => prev && prev.id === id ? { ...prev, bookmarked: !prev.bookmarked } : prev);
  };

  const createPost = async (newPost: Omit<TourPost, "id" | "author" | "likes" | "liked" | "comments" | "isOwner" | "bookmarked" | "userId" | "isFriend">) => {
    const sourceImagePaths = newPost.photos.map((photo) => photo.sourceImagePath).filter((path): path is string => Boolean(path && path.trim()));
    const saved = await createTourstarPost({
      user_id: currentUserId ?? undefined,
      title: newPost.title,
      location: newPost.location,
      comment: newPost.comment,
      visibility: newPost.visibility,
      tags: newPost.tags,
      image_paths: sourceImagePaths,
      author_nickname: authorName,
      attached_schedule: newPost.attachedSchedule ?? null,
    });
    setPosts((prev) => [mapRecordToPost(saved, authorName, currentUserId, bookmarkedIds, friendUserIds, friendNicknames, locationUnknown, relativeTimeLabels), ...prev]);
  };

  const deletePost = async (postId: string): Promise<boolean> => {
    if (!currentUserId) {
      window.alert(t("tourstar.error.cannot_delete_no_login", { defaultValue: "로그인 정보를 확인할 수 없어 삭제할 수 없습니다." }));
      return false;
    }
    if (!window.confirm(t("tourstar.confirm.delete_post", { defaultValue: "이 게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다." }))) {
      return false;
    }
    try {
      await deleteTourstarPost(postId, currentUserId);
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        localStorage.setItem(`tourstar_bookmarks_${currentUserId}`, JSON.stringify([...next]));
        return next;
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setDetailPost((prev) => (prev?.id === postId ? null : prev));
      setEditTargetPost((prev) => (prev?.id === postId ? null : prev));
      return true;
    } catch (error) {
      console.error(error);
      window.alert(t("tourstar.error.delete_failed", { defaultValue: "삭제에 실패했습니다. 본인 게시글인지 확인하거나 잠시 후 다시 시도해주세요." }));
      return false;
    }
  };

  const updatePostData = async (postId: string, updates: {
    title: string;
    location: string;
    comment: string;
    tags: string[];
    keepPhotoUrls: string[];
    photosChanged: boolean;
  }) => {
    const saved = await updateTourstarPost(postId, {
      title: updates.title,
      location: updates.location,
      comment: updates.comment,
      tags: updates.tags,
      // 사진이 변경된 경우에만 keep_photo_urls 전달 (image_paths 는 전달 안 함 — 미리 S3에 업로드됨)
      ...(updates.photosChanged ? { keep_photo_urls: updates.keepPhotoUrls } : {}),
    });
    const updated = mapRecordToPost(saved, authorName, currentUserId, bookmarkedIds, friendUserIds, friendNicknames, locationUnknown, relativeTimeLabels);
    setPosts((prev) => prev.map((p) => p.id === postId ? updated : p));
    setDetailPost((prev) => prev && prev.id === postId ? updated : prev);
  };

  const addComment = async (postId: string, content: string) => {
    // authorName 우선, 플레이스홀더·빈 값이면 JWT·세션에서 재추출
    const placeholder = PLACEHOLDER_AUTHOR_KO;
    let resolvedAuthor = authorName && authorName !== placeholder ? authorName : "";
    if (!resolvedAuthor) {
      resolvedAuthor = sessionStorage.getItem("nickname") || "";
    }
    if (!resolvedAuthor) {
      resolvedAuthor = sessionStorage.getItem("_tourstar_author") || localStorage.getItem("tourstar_author_name") || anonymousAuthor;
      if (resolvedAuthor === placeholder) resolvedAuthor = anonymousAuthor;
    }
    const saved = await createTourstarComment(postId, { user_id: currentUserId ?? undefined, author: resolvedAuthor, content });
    const newComment: TourPostComment = {
      id: saved.id,
      author: saved.author,
      content: saved.content,
      createdAt: formatRelativeTime(saved.created_at, relativeTimeLabels),
      authorProfileImageUrl: saved.author_profile_image_url ?? null,
    };
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    setDetailPost((prev) => prev && prev.id === postId ? { ...prev, comments: [...prev.comments, newComment] } : prev);
  };

  const sharePost = async (postId: string) => {
    const shareUrl = buildTourstarShareUrl(postId);
    try { await navigator.clipboard.writeText(shareUrl); window.alert(t("tourstar.share.copied", { defaultValue: "공유 링크를 복사했어요. 채팅창에 붙여넣어 주세요." })); }
    catch (_) { window.prompt(t("tourstar.share.copy_prompt", { defaultValue: "아래 링크를 복사해 채팅에 공유하세요." }), shareUrl); }
  };

  const leaveAuthorFeed = () => {
    setViewAuthorId(null);
    setViewAuthorName("");
    setViewAuthorProfileImageUrl(null);
    setFilter("all");
    setViewMode("feed");
    setSearchQuery("");
    setSearchField("all");
    setSortType("latest");
  };

  const handleViewAuthorPosts = (userId: number | null, name: string) => {
    setViewAuthorId(userId);
    setViewAuthorName(name);
    setFilter("all");
    setViewMode("grid");
    setSearchQuery("");
    setSearchField("all");
    setSortType("latest");
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{t("tourstar.title", { defaultValue: "투어스타" })}</h1>
              <p className="mt-0.5 text-xs text-gray-400">{t("tourstar.subtitle", { defaultValue: "여행 사진을 AI가 자동으로 골라주고, 코멘트만 남기면 예쁘게 기록됩니다" })}</p>
              {analysisStatus ? <p className="mt-1 text-xs font-medium text-purple-600">{analysisStatus}</p> : null}
            </div>
            <button type="button" onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              {t("tourstar.new_post", { defaultValue: "새 기록" })}
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
          {/* 전체 피드에서는 프로필 카드 없음 — 닉네임으로 들어온 작성자 피드에서만 표시 */}
          {hasAuthorFeedOpen && authorFeedProfileStats && (
            <div className="flex items-center gap-6 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
              <button
                type="button"
                onClick={leaveAuthorFeed}
                className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                title={t("tourstar.back_to_feed_title", { defaultValue: "전체 피드로" })}
              >
                ← {t("common.back", { defaultValue: "뒤로가기" })}
              </button>
              {isSelfAuthorFeed ? (
                <>
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";
                      const localUrl = URL.createObjectURL(file);
                      setProfileImageUrl(localUrl);
                      try {
                        const s3Url = await uploadProfileImage(file, currentUserId);
                        setProfileImageUrl(s3Url);
                        localStorage.setItem("tourstar_profile_image", s3Url);
                        setPosts((prev) => prev.map((p) =>
                          p.isOwner ? { ...p, authorProfileImageUrl: s3Url } : p,
                        ));
                      } catch (err) {
                        console.error("[profile] S3 upload failed:", err);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    title={t("tourstar.change_profile_photo", { defaultValue: "프로필 사진 변경" })}
                    className="group relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white shadow-lg shadow-purple-200 overflow-hidden focus:outline-none"
                  >
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => {
                          setProfileImageUrl(null);
                          if (currentUserId) {
                            fetchProfileImage(currentUserId).then((url) => {
                              if (url) {
                                setProfileImageUrl(url);
                                localStorage.setItem("tourstar_profile_image", url);
                              }
                            });
                          }
                        }}
                      />
                    ) : (
                      <span>{(viewAuthorName || "?").slice(0, 1).toUpperCase()}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                      </svg>
                    </span>
                  </button>
                </>
              ) : (
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-2xl font-bold text-white shadow-lg shadow-blue-100 overflow-hidden">
                  {viewAuthorProfileImageUrl ? (
                    <img src={viewAuthorProfileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{(viewAuthorName || "?").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-800 truncate">{viewAuthorName}</h2>
                  {!isSelfAuthorFeed && isViewingFriend && (
                    <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{t("tourstar.friend_badge", { defaultValue: "친구" })}</span>
                  )}
                  {!isSelfAuthorFeed && !isViewingFriend && currentUserId != null && (
                    <button
                      type="button"
                      disabled={authorFeedFriendRequestSending}
                      onClick={() => void handleSendFriendRequestFromAuthorFeed()}
                      className="shrink-0 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                    >
                      {authorFeedFriendRequestSending
                        ? t("tourstar.requesting", { defaultValue: "요청 중..." })
                        : t("tourstar.send_friend_request", { defaultValue: "친구 요청 보내기" })}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {isSelfAuthorFeed ? t("tourstar.author.self_caption", { defaultValue: "소중한 여행의 순간들을 기록하고 공유하세요" }) : t("tourstar.author.other_caption", { defaultValue: "이 사용자가 올린 게시물" })}
                </p>
                <div className="mt-3 flex gap-10">
                  {[
                    { label: t("tourstar.stats.posts", { defaultValue: "게시물" }), value: authorFeedProfileStats.postCount, color: "text-purple-600" },
                    { label: t("tourstar.stats.scraps", { defaultValue: "스크랩" }), value: authorFeedProfileStats.scrapCount, color: "text-amber-500" },
                    { label: t("tourstar.stats.friends", { defaultValue: "친구" }), value: authorFeedProfileStats.friendCount, color: "text-blue-500" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 검색 바 */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <select value={searchField} onChange={(e) => setSearchField(e.target.value as SearchField)}
              className="border-none bg-transparent text-xs text-gray-600 focus:outline-none cursor-pointer pr-1">
              <option value="all">{t("tourstar.search.all", { defaultValue: "전체" })}</option>
              <option value="author">{t("tourstar.search.author", { defaultValue: "유저명" })}</option>
              <option value="title">{t("tourstar.search.title", { defaultValue: "제목" })}</option>
              <option value="content">{t("tourstar.search.content", { defaultValue: "본문" })}</option>
              <option value="tags">{t("tourstar.search.tags", { defaultValue: "태그" })}</option>
              <option value="location">{t("tourstar.search.location", { defaultValue: "장소" })}</option>
            </select>
            <div className="h-3.5 w-px bg-gray-200 shrink-0" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("tourstar.search.placeholder", { defaultValue: "검색어를 입력하세요..." })}
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          {/* 탭 + 정렬 + 뷰 모드 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: "all", label: t("tourstar.tabs.all", { defaultValue: "전체" }), count: null },
                { id: "mine", label: t("tourstar.tabs.mine", { defaultValue: "게시물" }), count: stats.mine },
                { id: "friends", label: t("tourstar.tabs.friends", { defaultValue: "친구 게시물" }), count: stats.friends },
                { id: "bookmarked", label: t("tourstar.tabs.bookmarked", { defaultValue: "스크랩" }), count: stats.bookmarked },
              ] as const).map((tab) => (
                <button key={tab.id} type="button" onClick={() => {
                  setFilter(tab.id);
                  setViewAuthorId(null);
                  setViewAuthorName("");
                  setViewAuthorProfileImageUrl(null);
                  setViewMode("feed");
                }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${filter === tab.id ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {tab.label}{tab.count !== null ? ` (${tab.count})` : ""}
                </button>
              ))}
              {viewAuthorName.trim() && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {viewAuthorName}
                  <button type="button" onClick={leaveAuthorFeed}
                    className="ml-0.5 rounded-full hover:bg-blue-100 p-0.5 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 정렬 버튼 */}
              <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
                {([
                  { id: "latest", label: t("tourstar.sort.latest", { defaultValue: "최신순" }) },
                  { id: "likes", label: t("tourstar.sort.likes", { defaultValue: "좋아요순" }) },
                  { id: "comments", label: t("tourstar.sort.comments", { defaultValue: "댓글순" }) },
                ] as const).map((s) => (
                  <button key={s.id} type="button" onClick={() => setSortType(s.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${sortType === s.id ? "bg-purple-100 text-purple-700" : "text-gray-400 hover:text-gray-600"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              {/* 뷰 모드 */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                {([
                  { mode: "feed", icon: <><rect x="3" y="3" width="18" height="7" rx="1" /><rect x="3" y="14" width="18" height="7" rx="1" /></> },
                  { mode: "grid", icon: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></> },
                ] as const).map((v) => (
                  <button key={v.mode} type="button" onClick={() => setViewMode(v.mode)}
                    className={`rounded-md p-1.5 transition-colors ${viewMode === v.mode ? "bg-purple-100 text-purple-600" : "text-gray-400 hover:text-gray-600"}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{v.icon}</svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 게시물 목록 */}
          {filteredPosts.length > 0 ? (
            viewMode === "feed" ? (
              <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                {filteredPosts.map((post) => (
                  <FeedCard key={post.id} post={post} onClick={() => setDetailPost(post)}
                    onToggleLike={toggleLike} onShare={sharePost}
                    onBookmark={toggleBookmark} onEdit={(p) => setEditTargetPost(p)} onDeletePost={deletePost}
                    currentUserId={currentUserId} onViewAuthorPosts={handleViewAuthorPosts}
                    ownerProfileImage={profileImageUrl} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredPosts.map((post) => (<GridCard key={post.id} post={post} onClick={() => setDetailPost(post)} />))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-gray-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              <p className="text-sm font-medium text-gray-400">
                {viewAuthorName.trim()
                  ? t("tourstar.empty.author", { name: viewAuthorName, defaultValue: "{{name}}님의 게시물이 없습니다" })
                  : filter === "mine"
                  ? t("tourstar.empty.mine", { defaultValue: "내가 올린 게시물이 없습니다" })
                  : filter === "bookmarked"
                  ? t("tourstar.empty.bookmarked", { defaultValue: "스크랩한 게시물이 없습니다" })
                  : filter === "friends"
                  ? t("tourstar.empty.friends", { defaultValue: "친구들이 올린 게시물이 없습니다" })
                  : searchQuery
                  ? t("tourstar.empty.search", { defaultValue: "검색 결과가 없습니다" })
                  : t("tourstar.empty.none", { defaultValue: "아직 기록된 여행이 없습니다" })}
              </p>
              <p className="mt-1 text-xs text-gray-300">
                {filter === "bookmarked"
                  ? t("tourstar.empty.help_bookmarked", { defaultValue: "다른 사람의 게시물에서 북마크 버튼을 눌러보세요" })
                  : filter === "friends"
                  ? t("tourstar.empty.help_friends", { defaultValue: "친구를 추가하면 친구의 여행 기록을 볼 수 있습니다" })
                  : t("tourstar.empty.help_new", { defaultValue: "상단의 \"새 기록\" 버튼으로 첫 번째 여행을 기록해보세요" })}
              </p>
              {filter === "all" && !searchQuery && (
                <button type="button" onClick={() => setCreateOpen(true)} className="mt-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">{t("tourstar.empty.cta", { defaultValue: "여행 기록하기" })}</button>
              )}
            </div>
          )}

          {/* AI 안내 배너 */}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#tourgrad)" strokeWidth="2">
                <defs><linearGradient id="tourgrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stopColor="#9333ea" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-800">{t("tourstar.ai_banner.title", { defaultValue: "AI가 알아서 베스트 사진을 골라드려요" })}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{t("tourstar.ai_banner.body", { defaultValue: "여행 사진을 올리면 잘 나온 사진만 자동으로 추천하고, 간단한 코멘트만 남기면 예쁘게 게시됩니다" })}</p>
            </div>
          </div>
        </div>
      </main>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createPost} onJobStatusChange={setAnalysisStatus} currentUserId={currentUserId} />
      <EditPostModal post={editTargetPost} onClose={() => setEditTargetPost(null)} onSave={updatePostData} onDelete={deletePost} />
      <PostDetailModal
        post={detailPost}
        onClose={() => setDetailPost(null)}
        onToggleLike={toggleLike}
        onAddComment={addComment}
        onShare={sharePost}
        onEdit={(p) => { setDetailPost(null); setEditTargetPost(p); }}
        onBookmark={toggleBookmark}
        onDeletePost={deletePost}
        onOpenAuthorFeed={handleViewAuthorPosts}
        currentUserId={currentUserId}
        ownerProfileImage={profileImageUrl}
        ownerNickname={authorName}
        authorProfileMap={authorProfileMap}
      />
    </AppLayout>
  );
}
