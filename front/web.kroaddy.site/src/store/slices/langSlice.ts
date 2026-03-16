import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Lang, type TranslationKey, NATIONALITY_TO_LANG, t as translate } from "@/lib/i18n/translations";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  setLangByNationality: (nationality: string) => void;
  t: (key: TranslationKey) => string;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "ko",

      setLang: (lang) => set({ lang }),

      setLangByNationality: (nationality) => {
        const lang = NATIONALITY_TO_LANG[nationality] ?? "en";
        set({ lang });
      },

      t: (key) => translate(get().lang, key),
    }),
    {
      name: "kroaddy-lang",
    }
  )
);
