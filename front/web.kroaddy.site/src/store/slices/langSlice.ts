import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n, { type Lang, NATIONALITY_TO_LANG } from "@/lib/i18n/config";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  setLangByNationality: (nationality: string) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "ko",

      setLang: (lang) => {
        i18n.changeLanguage(lang);
        set({ lang });
      },

      setLangByNationality: (nationality) => {
        const lang: Lang = NATIONALITY_TO_LANG[nationality] ?? "en";
        i18n.changeLanguage(lang);
        set({ lang });
      },
    }),
    {
      name: "kroaddy-lang",
      onRehydrateStorage: () => (state) => {
        // 페이지 로드 시 저장된 언어를 i18next에 동기화
        if (state?.lang) i18n.changeLanguage(state.lang);
      },
    }
  )
);
