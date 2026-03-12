"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">요청한 페이지를 찾을 수 없습니다.</p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:no-underline"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
