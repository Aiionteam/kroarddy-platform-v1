"use client";

import Link from "next/link";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">
        {t("common.not_found.message", { defaultValue: "요청한 페이지를 찾을 수 없습니다." })}
      </p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:no-underline"
      >
        {t("common.not_found.back_home", { defaultValue: "홈으로 돌아가기" })}
      </Link>
    </div>
  );
}
