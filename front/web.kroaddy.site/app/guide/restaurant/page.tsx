import { redirect } from "next/navigation";

/** 통합 가이드로 이동 — 예전 /guide/restaurant 북마크 호환 */
export default function GuideRestaurantRedirectPage() {
  redirect("/guide");
}
