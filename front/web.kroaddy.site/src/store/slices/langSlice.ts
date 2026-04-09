import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n, { type Lang, NATIONALITY_TO_LANG } from "@/lib/i18n/config";

interface LangState {
  lang: Lang;
  /** User explicitly selected language/nationality in UI. */
  langPinnedByUser: boolean;
  setLang: (lang: Lang) => void;
  setLangByNationality: (nationality: string, options?: { source?: "user" | "profile" }) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "ko",
      langPinnedByUser: false,

      setLang: (lang) => {
        i18n.changeLanguage(lang);
        set({ lang, langPinnedByUser: true });
      },

      setLangByNationality: (nationality, options) => {
        const key = (nationality ?? "").trim();
        const lang: Lang = NATIONALITY_TO_LANG[key] ?? "en";
        const source = options?.source ?? "user";
        if (source === "profile" && get().langPinnedByUser) return;
        i18n.changeLanguage(lang);
        set((state) => ({
          ...state,
          lang,
          langPinnedByUser: source === "user" ? true : state.langPinnedByUser,
        }));
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
