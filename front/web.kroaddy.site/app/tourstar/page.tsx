"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { AppSidebar } from "@/components/organisms/AppSidebar";
import {
  buildTourstarImageUrl,
  generateTourstarAutoComment,
  generateTourstarPost,
  getTourstarJobStatus,
  localArtifactPathToUrl,
  type TourstarStyleFilter,
  uploadTourstarPhotos,
} from "@/lib/api/tourstar";

/* ────────────────────────── 타입 정의 ────────────────────────── */
type Visibility = "public" | "private";
type ViewMode = "grid" | "feed";
type FilterType = "all" | "public" | "private";

interface TourPhoto {
  id: string;
  gradient: string; // placeholder gradient
  selected: boolean; // AI가 추천한 사진 여부
  imageUrl?: string; // 업로드된 실제 이미지 미리보기 URL
  fileName?: string;
  sourceImagePath?: string; // 백엔드 분석 결과 원본 경로
  aiRank?: number; // AI가 계산한 순위(1부터 시작)
  aiScore?: number; // AI 점수(0~1)
}

interface TourPostComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface TourPost {
  id: string;
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

/* ───────────────────── 샘플 데이터 ───────────────────── */
const SAMPLE_POSTS: TourPost[] = [
  {
    id: "1",
    title: "제주도 3일간의 힐링 여행",
    location: "제주특별자치도",
    date: "2026-02-10",
    comment: "바다와 오름, 맛있는 흑돼지까지! 제주도의 매력에 푹 빠진 3일이었습니다 🌊",
    visibility: "public",
    photos: [
      { id: "p1", gradient: "from-sky-300 to-blue-500", selected: true },
      { id: "p2", gradient: "from-orange-300 to-rose-400", selected: true },
      { id: "p3", gradient: "from-emerald-300 to-teal-500", selected: true },
      { id: "p4", gradient: "from-cyan-300 to-sky-500", selected: false },
      { id: "p5", gradient: "from-amber-200 to-orange-400", selected: true },
    ],
    likes: 24,
    liked: false,
    tags: ["제주도", "힐링", "바다", "흑돼지"],
    comments: [
      { id: "c1", author: "mina", content: "사진 무드 너무 좋아요!", createdAt: "방금 전" },
      { id: "c2", author: "jiho", content: "제주 또 가고 싶어짐", createdAt: "2시간 전" },
    ],
  },
  {
    id: "2",
    title: "교토 벚꽃 나들이 🌸",
    location: "일본 교토",
    date: "2026-01-25",
    comment: "아라시야마 대나무숲과 금각사, 그리고 거리 곳곳의 벚꽃이 환상적이었어요",
    visibility: "public",
    photos: [
      { id: "p6", gradient: "from-pink-300 to-fuchsia-500", selected: true },
      { id: "p7", gradient: "from-rose-300 to-pink-500", selected: true },
      { id: "p8", gradient: "from-violet-300 to-purple-500", selected: true },
    ],
    likes: 42,
    liked: true,
    tags: ["교토", "벚꽃", "일본여행"],
    comments: [{ id: "c3", author: "yuna", content: "벚꽃 시즌에 꼭 가보고 싶다", createdAt: "1일 전" }],
  },
  {
    id: "3",
    title: "부산 해운대 주말 여행",
    location: "부산광역시",
    date: "2026-01-18",
    comment: "해운대 야경이 정말 아름다웠고, 광안리에서 먹은 회가 잊을 수 없네요",
    visibility: "private",
    photos: [
      { id: "p9", gradient: "from-indigo-300 to-blue-500", selected: true },
      { id: "p10", gradient: "from-lime-300 to-emerald-400", selected: true },
      { id: "p11", gradient: "from-amber-200 to-orange-400", selected: false },
      { id: "p12", gradient: "from-sky-300 to-blue-500", selected: true },
    ],
    likes: 8,
    liked: false,
    tags: ["부산", "해운대", "야경"],
    comments: [],
  },
  {
    id: "4",
    title: "강릉 카페투어 ☕",
    location: "강원도 강릉시",
    date: "2026-01-05",
    comment: "안목해변 카페거리에서 바다를 보며 커피 한잔의 여유. 순두부도 먹고 왔어요!",
    visibility: "public",
    photos: [
      { id: "p13", gradient: "from-amber-200 to-orange-400", selected: true },
      { id: "p14", gradient: "from-emerald-300 to-teal-500", selected: true },
    ],
    likes: 15,
    liked: false,
    tags: ["강릉", "카페", "바다"],
    comments: [],
  },
  {
    id: "5",
    title: "방콕 길거리 음식 탐방",
    location: "태국 방콕",
    date: "2025-12-20",
    comment: "카오산로드의 열기와 왓 아룬의 황금빛 석양, 팟타이는 진리!",
    visibility: "private",
    photos: [
      { id: "p15", gradient: "from-orange-300 to-rose-400", selected: true },
      { id: "p16", gradient: "from-violet-300 to-purple-500", selected: true },
      { id: "p17", gradient: "from-cyan-300 to-sky-500", selected: true },
      { id: "p18", gradient: "from-rose-300 to-pink-500", selected: false },
      { id: "p19", gradient: "from-lime-300 to-emerald-400", selected: true },
      { id: "p20", gradient: "from-pink-300 to-fuchsia-500", selected: false },
    ],
    likes: 31,
    liked: true,
    tags: ["방콕", "길거리음식", "태국"],
    comments: [{ id: "c4", author: "sohee", content: "팟타이 진리 인정", createdAt: "3일 전" }],
  },
];

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

/* ───────────────────── 새 게시물 작성 모달 ───────────────────── */
interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (post: Omit<TourPost, "id" | "likes" | "liked" | "comments">) => void;
  onJobStatusChange?: (status: string) => void;
}

function CreatePostModal({ open, onClose, onCreate, onJobStatusChange }: CreateModalProps) {
  const [form, setForm] = useState({
    comment: "",
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
          // 1초 간격 폴링 (최대 60초)
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // eslint-disable-next-line no-await-in-loop
          const status = await getTourstarJobStatus(jobId);
          if (status.status === "queued") {
            onJobStatusChange?.("AI 사진 분석 대기중...");
            continue;
          }
          if (status.status === "running") {
            onJobStatusChange?.("AI 사진 분석중...");
            continue;
          }
          if (status.status === "failed") {
            onJobStatusChange?.("AI 분석 실패");
            break;
          }
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
                    if (!row) {
                      return {
                        ...p,
                        selected: false,
                        sourceImagePath: undefined,
                        aiRank: undefined,
                        aiScore: undefined,
                      };
                    }
                    return {
                      ...p,
                      selected: false,
                      sourceImagePath: row.source_image,
                      aiRank: row.rank,
                      aiScore: row.final_score,
                    };
                  })
                  .sort((a, b) => {
                    const ar = a.aiRank ?? Number.MAX_SAFE_INTEGER;
                    const br = b.aiRank ?? Number.MAX_SAFE_INTEGER;
                    return ar - br;
                  });
                return ranked;
              });
              onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
              try {
                const topImagePaths = rankedRows
                  .map((r) => r.source_image)
                  .filter((v) => !!v)
                  .slice(0, 3);
                if (topImagePaths.length > 0) {
                  onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성중...)");
                  const auto = await generateTourstarAutoComment(topImagePaths, 3);
                  if ((auto.comment || "").trim()) {
                    setForm((prev) => {
                      if (prev.comment.trim().length > 0) return prev;
                      return { ...prev, comment: auto.comment.trim() };
                    });
                    onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성됨)");
                  } else {
                    onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
                  }
                }
              } catch (error) {
                console.error(error);
                onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
              }
            } else {
              const bestRows = status.result?.best ?? [];
              if (bestRows.length > 0) {
                setPhotos((prev) =>
                  prev.map((p) => {
                    const key = (p.imageUrl ?? "").replace(/\\/g, "/").toLowerCase();
                    const row = bestRows.find((r) => {
                      const srcUrl = localArtifactPathToUrl(r.source_image).replace(/\\/g, "/").toLowerCase();
                      return srcUrl === key;
                    });
                    return {
                      ...p,
                      selected: false,
                      sourceImagePath: row?.source_image,
                      aiRank: row?.rank,
                      aiScore: row?.final_score,
                      imageUrl: row ? localArtifactPathToUrl(row.saved_image) || p.imageUrl : p.imageUrl,
                    };
                  }),
                );
                onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
                try {
                  const topImagePaths = bestRows
                    .map((r) => r.source_image)
                    .filter((v) => !!v)
                    .slice(0, 3);
                  if (topImagePaths.length > 0) {
                    onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성중...)");
                    const auto = await generateTourstarAutoComment(topImagePaths, 3);
                    if ((auto.comment || "").trim()) {
                      setForm((prev) => {
                        if (prev.comment.trim().length > 0) return prev;
                        return { ...prev, comment: auto.comment.trim() };
                      });
                      onJobStatusChange?.("AI 분석 완료 (코멘트 초안 생성됨)");
                    } else {
                      onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
                    }
                  }
                } catch (error) {
                  console.error(error);
                  onJobStatusChange?.("AI 분석 완료 (순위 확인 후 사진 선택)");
                }
              } else {
                onJobStatusChange?.("AI 분석 완료");
              }
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
        alert(
          `선택한 기간에 해당하는 사진이 없습니다.\n(메타데이터 없음: ${unknownCount}장, 제외: ${excludedCount}장)`,
        );
        return;
      }

      if (excludedCount > 0) {
        onJobStatusChange?.(
          `기간 조건으로 ${excludedCount}장 제외, ${filteredFiles.length}장 자동 업로드중...`,
        );
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
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold text-gray-800">새 여행 기록 만들기</h2>
        <p className="mb-5 text-xs text-gray-400">사진을 올리면 AI가 잘 나온 사진을 자동으로 추려드려요 ✨</p>

        <div className="space-y-4">
          {/* 사진 선택 영역 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">
                사진 ({photos.filter((p) => p.selected).length}/{photos.length} 선택됨)
              </label>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                파일 업로드
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => togglePhoto(photo.id)}
                  className={`group relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${photo.gradient} transition-all ${photo.selected
                    ? "ring-3 ring-purple-500 ring-offset-2"
                    : "opacity-50 hover:opacity-75"
                    }`}
                >
                  {photo.imageUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${photo.imageUrl})` }}
                    />
                  ) : null}
                  {/* 체크 표시 */}
                  <div
                    className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white transition-all ${photo.selected ? "bg-purple-500" : "bg-black/30"
                      }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  {photo.aiRank ? (
                    <div className="absolute top-1.5 left-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 backdrop-blur-sm">
                      #{photo.aiRank}
                    </div>
                  ) : null}
                  {!photo.imageUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-40">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
            {/* 파일 업로드 */}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isFilteringByDate}
                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors"
              >
                {isFilteringByDate
                  ? "촬영일 확인중..."
                  : isUploading
                    ? "업로드 중..."
                    : "+ 사진 파일 올리기"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  await handleUploadPhotosWithDateFilter(e.target.files ? Array.from(e.target.files) : null);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-semibold text-gray-600">촬영일 기간 자동 선별 (메타데이터 기반)</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">
                  시작일
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-gray-500">
                  종료일
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-300 focus:outline-none"
                  />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                <input
                  type="checkbox"
                  checked={dateFilter.includeUnknownDate}
                  onChange={(e) =>
                    setDateFilter((prev) => ({ ...prev, includeUnknownDate: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-400"
                />
                촬영일 메타데이터가 없는 사진도 포함
              </label>
              <p className="mt-1 text-[10px] text-gray-400">
                날짜를 입력하면 해당 기간에 촬영된 사진만 자동 업로드됩니다. (OpenAI 미사용)
              </p>
            </div>
          </div>

          {/* 코멘트 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">한줄 코멘트</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none resize-none"
              rows={2}
              placeholder="간단한 코멘트만 남기면 자동으로 예쁘게 게시됩니다"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>

          {/* MBTI 문체 설정 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">문체 프리셋 (MBTI)</label>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, styleFilter: STYLE_FILTER_AUTO.value })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${form.styleFilter === STYLE_FILTER_AUTO.value
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-600"
                      }`}
                  >
                    {STYLE_FILTER_AUTO.label}
                  </button>
                </div>
                {STYLE_FILTER_GROUPS.map((group) => (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenStyleGroup((prev) => (prev === group.title ? null : group.title))
                      }
                      className="mb-1 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      <span>{group.title}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`transition-transform ${openStyleGroup === group.title ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openStyleGroup === group.title ? (
                      <div className="flex flex-wrap gap-2 pb-1">
                        {group.options.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setForm({ ...form, styleFilter: option.value })}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${form.styleFilter === option.value
                              ? "border-purple-300 bg-purple-50 text-purple-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-600"
                              }`}
                          >
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
              <label className="mb-1 block text-xs font-medium text-gray-500">
                사용자 템플릿 (선택)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                placeholder="예) 잔잔하고 여백 있는 감성, 해시태그 3개"
                value={form.styleTemplate}
                onChange={(e) => setForm({ ...form, styleTemplate: e.target.value })}
              />
            </div>
          </div>

          {/* 공개 설정 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">공개 설정</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, visibility: "public" })}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all ${form.visibility === "public"
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                공개
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, visibility: "private" })}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all ${form.visibility === "private"
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                비공개
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={async () => {
              const selectedPhotos = photos.filter((p) => p.selected);
              if (selectedPhotos.length === 0) return;
              setIsGeneratingPost(true);
              onJobStatusChange?.("AI 게시글 생성중...");
              let generated = {
                title: `AI 추천 여행 기록 ${new Date().toLocaleDateString("ko-KR")}`,
                location: "여행지 미입력",
                comment: form.comment || "여행의 소중한 순간을 기록합니다.",
                tags: [] as string[],
              };
              try {
                const selectedImagePaths = selectedPhotos
                  .map((p) => p.sourceImagePath)
                  .filter((v): v is string => Boolean(v && v.trim()));
                generated = await generateTourstarPost(
                  form.comment,
                  form.styleFilter,
                  form.styleTemplate,
                  selectedImagePaths,
                );
              } catch (error) {
                console.error(error);
              } finally {
                setIsGeneratingPost(false);
              }
              onCreate({
                title: generated.title,
                location: generated.location,
                date: new Date().toISOString().split("T")[0],
                comment: generated.comment,
                visibility: form.visibility,
                photos: selectedPhotos,
                tags: generated.tags,
              });
              setForm({ comment: "", styleFilter: "AUTO", styleTemplate: "", visibility: "public" });
              setPhotos([]);
              onJobStatusChange?.("AI 게시글 생성 완료");
              onClose();
            }}
            disabled={isGeneratingPost}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            {isGeneratingPost ? "생성중..." : "게시하기"}
          </button>
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
  onToggleVisibility: (id: string) => void;
  onAddComment: (postId: string, content: string) => void;
}

function PostDetailModal({ post, onClose, onToggleLike, onToggleVisibility, onAddComment }: DetailModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentInput, setCommentInput] = useState("");

  React.useEffect(() => {
    setPhotoIndex(0);
    setCommentInput("");
  }, [post]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 왼쪽: 사진 영역 */}
        <div className="relative flex w-1/2 items-center justify-center bg-gray-900">
          <div
            className={`h-full w-full ${post.photos[photoIndex]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[photoIndex]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
            style={
              post.photos[photoIndex]?.imageUrl
                ? { backgroundImage: `url(${post.photos[photoIndex].imageUrl})` }
                : undefined
            }
          >
            <div className="flex h-full items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          </div>
          {/* 사진 네비게이션 */}
          {post.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex((prev) => (prev > 0 ? prev - 1 : post.photos.length - 1));
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex((prev) => (prev < post.photos.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {/* 인디케이터 */}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {post.photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIndex(i);
                    }}
                    className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 상세 정보 */}
        <div className="flex w-1/2 flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                T
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">내 여행기록</p>
                <p className="text-[11px] text-gray-600">{post.location}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleVisibility(post.id)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all ${post.visibility === "public"
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
            >
              {post.visibility === "public" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {post.visibility === "public" ? "공개" : "비공개"}
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <h2 className="text-base font-bold text-gray-800">{post.title}</h2>
            <p className="text-sm leading-relaxed text-gray-700">{post.comment}</p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600">{post.date}</p>

            <div className="border-t border-gray-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">댓글 {post.comments.length}개</p>
              </div>
              <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                {post.comments.length > 0 ? (
                  post.comments.map((item) => (
                    <div key={item.id} className="rounded-lg bg-gray-50 px-2.5 py-2">
                      <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="font-semibold text-gray-700">{item.author}</span>
                        <span>·</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="text-xs text-gray-700">{item.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">첫 댓글을 남겨보세요.</p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = commentInput.trim();
                      if (!value) return;
                      onAddComment(post.id, value);
                      setCommentInput("");
                    }
                  }}
                  placeholder="댓글을 입력하세요"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = commentInput.trim();
                    if (!value) return;
                    onAddComment(post.id, value);
                    setCommentInput("");
                  }}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 transition-colors"
                >
                  등록
                </button>
              </div>
            </div>
          </div>

          {/* 하단 액션 */}
          <div className="border-t border-gray-100 px-5 py-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onToggleLike(post.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"
                  }`}
              >
                <HeartIcon filled={post.liked} />
                <span>{post.likes}</span>
              </button>
              <span className="text-xs text-gray-400">댓글 {post.comments.length}개</span>
              <span className="text-xs text-gray-300">사진 {post.photos.length}장</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── 게시물 카드 (피드 뷰) ───────────────────── */
interface FeedCardProps {
  post: TourPost;
  onClick: () => void;
  onToggleLike: (id: string) => void;
}

function FeedCard({ post, onClick, onToggleLike }: FeedCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
      {/* 사진 */}
      <button type="button" onClick={onClick} className="relative w-full">
        <div
          className={`aspect-[16/10] w-full ${post.photos[0]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[0]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
          style={post.photos[0]?.imageUrl ? { backgroundImage: `url(${post.photos[0].imageUrl})` } : undefined}
        >
          <div className="flex h-full items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        </div>
        {/* 사진 개수 배지 */}
        {post.photos.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            {post.photos.length}
          </div>
        )}
        {/* 공개/비공개 배지 */}
        <div
          className={`absolute top-3 left-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm ${post.visibility === "public"
            ? "bg-emerald-500/80 text-white"
            : "bg-gray-800/60 text-gray-200"
            }`}
        >
          {post.visibility === "public" ? "공개" : "비공개"}
        </div>
      </button>

      {/* 하단 정보 */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold text-gray-800">{post.title}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {post.location}
              <span>·</span>
              <span>{post.date}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(post.id);
            }}
            className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition-colors ${post.liked ? "text-pink-500" : "text-gray-400 hover:text-pink-500"
              }`}
          >
            <HeartIcon filled={post.liked} />
            <span>{post.likes}</span>
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          댓글 {post.comments.length}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-gray-700">{post.comment}</p>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                #{tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="text-[11px] text-gray-600">+{post.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── 그리드 카드 ───────────────────── */
interface GridCardProps {
  post: TourPost;
  onClick: () => void;
}

function GridCard({ post, onClick }: GridCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl"
    >
      <div
        className={`h-full w-full ${post.photos[0]?.imageUrl ? "bg-cover bg-center" : `bg-gradient-to-br ${post.photos[0]?.gradient ?? "from-gray-300 to-gray-500"}`}`}
        style={post.photos[0]?.imageUrl ? { backgroundImage: `url(${post.photos[0].imageUrl})` } : undefined}
      >
        <div className="flex h-full items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      </div>
      {/* 호버 오버레이 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1 text-sm font-medium text-white">
            <HeartIcon filled={true} />
            {post.likes}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            {post.photos.length}
          </span>
        </div>
      </div>
      {/* 공개/비공개 배지 */}
      <div
        className={`absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${post.visibility === "public"
          ? "bg-emerald-500/80 text-white"
          : "bg-gray-800/60 text-gray-200"
          }`}
      >
        {post.visibility === "public" ? "공개" : "비공개"}
      </div>
      {/* 사진 개수 */}
      {post.photos.length > 1 && (
        <div className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
          +{post.photos.length}
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function TourstarPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  /* ── 상태 ── */
  const [posts, setPosts] = useState<TourPost[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [filter, setFilter] = useState<FilterType>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<TourPost | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  /* ── 필터링 ── */
  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.visibility === filter);
  }, [posts, filter]);

  /* ── 통계 ── */
  const stats = useMemo(() => {
    return {
      total: posts.length,
      public: posts.filter((p) => p.visibility === "public").length,
      private: posts.filter((p) => p.visibility === "private").length,
      totalPhotos: posts.reduce((acc, p) => acc + p.photos.length, 0),
      totalLikes: posts.reduce((acc, p) => acc + p.likes, 0),
    };
  }, [posts]);

  /* ── 핸들러 ── */
  const toggleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );
    // 상세 모달 갱신
    setDetailPost((prev) =>
      prev && prev.id === id
        ? { ...prev, liked: !prev.liked, likes: prev.liked ? prev.likes - 1 : prev.likes + 1 }
        : prev,
    );
  };

  const toggleVisibility = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, visibility: p.visibility === "public" ? "private" : "public" }
          : p,
      ),
    );
    setDetailPost((prev) =>
      prev && prev.id === id
        ? { ...prev, visibility: prev.visibility === "public" ? "private" : "public" }
        : prev,
    );
  };

  const createPost = (newPost: Omit<TourPost, "id" | "likes" | "liked" | "comments">) => {
    setPosts((prev) => [
      { ...newPost, id: Date.now().toString(), likes: 0, liked: false, comments: [] },
      ...prev,
    ]);
  };

  const addComment = (postId: string, content: string) => {
    const newComment: TourPostComment = {
      id: `comment-${Date.now()}`,
      author: "me",
      content,
      createdAt: "방금 전",
    };
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p)),
    );
    setDetailPost((prev) =>
      prev && prev.id === postId
        ? { ...prev, comments: [...prev.comments, newComment] }
        : prev,
    );
  };

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 overflow-y-auto">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">투어스타</h1>
              <p className="mt-0.5 text-xs text-gray-400">
                여행 사진을 AI가 자동으로 골라주고, 코멘트만 남기면 예쁘게 기록됩니다
              </p>
              {analysisStatus ? (
                <p className="mt-1 text-xs font-medium text-purple-600">{analysisStatus}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 기록
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
          {/* ── 프로필 & 통계 ── */}
          <div className="flex items-center gap-6 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white shadow-lg shadow-purple-200">
              T
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">내 여행기록</h2>
              <p className="mt-0.5 text-xs text-gray-400">소중한 여행의 순간들을 기록하고 공유하세요</p>
              <div className="mt-3 flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{stats.total}</p>
                  <p className="text-[11px] text-gray-400">게시물</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{stats.totalPhotos}</p>
                  <p className="text-[11px] text-gray-400">사진</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-pink-500">{stats.totalLikes}</p>
                  <p className="text-[11px] text-gray-400">좋아요</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">{stats.public}</p>
                  <p className="text-[11px] text-gray-400">공개</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-500">{stats.private}</p>
                  <p className="text-[11px] text-gray-400">비공개</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 필터 & 뷰 토글 ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(
                [
                  { id: "all", label: "전체" },
                  { id: "public", label: "공개" },
                  { id: "private", label: "비공개" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${filter === tab.id
                    ? "border-purple-300 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
              <span className="ml-2 text-xs text-gray-400">{filteredPosts.length}개의 기록</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("feed")}
                className={`rounded-md p-1.5 transition-colors ${viewMode === "feed" ? "bg-purple-100 text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                title="피드 보기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="7" rx="1" />
                  <rect x="3" y="14" width="18" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-purple-100 text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                title="그리드 보기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── 게시물 목록 ── */}
          {filteredPosts.length > 0 ? (
            viewMode === "feed" ? (
              <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                {filteredPosts.map((post) => (
                  <FeedCard
                    key={post.id}
                    post={post}
                    onClick={() => setDetailPost(post)}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredPosts.map((post) => (
                  <GridCard key={post.id} post={post} onClick={() => setDetailPost(post)} />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mb-4 text-gray-300"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm font-medium text-gray-400">아직 기록된 여행이 없습니다</p>
              <p className="mt-1 text-xs text-gray-300">
                상단의 &quot;새 기록&quot; 버튼으로 첫 번째 여행을 기록해보세요
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                여행 기록하기
              </button>
            </div>
          )}

          {/* ── AI 사진 선별 안내 배너 ── */}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#tourgrad)" strokeWidth="2">
                <defs>
                  <linearGradient id="tourgrad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-800">AI가 알아서 베스트 사진을 골라드려요</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                여행 사진을 올리면 잘 나온 사진만 자동으로 추천하고, 간단한 코멘트만 남기면 예쁘게 게시됩니다
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── 모달 ── */}
      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createPost}
        onJobStatusChange={setAnalysisStatus}
      />
      <PostDetailModal
        post={detailPost}
        onClose={() => setDetailPost(null)}
        onToggleLike={toggleLike}
        onToggleVisibility={toggleVisibility}
        onAddComment={addComment}
      />
    </div>
  );
}
