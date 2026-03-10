"use client";

import React, { ReactNode, useEffect } from "react";
import { useLoginStore } from "@/store";

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  useLoginStore.getState();
  useEffect(() => {
    if (typeof window !== "undefined") (window as any).__loginStore = useLoginStore;
  }, []);
  return <>{children}</>;
};
