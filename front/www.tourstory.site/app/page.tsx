"use client";

import React, { useEffect, Suspense } from "react";
import { LoginContainer } from "@/components/organisms/LoginContainer";
import { LoginBackground } from "@/components/organisms/LoginBackground";
import { OAuthProcessing } from "@/components/organisms/OAuthProcessing";
import { useLoginStore } from "@/store";
import { useHydration } from "@/hooks/useHydration";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
