/** BCP 47 locale for Date formatting — align with app i18n language, not browser default */
export function dateLocaleForI18n(i18nLanguage: string | undefined): string {
  const raw = (i18nLanguage || "en").trim();
  const base = raw.split("-")[0]?.toLowerCase() || "en";
  const map: Record<string, string> = {
    ko: "ko-KR",
    en: "en-US",
    ja: "ja-JP",
    zh: "zh-CN",
    de: "de-DE",
    fr: "fr-FR",
    vi: "vi-VN",
    th: "th-TH",
    id: "id-ID",
    hi: "hi-IN",
  };
  return map[raw] || map[base] || raw || "en-US";
}
