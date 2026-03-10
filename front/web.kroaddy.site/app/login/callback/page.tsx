"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginStore } from "@/store";
import { handleOAuthCallback, extractOAuthParams } from "@/service";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticated, setLoadingType, setAccessToken } = useLoginStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isProcessing) return;
    const params = extractOAuthParams(searchParams);
    if (!params.token && !params.error) {
      router.replace("/");
      return;
    }
    setIsProcessing(true);

    if (params.token) setAccessToken(params.token);

    const result = handleOAuthCallback(params, {
      onSuccess: (provider) => {
        setAuthenticated(true);
        setLoadingType(provider);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("loadingType", provider);
        }
        setStatus("success");
        router.replace("/home");
      },
      onError: (error) => {
        setStatus("error");
        setErrorMessage(error);
        setIsProcessing(false);
      },
      onRedirect: (path) => router.replace(path),
    });

    if (result.success) setStatus("success");
  }, [searchParams, router, setAuthenticated, setLoadingType, setAccessToken, isProcessing]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-blue-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent" />
          <p className="text-lg text-gray-700">로그인 처리 중...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-blue-50">
        <div className="text-center">
          <p className="mb-4 text-lg font-semibold text-red-600">로그인 실패</p>
          <p className="mb-6 text-gray-700">{errorMessage}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-pink-500 px-6 py-2 text-white hover:bg-pink-600"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-blue-50">
      <div className="text-center">
        <p className="mb-4 text-lg font-semibold text-green-600">로그인 성공!</p>
        <p className="text-gray-700">홈으로 이동 중...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-blue-50">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent" />
            <p className="text-lg text-gray-700">로딩 중...</p>
          </div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
