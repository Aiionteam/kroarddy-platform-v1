import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TourStar – AI 기반 맞춤형 여행 플래너",
  description:
    "TourStar는 AI가 당신의 취향을 분석해 최적의 여행 루트와 일정을 설계해주는 개인화 여행 플래너 앱입니다.",
  keywords: ["여행", "AI 여행", "여행 플래너", "투어스타", "TourStar"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
