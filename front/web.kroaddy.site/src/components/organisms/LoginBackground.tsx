import React from "react";

/** 홈·플래너 등과 맞춘 라이트 톤 배경 (gray-100 / 연보라 그라데이션) */
export const LoginBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#f8f7ff] via-white to-purple-50">
    <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-purple-200/45 blur-3xl" />
    <div className="absolute -bottom-40 -left-40 w-[380px] h-[380px] rounded-full bg-violet-200/35 blur-3xl" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-fuchsia-100/40 blur-3xl" />

    <div className="absolute inset-0 bg-[linear-gradient(rgba(107,33,168,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(107,33,168,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

    <div className="relative flex min-h-screen w-full items-center justify-center px-4">
      {children}
    </div>
  </div>
);
