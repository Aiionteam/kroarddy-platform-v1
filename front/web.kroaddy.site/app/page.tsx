"use client";

import React, { useEffect, Suspense } from "react";
import { LoginContainer } from "@/components/organisms/LoginContainer";
import { LoginBackground } from "@/components/organisms/LoginBackground";
import { OAuthProcessing } from "@/components/organisms/OAuthProcessing";
import { useLoginStore } from "@/store";
import { useHydration } from "@/hooks/useHydration";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useTranslation } from "react-i18next";

function HomeContent() {
  const { isAuthenticated, restoreAuthState } = useLoginStore();
  const isHydrated = useHydration();
  const isProcessingOAuth = useOAuthCallback(isHydrated, isAuthenticated);

  useEffect(() => {
    if (isHydrated) restoreAuthState();
  }, [isHydrated, restoreAuthState]);

  useAuthRedirect(isHydrated, isAuthenticated, isProcessingOAuth);

  if (!isHydrated) return null;
  if (isProcessingOAuth) return <OAuthProcessing />;
  if (isAuthenticated) return null;

  return (
    <LoginBackground>
      <LoginContainer />
    </LoginBackground>
  );
}

function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500" aria-live="polite">
      {t("common.loading", { defaultValue: "로딩 중..." })}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
