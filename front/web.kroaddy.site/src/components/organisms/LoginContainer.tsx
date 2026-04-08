"use client";

import React from "react";
import { Button } from "../atoms/Button";
import { GoogleLoginButton } from "../molecules/GoogleLoginButton";
import { KakaoLoginButton } from "../molecules/KakaoLoginButton";
import { NaverLoginButton } from "../molecules/NaverLoginButton";
import { useLoginStore } from "@/store";

export const LoginContainer: React.FC = () => {
  const { handleGoogleLogin, handleKakaoLogin, handleNaverLogin, handleGuestLogin } = useLoginStore();

  return (
    <div className="w-full max-w-[360px]">
      {/* 로고 영역 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-600/40 mb-5">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
        <h1 className="text-[2.25rem] font-bold tracking-tight text-white mb-1.5">
          Kroaddy
        </h1>
        <p className="text-sm text-white/45 tracking-wide">
          AI와 함께하는 스마트 여행 플래너
        </p>
      </div>

      {/* 로그인 카드 */}
      <div className="bg-white/[0.07] backdrop-blur-2xl rounded-3xl border border-white/[0.12] p-6 shadow-2xl shadow-black/40">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-white/30 uppercase text-center mb-5">
          소셜 계정으로 시작하기
        </p>

        <div className="space-y-2.5">
          <GoogleLoginButton onClick={handleGoogleLogin} />
          <KakaoLoginButton onClick={handleKakaoLogin} />
          <NaverLoginButton onClick={handleNaverLogin} />
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[11px] text-white/25">또는</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        <Button type="button" variant="outline" onClick={handleGuestLogin}>
          게스트로 둘러보기
        </Button>
      </div>

      <p className="text-center text-[11px] text-white/20 mt-6 leading-relaxed">
        로그인하면 서비스 이용약관 및<br />개인정보처리방침에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
};
