import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ko from "./locales/ko.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import vi from "./locales/vi.json";

export type Lang = "ko" | "en" | "ja" | "zh" | "de" | "fr" | "vi";

export const NATIONALITY_TO_LANG: Record<string, Lang> = {
  "한국": "ko",
  "USA": "en",
  "United Kingdom": "en",
  "Australia": "en",
  "Canada": "en",
  "Singapore": "en",
  "India": "en",
  "Malaysia": "en",
  "Philippines": "en",
  "Indonesia": "en",
  "Thailand": "en",
  "Other": "en",
  "日本": "ja",
  "中国": "zh",
  "Deutschland": "de",
  "France": "fr",
  "Việt Nam": "vi",
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
    },
    lng: "ko",
    fallbackLng: "ko",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
