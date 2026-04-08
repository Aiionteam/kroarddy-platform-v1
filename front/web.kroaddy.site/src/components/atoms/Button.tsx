import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "google" | "kakao" | "naver" | "outline";
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}) => {
  const baseClasses =
    "w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5";

  /** 로그인: 그림자·호버 리프트 공통 */
  const loginMotion =
    "shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(0,0,0,0.08)]";

  /** 구글·게스트: 두꺼운 회색 테두리 */
  const loginBordered = `border-2 border-gray-300 hover:border-gray-400 active:border-gray-300 ${loginMotion}`;

  /** 카카오·네이버: 브랜드 색만, 테두리 없음 */
  const loginFlat = `border-0 ${loginMotion}`;

  const variantClasses = {
    primary:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/15",
    google: `bg-white hover:bg-gray-50 text-gray-700 ${loginBordered}`,
    kakao: `bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] ${loginFlat}`,
    naver: `bg-[#03C75A] hover:bg-[#02b350] text-white ${loginFlat}`,
    outline: `bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 ${loginBordered}`,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
