import { redirect } from "next/navigation";

/** 통합 가이드로 이동 — 예전 /guide/event 북마크 호환 */
export default function GuideEventRedirectPage() {
  redirect("/guide");
}
