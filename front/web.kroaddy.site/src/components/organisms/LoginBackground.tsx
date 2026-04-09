import React from "react";

/** 로그인 화면 단색 배경 */
export const LoginBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-white">
    <div className="relative flex min-h-screen w-full items-center justify-center px-4">
      {children}
    </div>
  </div>
);
