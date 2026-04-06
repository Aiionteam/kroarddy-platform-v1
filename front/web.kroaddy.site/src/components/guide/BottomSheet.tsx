"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** aria-labelledby 대상 */
  titleId?: string;
  /** 모바일 시트 최대 높이 (viewport) */
  mobileMaxHeight?: string;
}

const sheetTransition = {
  type: "spring" as const,
  damping: 34,
  stiffness: 380,
  mass: 0.85,
};

/**
 * 모바일: 하단 시트 + 드래그 핸들
 * 데스크톱: 우측 글래스 패널
 */
export function BottomSheet({
  open,
  onClose,
  children,
  titleId,
  mobileMaxHeight = "min(88vh,640px)",
}: BottomSheetProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDragEndMobile = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      if (velocity.y > 400 || offset.y > 120) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className={
              isDesktop
                ? "fixed right-0 top-0 z-[40] flex h-full w-full max-w-md flex-col rounded-l-md border-l border-gray-200 bg-white/90 shadow-lg shadow-gray-900/[0.05] backdrop-blur-md backdrop-saturate-150"
                : "fixed inset-x-0 bottom-0 z-[40] flex max-h-[var(--sheet-max)] flex-col rounded-t-md border border-gray-200 border-b-0 bg-white/92 shadow-[0_-6px_32px_-10px_rgba(15,23,42,0.1)] backdrop-blur-md backdrop-saturate-150"
            }
            style={
              !isDesktop
                ? ({ "--sheet-max": mobileMaxHeight } as React.CSSProperties)
                : undefined
            }
            initial={isDesktop ? { x: "100%", opacity: 0.96 } : { y: "100%", opacity: 0.97 }}
            animate={isDesktop ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }}
            exit={isDesktop ? { x: "100%", opacity: 0.96 } : { y: "100%", opacity: 0.97 }}
            transition={sheetTransition}
            drag={isDesktop ? false : "y"}
            dragControls={isDesktop ? undefined : dragControls}
            dragListener={false}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 320 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={isDesktop ? undefined : onDragEndMobile}
          >
            {!isDesktop && (
              <div
                className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div
                  className="h-1 w-11 shrink-0 rounded-full bg-slate-300/90 shadow-sm"
                  aria-hidden
                />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
