import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ko from "./locales/ko.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import vi from "./locales/vi.json";
import th from "./locales/th.json";
import id from "./locales/id.json";
import hi from "./locales/hi.json";

export type Lang = "ko" | "en" | "ja" | "zh" | "de" | "fr" | "vi" | "th" | "id" | "hi";

export const NATIONALITY_TO_LANG: Record<string, Lang> = {
  "한국": "ko",
  "Korea": "ko",
  // English locales
  "USA": "en",
  "United States": "en",
  "미국": "en",
  "United Kingdom": "en",
  "UK": "en",
  "영국": "en",
  "Australia": "en",
  "호주": "en",
  "Canada": "en",
  "캐나다": "en",
  "Singapore": "en",
  "싱가포르": "en",
  // NOTE: India should be Hindi per product requirement
  "India": "hi",
  "인도": "hi",
  "Malaysia": "en",
  "말레이시아": "en",
  "Philippines": "en",
  "필리핀": "en",
  // NOTE: Indonesia/Thailand should use their own locales
  "Indonesia": "id",
  "인도네시아": "id",
  "Thailand": "th",
  "태국": "th",
  "Other": "en",
  // Other languages
  "日本": "ja",
  "일본": "ja",
  "Japan": "ja",
  "中国": "zh",
  "중국": "zh",
  "China": "zh",
  "Deutschland": "de",
  "독일": "de",
  "France": "fr",
  "프랑스": "fr",
  "Việt Nam": "vi",
  "베트남": "vi",
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja },
      zh: { translation: zh },
      de: { translation: de },
      fr: { translation: fr },
      vi: { translation: vi },
      th: { translation: th },
      id: { translation: id },
      hi: { translation: hi },
    },
    lng: "ko",
    // In KO UI, fall back to KO. In non-KO UI, fall back to EN to avoid Korean leaking into other languages.
    fallbackLng: { ko: ["ko"], default: ["en"] },
    interpolation: { escapeValue: false },
  });
}

export default i18n;
