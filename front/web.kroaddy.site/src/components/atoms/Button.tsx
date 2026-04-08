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
  const variantClasses = {
    primary:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/15",
    google:
      "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm hover:shadow-md",
    kakao:
      "bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919]",
    naver:
      "bg-[#03C75A] hover:bg-[#02b350] text-white",
    outline:
      "bg-transparent hover:bg-white/5 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20",
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
