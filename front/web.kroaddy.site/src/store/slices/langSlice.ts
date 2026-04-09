import { create } from "zustand";
import i18n, { type Lang, NATIONALITY_TO_LANG } from "@/lib/i18n/config";

interface LangState {
  lang: Lang;
  /** User explicitly selected language/nationality in UI. */
  langPinnedByUser: boolean;
  setLang: (lang: Lang) => void;
  setLangByNationality: (nationality: string, options?: { source?: "user" | "profile" }) => void;
}

<<<<<<< HEAD
/**
 * 언어는 localStorage에 두지 않는다. DB `user_profiles.nationality`가 진실이며,
 * 세션마다 `useAutoLocaleFromProfile` + 온보딩/설정에서만 동기화한다.
 * (persist 시 계정 전환 후에도 이전 계정 언어가 남는 문제 방지)
 */
export const useLangStore = create<LangState>()((set) => ({
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
}));
=======
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
>>>>>>> eac67b8546948d3c3f4113fce114a347d96206ba
