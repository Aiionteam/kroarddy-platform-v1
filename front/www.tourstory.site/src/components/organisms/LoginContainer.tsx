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
    <div className="relative w-full max-w-md">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
          TourStory
        </h1>
        <p className="text-gray-700 text-lg leading-relaxed">
          안녕하세요! 👋<br />
          로그인하여 이용해 주세요.
        </p>
      </div>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
        <div className="space-y-4">
          <GoogleLoginButton onClick={handleGoogleLogin} />
          <KakaoLoginButton onClick={handleKakaoLogin} />
          <NaverLoginButton onClick={handleNaverLogin} />
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={handleGuestLogin} className="w-full border-gray-300 text-gray-700 hover:bg-gray-50">
              게스트로 접속하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
