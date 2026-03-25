"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginStore } from "@/store";
import { getAppUserIdFromToken, getNicknameFromToken, getUserIdFromToken } from "@/lib/api/auth";
import { findUserById } from "@/lib/api/user";
import { AppLayout } from "@/components/organisms/AppLayout";
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
  updateTourstarPost,
  type TourstarPostRecord,
  type TourstarStyleFilter,
  uploadTourstarPhotos,
} from "@/lib/api/tourstar";

/* ────────────────────────── 타입 정의 ────────────────────────── */
type Visibility = "public" | "private";
type ViewMode = "grid" | "feed";
type FilterType = "all" | "mine" | "bookmarked";
type SortType = "latest" | "likes" | "comments";
type SearchField = "all" | "author" | "title" | "content" | "tags" | "location";

interface TourPhoto {
  id: string;
  gradient: string;
  selected: boolean;
  imageUrl?: string;
  fileName?: string;
  sourceImagePath?: string;
  aiRank?: number;
  aiScore?: number;
}

interface TourPostComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface TourPost {
  id: string;
  userId?: number | null;
  author: string;
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
}

function stripHashtags(text: string): string {
  return text.replace(/#[\w\uAC00-\uD7A3\uAC00-\uD7A3]+/g, "").replace(/\s{2,}/g, " ").trim();
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
    safeSession !== "내 여행기록" &&
    safePost &&
    safePost !== "내 여행기록" &&
    safePost === safeSession
  ) {
    return true;
  }
  return false;
}

const STYLE_FILTER_AUTO: { value: TourstarStyleFilter; label: string } = {
  value: "AUTO",
  label: "자동 (기본)",
};

const STYLE_FILTER_GROUPS: Array<{
  title: string;
  options: Array<{ value: TourstarStyleFilter; label: string }>;
}> = [
    {
      title: "분석/전략형 (NT)",
      options: [
        { value: "INTJ", label: "INTJ" },
        { value: "INTP", label: "INTP" },
        { value: "ENTJ", label: "ENTJ" },
        { value: "ENTP", label: "ENTP" },
      ],
    },
    {
      title: "외교/감성형 (NF)",
      options: [
        { value: "INFJ", label: "INFJ" },
        { value: "INFP", label: "INFP" },
        { value: "ENFJ", label: "ENFJ" },
        { value: "ENFP", label: "ENFP" },
      ],
    },
    {
      title: "관리/실무형 (SJ)",
      options: [
        { value: "ISTJ", label: "ISTJ" },
        { value: "ISFJ", label: "ISFJ" },
        { value: "ESTJ", label: "ESTJ" },
        { value: "ESFJ", label: "ESFJ" },
      ],
    },
    {
      title: "탐험/즉흥형 (SP)",
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

/* ───────────────────── 새 게시물 작성 모달 ───────────────────── */
interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (post: Omit<TourPost, "id" | "author" | "likes" | "liked" | "comments" | "isOwner" | "bookmarked" | "userId">) => Promise<void> | void;
  onJobStatusChange?: (status: string) => void;
}

function CreatePostModal({ open, onClose, onCreate, onJobStatusChange }: CreateModalProps) {
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
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const togglePhoto = (id: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

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
      const result = await uploadTourstarPhotos(imageFiles);
      const mapped: TourPhoto[] = result.uploaded.map((item, idx) => ({
        id: `upload-${Date.now()}-${idx}`,
        gradient: randomGradient(),
        selected: true,
        imageUrl: buildTourstarImageUrl(item.url),
        fileName: item.name,
      }));
      setPhotos((prev) => [...prev, ...mapped]);
      if (result.pipeline_job?.job_id) {
        console.log("[tourstar] pipeline queued:", result.pipeline_job.job_id);
        onJobStatusChange?.("AI 사진 분석 대기중...");
        const jobId = result.pipeline_job.job_id;
        for (let i = 0; i < 60; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // eslint-disable-next-line no-await-in-loop
          const status = await getTourstarJobStatus(jobId);
          if (status.status === "queued") { onJobStatusChange?.("AI 사진 분석 대기중..."); continue; }
          if (status.status === "running") { onJobStatusChange?.("AI 사진 분석중..."); continue; }
          if (status.status === "failed") { onJobStatusChange?.("AI 분석 실패"); break; }
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
              onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
              try {
                const topImagePaths = rankedRows.map((r) => r.source_image).filter((v) => !!v).slice(0, 3);
                if (topImagePaths.length > 0) {
                  onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성중...)");
                  const auto = await generateTourstarAutoComment(topImagePaths, 3);
                  if ((auto.comment || "").trim()) {
                    setForm((prev) => { if (prev.comment.trim().length > 0) return prev; return { ...prev, comment: auto.comment.trim() }; });
                    onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성됨)");
                  } else { onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)"); }
                }
              } catch (error) { console.error(error); onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)"); }
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
                onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
                try {
                  const topImagePaths = bestRows.map((r) => r.source_image).filter((v) => !!v).slice(0, 3);
                  if (topImagePaths.length > 0) {
                    onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성중...)");
                    const auto = await generateTourstarAutoComment(topImagePaths, 3);
                    if ((auto.comment || "").trim()) {
                      setForm((prev) => { if (prev.comment.trim().length > 0) return prev; return { ...prev, comment: auto.comment.trim() }; });
                      onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성됨)");
                    } else { onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)"); }
                  }
                } catch (error) { console.error(error); onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)"); }
              } else { onJobStatusChange?.("AI 분석 완료"); }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("사진 업로드에 실패했습니다. tourstar 서버 실행 상태를 확인해 주세요.");
      onJobStatusChange?.("업로드 실패");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadPhotosWithDateFilter = async (files: File[] | null) => {
    if (!files || files.length === 0 || isUploading || isFilteringByDate) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setIsFilteringByDate(true);
    try {
      onJobStatusChange?.("촬영일 메타데이터 확인중...");
      const { filteredFiles, excludedCount, unknownCount } = await filterFilesByDateRange(imageFiles);
      if (filteredFiles.length === 0) {
        onJobStatusChange?.("조건에 맞는 사진 없음");
        alert(`선택한 기간에 해당하는 사진이 없습니다.\n(메타데이터 없음: ${unknownCount}장, 제외: ${excludedCount}장)`);
        return;
      }
      if (excludedCount > 0) {
        onJobStatusChange?.(`기간 조건으로 ${excludedCount}장 제외, ${filteredFiles.length}장 자동 업로드중...`);
      } else {
        onJobStatusChange?.(`${filteredFiles.length}장 업로드중...`);
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
          <h2 className="text-lg font-bold text-gray-800">새 여행 기록 만들기</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <p className="mb-5 text-xs text-gray-400">사진을 올리면 AI가 잘 나온 사진을 자동으로 추려드려요 ✨</p>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">사진 ({photos.filter((p) => p.selected).length}/{photos.length} 선택됨)</label>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">파일 업로드</span>
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
                {isFilteringByDate ? "촬영일 확인중..." : isUploading ? "업로드 중..." : "+ 사진 파일 올리기"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async (e) => { await handleUploadPhotosWithDateFilter(e.target.files ? Array.from(e.target.files) : null); e.target.value = ""; }} />
            </div>
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-semibold text-gray-600">촬영일 기간 자동 선별 (메타데이터 기반)</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">시작일
                  <input type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">종료일
                  <input type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none" />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                <input type="checkbox" checked={dateFilter.includeUnknownDate}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, includeUnknownDate: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-400" />
                촬영일 메타데이터가 없는 사진도 포함
              </label>
              <p className="mt-1 text-[10px] text-gray-400">날짜를 입력하면 해당 기간에 촬영된 사진만 자동 업로드됩니다. (OpenAI 미사용)</p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">장소 (선택)</label>
            <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
              placeholder="예: 서울 강남, 부산 해운대 (비워두면 AI가 자동 추정)" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">한줄 코멘트</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none resize-none"
              rows={2} placeholder="간단한 코멘트만 남기면 자동으로 예쁘게 게시됩니다" value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">문체 프리셋 (MBTI)</label>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({ ...form, styleFilter: STYLE_FILTER_AUTO.value })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${form.styleFilter === STYLE_FILTER_AUTO.value ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-600"}`}>
                    {STYLE_FILTER_AUTO.label}
                  </button>
                </div>
                {STYLE_FILTER_GROUPS.map((group) => (
                  <div key={group.title}>
                    <button type="button" onClick={() => setOpenStyleGroup((prev) => (prev === group.title ? null : group.title))}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-semibold text-gray-500 hover:bg-gray-50">
                      <span>{group.title}</span>
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
              <label className="mb-1 block text-xs font-medium text-gray-500">사용자 템플릿 (선택)</label>
              <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                placeholder="예) 잔잔하고 여백 있는 감성, 해시태그 3개" value={form.styleTemplate}
                onChange={(e) => setForm({ ...form, styleTemplate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button type="button" disabled={isGeneratingPost}
            onClick={async () => {
              const selectedPhotos = photos.filter((p) => p.selected);
              if (selectedPhotos.length === 0) return;
              setIsGeneratingPost(true);
              onJobStatusChange?.("AI 게시글 생성중...");
              let generated = { title: `AI 추천 여행 기록 ${new Date().toLocaleDateString("ko-KR")}`, location: "여행지 미입력", comment: form.comment || "여행의 소중한 순간을 기록합니다.", tags: [] as string[] };
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
                });
                setForm({ comment: "", location: "", styleFilter: "AUTO", styleTemplate: "", visibility: "public" });
                setPhotos([]);
                onJobStatusChange?.("AI 게시글 생성 완료");
                onClose();
              } catch (error) { console.error(error); onJobStatusChange?.("게시글 저장 실패"); }
            }}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity">
            {isGeneratingPost ? "생성중..." : "게시하기"}
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
  const [title, setTitle] = useState(post?.title ?? "");
  const [location, setLocation] = useState(post?.location === "위치 미확인" ? "" : (post?.location ?? ""));
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
      setLocation(post.location === "위치 미확인" ? "" : post.location);
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
      window.alert("사진 업로드에 실패했습니다.");
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
      window.alert("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
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
          throw new Error(`사진 업로드에 실패했습니다. (${failed_count}장 실패)`);
        }
        if (failed_count > 0) {
          window.alert(`${failed_count}장의 사진 업로드에 실패했습니다. 성공한 사진만 저장됩니다.`);
        }
      }

      const photosChanged = existingPhotosRemoved || newPaths.length > 0;
      await onSave(post.id, {
        title: title.trim(),
        location: location.trim() || "위치 미확인",
        comment: stripHashtags(comment),
        tags,
        keepPhotoUrls: finalKeepUrls,
        photosChanged,
      });
      onClose();
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : String(error);
      window.alert(`게시글 수정에 실패했습니다.\n${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">게시글 수정</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">장소</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 서울 강남, 부산 해운대"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">본문</label>
            <textarea rows={6} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="본문을 입력하세요"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none resize-none" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-500">사진 수정</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors disabled:opacity-50"
              >
                {uploading ? "업로드 중..." : "+ 사진 추가"}
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
                  title="클릭하면 목록에서 제거됩니다."
                >
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photo.imageUrl})` }} />
                  <div className="absolute top-1 right-1 rounded-full bg-emerald-500 px-1 text-[10px] text-white">신규</div>
                </button>
              ))}
            </div>
            {(existingPhotos.length > 0 || newPhotos.length > 0) && (
              <p className="mt-1 text-[10px] text-gray-400">기존 사진은 클릭해서 유지/제거 선택, 신규 사진은 클릭하면 제거됩니다.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">태그 (쉼표 또는 공백으로 구분)</label>
            <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder="예: 겨울산책, 힐링, 여행기록"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button type="button" onClick={handleDelete} disabled={saving || deleting}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
            {deleting ? "삭제중..." : "게시글 삭제"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
            <button type="button" onClick={handleSave} disabled={saving || deleting || !title.trim()}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "저장중..." : "저장"}
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
}

function PostDetailModal({ post, onClose, onToggleLike, onAddComment, onShare, onEdit, onBookmark, onDeletePost }: DetailModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentInput, setCommentInput] = useState("");

  React.useEffect(() => { setPhotoIndex(0); setCommentInput(""); }, [post]);

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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                {post.author.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{post.author}</p>
                <p className="text-[11px] text-gray-500">{post.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {post.isOwner ? (
                <>
                  <button type="button" onClick={() => onEdit(post)}
                    className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    수정
                  </button>
                  <button type="button" onClick={async () => {
                    const ok = await onDeletePost(post.id);
                    if (ok) onClose();
                  }}
                    className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    삭제
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => onBookmark(post.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${post.bookmarked ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100" : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                  <BookmarkIcon filled={post.bookmarked} />
                  {post.bookmarked ? "스크랩됨" : "스크랩"}
                </button>
              )}
              <button type="button" onClick={onClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <h2 className="text-base font-bold text-gray-800">{post.title}</h2>
            <p className="text-sm leading-relaxed text-gray-700">{stripHashtags(post.comment)}</p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (<span key={tag} className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600">#{tag}</span>))}
              </div>
            )}
            <p className="text-xs text-gray-400">{post.date}</p>
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-semibold text-gray-700">댓글 {post.comments.length}개</p>
              <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                {post.comments.length > 0 ? post.comments.map((item) => (
                  <div key={item.id} className="rounded-lg bg-gray-50 px-2.5 py-2">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-700">{item.author}</span><span>·</span><span>{item.createdAt}</span>
                    </div>
                    <p className="text-xs text-gray-700">{item.content}</p>
                  </div>
                )) : <p className="text-xs text-gray-400">첫 댓글을 남겨보세요.</p>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { const v = commentInput.trim(); if (!v) return; onAddComment(post.id, v); setCommentInput(""); } }}
                  placeholder="댓글을 입력하세요" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none" />
                <button type="button" onClick={() => { const v = commentInput.trim(); if (!v) return; onAddComment(post.id, v); setCommentInput(""); }}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 transition-colors">등록</button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-5 py-3">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onToggleLike(post.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"}`}>
                <HeartIcon filled={post.liked} /><span>{post.likes}</span>
              </button>
              <span className="text-xs text-gray-400">댓글 {post.comments.length}개</span>
              <span className="text-xs text-gray-300">사진 {post.photos.length}장</span>
              <button type="button" onClick={() => onShare(post.id)}
                className="ml-auto rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100">공유 링크 복사</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── 게시물 카드 (피드 뷰) ───────────────────── */
function FeedCard({ post, onClick, onToggleLike, onShare, onBookmark, onEdit, onDeletePost }: {
  post: TourPost;
  onClick: () => void;
  onToggleLike: (id: string) => void;
  onShare: (id: string) => void;
  onBookmark: (id: string) => void;
  onEdit: (post: TourPost) => void;
  onDeletePost: (postId: string) => Promise<boolean>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
      {/* 작성자 헤더 */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
          {post.author.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">{post.author}</p>
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
              title="수정">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button type="button" onClick={(e) => {
              e.stopPropagation();
              void onDeletePost(post.id);
            }}
              className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </div>
        ) : (
          <button type="button" onClick={(e) => { e.stopPropagation(); onBookmark(post.id); }}
            className={`rounded-full p-1.5 transition-colors ${post.bookmarked ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-amber-400"}`}
            title={post.bookmarked ? "스크랩 취소" : "스크랩"}>
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
          <span className="text-[11px]">공유</span>
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
        <div className="absolute top-2 left-2 rounded-full bg-purple-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">내 글</div>
      )}
      {post.bookmarked && !post.isOwner && (
        <div className="absolute top-2 left-2 rounded-full bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">스크랩</div>
      )}
      {post.photos.length > 1 && (
        <div className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">+{post.photos.length}</div>
      )}
    </button>
  );
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
function mapRecordToPost(
  record: TourstarPostRecord,
  fallbackAuthor = "내 여행기록",
  currentUserId?: number | null,
  bookmarkedIds: Set<string> = new Set(),
): TourPost {
  const author = record.author_nickname?.trim() || fallbackAuthor;
  const uid = record.user_id != null ? Number(record.user_id) : null;
  const isOwner = computeIsOwner(uid, currentUserId, author, fallbackAuthor);
  const bookmarked = bookmarkedIds.has(record.id);
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
    title: record.title,
    location: record.location || "위치 미확인",
    date: (record.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    comment: record.comment,
    visibility: record.visibility,
    photos,
    likes: 0,
    liked: false,
    tags: record.tags || [],
    comments: (record.comments || []).map((item) => ({ id: item.id, author: item.author, content: item.content, createdAt: "방금 전" })),
    isOwner,
    bookmarked,
  };
}

export default function TourstarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, logout, accessToken } = useLoginStore();

  const [authorName, setAuthorName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tourstar_author_name") || "내 여행기록";
    }
    return "내 여행기록";
  });
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const [posts, setPosts] = useState<TourPost[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<TourPost | null>(null);
  const [editTargetPost, setEditTargetPost] = useState<TourPost | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");

  /* userId 추출 — DB user_id 는 app_user_id 등 숫자 클레임과 일치해야 함 (sub 는 UUID 인 경우가 많음) */
  React.useEffect(() => {
    if (!accessToken) {
      setCurrentUserId(null);
      return;
    }
    const appId = getAppUserIdFromToken(accessToken);
    if (appId != null) {
      setCurrentUserId(appId);
      return;
    }
    const raw = getUserIdFromToken(accessToken);
    if (!raw) {
      setCurrentUserId(null);
      return;
    }
    const n = Number(raw);
    setCurrentUserId(Number.isFinite(n) && n > 0 ? n : null);
  }, [accessToken]);

  /* 북마크 로드 */
  React.useEffect(() => {
    if (!currentUserId) return;
    const key = `tourstar_bookmarks_${currentUserId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setBookmarkedIds(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, [currentUserId]);

  /* 닉네임 조회 */
  React.useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // 1순위: JWT 클레임에서 즉시 추출
    const jwtNickname = getNicknameFromToken(accessToken);
    if (jwtNickname) {
      setAuthorName(jwtNickname);
      localStorage.setItem("tourstar_author_name", jwtNickname);
      sessionStorage.setItem("_tourstar_author", jwtNickname);
    }

    // 2순위: sessionStorage 캐시
    const cached = sessionStorage.getItem("_tourstar_author");
    if (cached && !jwtNickname) {
      setAuthorName(cached);
      localStorage.setItem("tourstar_author_name", cached);
    }

    // 3순위: profile API 호출 (가장 정확)
    const userId = getAppUserIdFromToken(accessToken) ?? (() => {
      const raw = getUserIdFromToken(accessToken);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
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
        console.error("[tourstar] 닉네임 조회 실패:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, accessToken]);

  React.useEffect(() => { if (!isAuthenticated) { router.replace("/"); } }, [isAuthenticated, router]);

  /* 게시글 목록 로드 */
  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listTourstarPosts();
        if (!cancelled) {
          setPosts(rows.map((r) => mapRecordToPost(r, authorName, currentUserId, bookmarkedIds)));
        }
      } catch (error) { console.error("[tourstar] 게시글 목록 조회 실패:", error); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* authorName 갱신 시 기존 포스트 반영 */
  React.useEffect(() => {
    if (authorName === "내 여행기록") return;
    setPosts((prev) => prev.map((p) => (p.author === "내 여행기록" ? { ...p, author: authorName } : p)));
    setDetailPost((prev) => (prev && prev.author === "내 여행기록" ? { ...prev, author: authorName } : prev));
  }, [authorName]);

  /* currentUserId / bookmarkedIds / 닉네임 변경 시 isOwner, bookmarked 재계산 */
  React.useEffect(() => {
    setPosts((prev) => prev.map((p) => ({
      ...p,
      isOwner: computeIsOwner(p.userId, currentUserId, p.author, authorName),
      bookmarked: bookmarkedIds.has(p.id),
    })));
    setDetailPost((prev) => prev ? ({
      ...prev,
      isOwner: computeIsOwner(prev.userId, currentUserId, prev.author, authorName),
      bookmarked: bookmarkedIds.has(prev.id),
    }) : null);
  }, [currentUserId, bookmarkedIds, authorName]);

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

    if (filter === "mine") result = result.filter((p) => p.isOwner);
    else if (filter === "bookmarked") result = result.filter((p) => p.bookmarked);

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
  }, [posts, filter, searchQuery, searchField, sortType]);

  const stats = useMemo(() => ({
    total: posts.length,
    mine: posts.filter((p) => p.isOwner).length,
    bookmarked: posts.filter((p) => p.bookmarked).length,
    totalPhotos: posts.reduce((acc, p) => acc + p.photos.length, 0),
    totalLikes: posts.reduce((acc, p) => acc + p.likes, 0),
  }), [posts]);

  /* ── 핸들러 ── */
  const toggleLike = (id: string) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
    setDetailPost((prev) => prev && prev.id === id ? { ...prev, liked: !prev.liked, likes: prev.liked ? prev.likes - 1 : prev.likes + 1 } : prev);
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

  const createPost = async (newPost: Omit<TourPost, "id" | "author" | "likes" | "liked" | "comments" | "isOwner" | "bookmarked" | "userId">) => {
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
    });
    setPosts((prev) => [mapRecordToPost(saved, authorName, currentUserId, bookmarkedIds), ...prev]);
  };

  const deletePost = async (postId: string): Promise<boolean> => {
    if (!currentUserId) {
      window.alert("로그인 정보를 확인할 수 없어 삭제할 수 없습니다.");
      return false;
    }
    if (!window.confirm("이 게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) {
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
      window.alert("삭제에 실패했습니다. 본인 게시글인지 확인하거나 잠시 후 다시 시도해주세요.");
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
    const updated = mapRecordToPost(saved, authorName, currentUserId, bookmarkedIds);
    setPosts((prev) => prev.map((p) => p.id === postId ? updated : p));
    setDetailPost((prev) => prev && prev.id === postId ? updated : prev);
  };

  const addComment = async (postId: string, content: string) => {
    const saved = await createTourstarComment(postId, { author: "me", content });
    const newComment: TourPostComment = { id: saved.id, author: saved.author, content: saved.content, createdAt: "방금 전" };
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    setDetailPost((prev) => prev && prev.id === postId ? { ...prev, comments: [...prev.comments, newComment] } : prev);
  };

  const sharePost = async (postId: string) => {
    const shareUrl = buildTourstarShareUrl(postId);
    try { await navigator.clipboard.writeText(shareUrl); window.alert("공유 링크를 복사했어요. 채팅창에 붙여넣어 주세요."); }
    catch (_) { window.prompt("아래 링크를 복사해 채팅에 공유하세요.", shareUrl); }
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout onLogout={logout}>
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">투어스타</h1>
              <p className="mt-0.5 text-xs text-gray-400">여행 사진을 AI가 자동으로 골라주고, 코멘트만 남기면 예쁘게 기록됩니다</p>
              {analysisStatus ? <p className="mt-1 text-xs font-medium text-purple-600">{analysisStatus}</p> : null}
            </div>
            <button type="button" onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              새 기록
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
          {/* 프로필 카드 */}
          <div className="flex items-center gap-6 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white shadow-lg shadow-purple-200">
              {authorName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">{authorName}</h2>
              <p className="mt-0.5 text-xs text-gray-400">소중한 여행의 순간들을 기록하고 공유하세요</p>
              <div className="mt-3 flex gap-6">
                {[
                  { label: "전체", value: stats.total, color: "text-gray-800" },
                  { label: "내 게시물", value: stats.mine, color: "text-purple-600" },
                  { label: "스크랩", value: stats.bookmarked, color: "text-amber-500" },
                  { label: "사진", value: stats.totalPhotos, color: "text-gray-800" },
                  { label: "좋아요", value: stats.totalLikes, color: "text-pink-500" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 검색 바 */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <select value={searchField} onChange={(e) => setSearchField(e.target.value as SearchField)}
              className="border-none bg-transparent text-xs text-gray-600 focus:outline-none cursor-pointer pr-1">
              <option value="all">전체</option>
              <option value="author">유저명</option>
              <option value="title">제목</option>
              <option value="content">본문</option>
              <option value="tags">태그</option>
              <option value="location">장소</option>
            </select>
            <div className="h-3.5 w-px bg-gray-200 shrink-0" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색어를 입력하세요..."
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          {/* 탭 + 정렬 + 뷰 모드 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {([
                { id: "all", label: "전체" },
                { id: "mine", label: "내 게시물" },
                { id: "bookmarked", label: "스크랩" },
              ] as const).map((tab) => (
                <button key={tab.id} type="button" onClick={() => setFilter(tab.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${filter === tab.id ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {tab.label}
                </button>
              ))}
              <span className="ml-1 text-xs text-gray-400">{filteredPosts.length}개의 기록</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 정렬 버튼 */}
              <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
                {([
                  { id: "latest", label: "최신순" },
                  { id: "likes", label: "좋아요순" },
                  { id: "comments", label: "댓글순" },
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
                    onBookmark={toggleBookmark} onEdit={(p) => setEditTargetPost(p)} onDeletePost={deletePost} />
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
                {filter === "mine" ? "내가 올린 게시물이 없습니다" : filter === "bookmarked" ? "스크랩한 게시물이 없습니다" : searchQuery ? "검색 결과가 없습니다" : "아직 기록된 여행이 없습니다"}
              </p>
              <p className="mt-1 text-xs text-gray-300">
                {filter === "bookmarked" ? "다른 사람의 게시물에서 북마크 버튼을 눌러보세요" : "상단의 \"새 기록\" 버튼으로 첫 번째 여행을 기록해보세요"}
              </p>
              {filter === "all" && !searchQuery && (
                <button type="button" onClick={() => setCreateOpen(true)} className="mt-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">여행 기록하기</button>
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
              <h3 className="text-sm font-semibold text-gray-800">AI가 알아서 베스트 사진을 골라드려요</h3>
              <p className="mt-0.5 text-xs text-gray-500">여행 사진을 올리면 잘 나온 사진만 자동으로 추천하고, 간단한 코멘트만 남기면 예쁘게 게시됩니다</p>
            </div>
          </div>
        </div>
      </main>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createPost} onJobStatusChange={setAnalysisStatus} />
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
      />
    </AppLayout>
  );
}
