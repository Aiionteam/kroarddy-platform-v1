import React from "react";

export const LoginBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-[#0d0d1a]">
    {/* 배경 그라데이션 오브 */}
    <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-violet-700/25 blur-[120px]" />
    <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full bg-fuchsia-700/20 blur-[120px]" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-purple-600/10 blur-[80px]" />

    {/* 격자 패턴 */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />

    {/* 콘텐츠 */}
    <div className="relative flex min-h-screen w-full items-center justify-center px-4">
      {children}
    </div>
  </div>
);
