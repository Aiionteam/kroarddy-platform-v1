import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginStore } from "@/store";
import { handleOAuthCallback, extractOAuthParams } from "@/service";

export const useOAuthCallback = (isHydrated: boolean, isAuthenticated: boolean) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticated, setLoadingType } = useLoginStore();
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  useEffect(() => {
    if (!isHydrated || isAuthenticated || isProcessingOAuth) return;
    const params = extractOAuthParams(searchParams);
    if (!params.token && !params.error) return;

    setIsProcessingOAuth(true);
    const result = handleOAuthCallback(params, {
      onSuccess: (provider) => {
        setAuthenticated(true);
        setLoadingType(provider);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider);
        }
        if (!window.opener) router.replace("/home");
      },
      onError: (error) => {
        alert(error);
        router.replace("/");
        setIsProcessingOAuth(false);
      },
      onRedirect: (path) => {
        if (!window.opener) router.replace(path);
      },
    });
    if (result.success && !window.opener) setIsProcessingOAuth(false);
  }, [isHydrated, isAuthenticated, searchParams, router, setAuthenticated, setLoadingType, isProcessingOAuth]);

  return isProcessingOAuth;
};
