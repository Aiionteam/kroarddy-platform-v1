import React from "react";

export const OAuthProcessing: React.FC = () => (
  <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
    <div className="text-center">
      <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent" />
      <p className="text-lg text-gray-700">로그인 처리 중...</p>
    </div>
  </div>
);
