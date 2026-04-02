"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/organisms/AppLayout";
import { useLoginStore } from "@/store";

type Reason = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function MedicalCrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12a2 2 0 0 1 2 2v16H4V4a2 2 0 0 1 2-2z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 3.5L3.8 15a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L13.5 3.5a1.5 1.5 0 0 0-3 0z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.79.62 2.65a2 2 0 0 1-.45 2.11L8.1 9.91a16 16 0 0 0 6 6l1.43-1.18a2 2 0 0 1 2.11-.45c.86.29 1.75.5 2.65.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

const EMERGENCY_REASONS: Reason[] = [
  {
    id: "location",
    label: "위치/안전 도움 필요",
    description: "현재 위치 기반으로 도움을 요청할 수 있어요.",
    icon: <PinIcon />,
  },
  {
    id: "medical",
    label: "의료 도움 필요",
    description: "질병/부상 등 응급 의료 지원이 필요해요.",
    icon: <MedicalCrossIcon />,
  },
  {
    id: "danger",
    label: "긴급 위험 상황",
    description: "폭력/사기/협박 등 즉시 안전이 필요해요.",
    icon: <AlertIcon />,
  },
];

type PhotoItem = { id: string; file: File; url: string };

export default function EmergencySharePage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useLoginStore();

  const [selectedReasons, setSelectedReasons] = React.useState<Set<string>>(new Set(["location"]));

  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [recordingState, setRecordingState] = React.useState<"idle" | "recording" | "ready">("idle");
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const timerRef = React.useRef<number | null>(null);

  const toggleReason = (id: string) => {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    return () => {
      // object url cleanup
      for (const p of photos) URL.revokeObjectURL(p.url);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) return null;

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const images = list.filter((f) => /^image\/(gif|png|jpe?g)$/i.test(f.type)).slice(0, 5);

    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return [];
    });

    const items: PhotoItem[] = images.map((file) => ({
      id: `${Date.now()}_${file.name}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos(items);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (recordingState === "recording") return;
    setRecordingSeconds(0);
    setRecordingState("recording");

    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        try {
          streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingState("ready");
      };

      recorder.start();

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setRecordingState("idle");
      alert("오디오 녹음 권한을 확인해 주세요.");
    }
  };

  const stopRecording = () => {
    if (recordingState !== "recording") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;

    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
      setRecordingState("idle");
    }
  };

  const onStartShare = async () => {
    if (recordingState === "recording") {
      stopRecording();
      // small delay so onstop runs; in demo we don't depend on it
      await new Promise((r) => setTimeout(r, 300));
    }

    if (selectedReasons.size === 0) {
      alert("긴급 상황 유형을 하나 이상 선택해 주세요.");
      return;
    }
    if (photos.length === 0 && !audioUrl) {
      alert("사진 또는 오디오를 첨부해 주세요.");
      return;
    }

    // TODO: API 연동 지점 (현재는 데모)
    const reasonList = Array.from(selectedReasons.values());
    alert(`긴급 상황 공유를 시작합니다. (데모)\n선택: ${reasonList.join(", ")}`);
    router.push("/customer/emergency");
  };

  return (
    <AppLayout onLogout={logout} mobileTitle="긴급상황 공유">
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                ←
              </button>
              <h1 className="text-xl font-bold text-gray-800">긴급상황 대외 공유</h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/customer/emergency")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">긴급 상황 유형</h2>
            <p className="mt-1 text-sm text-gray-500">아래 유형을 선택하고 사진/오디오를 첨부해 즉시 공유할 수 있어요.</p>

            <div className="mt-4 space-y-3">
              {EMERGENCY_REASONS.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-700">{r.icon}</span>
                      <span className="truncate text-sm font-semibold text-gray-900">{r.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">{r.description}</div>
                  </div>

                  <span className="mt-1 flex shrink-0 items-center">
                    <input
                      type="checkbox"
                      checked={selectedReasons.has(r.id)}
                      onChange={() => toggleReason(r.id)}
                      className="h-4 w-4 accent-purple-600"
                      aria-label={`${r.label} 선택`}
                    />
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">첨부</h2>
            <p className="mt-1 text-sm text-gray-500">사진 또는 오디오를 첨부하면 공유가 더 빨라져요.</p>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">🖼️</span>
                  <h3 className="text-sm font-semibold text-gray-800">사진 첨부</h3>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  사진 선택
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={onPickPhotos}
              />

              {photos.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {photos.map((p) => (
                    <div key={p.id} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <img src={p.url} alt="attachment" className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotos((prev) => {
                            for (const x of prev) URL.revokeObjectURL(x.url);
                            return [];
                          });
                        }}
                        className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/70"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  사진을 선택해 주세요.
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">🎙️</span>
                  <h3 className="text-sm font-semibold text-gray-800">오디오 녹음</h3>
                </div>
                {recordingState === "recording" ? (
                  <span className="text-xs font-semibold text-red-600">녹음 중: {recordingSeconds}s</span>
                ) : audioUrl ? (
                  <span className="text-xs font-semibold text-gray-500">녹음 완료</span>
                ) : (
                  <span className="text-xs font-semibold text-gray-500">선택사항</span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {recordingState !== "recording" ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    <span>●</span> 녹음 시작
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    ■ 중지
                  </button>
                )}

                {audioUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setRecordingState("idle");
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    오디오 삭제
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500 sm:text-left">
                    녹음 권한이 필요할 수 있어요.
                  </div>
                )}
              </div>

              {audioUrl ? (
                <div className="mt-3">
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-800">바로 공유</h2>
                <p className="mt-1 text-sm text-gray-500">데모 UI입니다. 버튼 클릭 시 실제 전송 대신 확인 알림이 표시됩니다.</p>
              </div>
              <a
                href="tel:112"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <PhoneIcon />
                긴급전화
              </a>
            </div>

            <button
              type="button"
              onClick={onStartShare}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              긴급 상황 공유 시작
            </button>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

