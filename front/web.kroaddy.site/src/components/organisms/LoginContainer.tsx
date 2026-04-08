"use client";

import React from "react";
import Image from "next/image";
import { Button } from "../atoms/Button";
import { GoogleLoginButton } from "../molecules/GoogleLoginButton";
import { KakaoLoginButton } from "../molecules/KakaoLoginButton";
import { NaverLoginButton } from "../molecules/NaverLoginButton";
import { useLoginStore } from "@/store";

export const LoginContainer: React.FC = () => {
  const { handleGoogleLogin, handleKakaoLogin, handleNaverLogin, handleGuestLogin } = useLoginStore();

  return (
    <div className="w-full max-w-[400px]">
      {/* 로고 영역 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-0 animate-kroaddy-float">
          <Image
            src="/logo/logo_no_background.png"
            alt=""
            width={220}
            height={220}
            className="h-32 w-32 object-contain sm:h-40 sm:w-40"
            priority
          />
        </div>
        <div className="flex justify-center -mt-1 mb-1.5">
          <Image
            src="/logo/no_logo.png"
            alt="Kroaddy"
            width={360}
            height={80}
            className="max-w-[min(100%,20rem)] object-contain h-14 w-auto sm:h-16 sm:max-w-[22rem]"
            priority
          />
        </div>
        <p className="text-sm text-gray-500 tracking-wide">
          AI와 함께하는 스마트 여행 플래너
        </p>
      </div>

      <div className="p-0">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase text-center mb-5">
          소셜 계정으로 시작하기
        </p>

        <div className="space-y-2.5">
          <GoogleLoginButton onClick={handleGoogleLogin} />
          <KakaoLoginButton onClick={handleKakaoLogin} />
          <NaverLoginButton onClick={handleNaverLogin} />
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] text-gray-400">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <Button type="button" variant="outline" onClick={handleGuestLogin}>
          게스트로 둘러보기
        </Button>
      </div>

      <p className="text-center text-[11px] text-gray-400 mt-6 leading-relaxed">
        로그인하면 서비스 이용약관 및<br />개인정보처리방침에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
};
