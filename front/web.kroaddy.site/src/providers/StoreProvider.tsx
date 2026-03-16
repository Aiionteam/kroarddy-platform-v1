"use client";

import React, { ReactNode } from "react";
import { useLoginStore } from "@/store";

// 렌더 단계(useEffect 전)에 즉시 할당 - 자식 컴포넌트의 첫 API 호출 전에 토큰 접근 가능
if (typeof window !== "undefined") {
  (window as any).__loginStore = useLoginStore;
}

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  // useEffect 타이밍 의존 제거 - 렌더 단계에서 항상 최신 store 보장
  if (typeof window !== "undefined") {
    (window as any).__loginStore = useLoginStore;
  }
  return <>{children}</>;
};
