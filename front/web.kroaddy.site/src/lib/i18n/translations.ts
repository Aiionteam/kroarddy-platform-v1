/**
 * 국적 기반 다국어 지원 (i18n)
 * 국적 선택 시 UI 언어가 자동으로 변경됩니다.
 */

export type Lang = "ko" | "en" | "ja" | "zh" | "de" | "fr";

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
  "Việt Nam": "en",
  "Other": "en",
  "日本": "ja",
  "中国": "zh",
  "Deutschland": "de",
  "France": "fr",
};

export type TranslationKey =
  // 공통
  | "appName"
  | "logout"
  | "save"
  | "cancel"
  | "next"
  | "skip"
  | "done"
  | "loading"
  | "error"
  // 온보딩
  | "onboarding.title"
  | "onboarding.subtitle"
  | "onboarding.later"
  | "onboarding.complete"
  | "onboarding.nationality.title"
  | "onboarding.nationality.subtitle"
  | "onboarding.gender.title"
  | "onboarding.gender.subtitle"
  | "onboarding.age.title"
  | "onboarding.age.subtitle"
  | "onboarding.diet.title"
  | "onboarding.diet.subtitle"
  | "onboarding.religion.title"
  | "onboarding.religion.subtitle"
  | "onboarding.saving"
  // 홈
  | "home.greeting"
  | "home.subtitle"
  | "home.planner"
  | "home.planner.desc"
  | "home.schedule"
  | "home.schedule.desc"
  | "home.guide"
  | "home.guide.desc"
  | "home.kcontent"
  | "home.kcontent.desc"
  | "home.onboarding.banner"
  | "home.onboarding.banner.sub"
  | "home.onboarding.setup"
  | "home.onboarding.close"
  // 사이드바
  | "sidebar.home"
  | "sidebar.planner"
  | "sidebar.schedule"
  | "sidebar.guide"
  | "sidebar.groupchat"
  | "sidebar.friends"
  | "sidebar.profile"
  | "sidebar.logout";

type Translations = Record<TranslationKey, string>;

export const translations: Record<Lang, Translations> = {
  ko: {
    appName: "Kroaddy",
    logout: "로그아웃",
    save: "저장",
    cancel: "취소",
    next: "다음",
    skip: "건너뛰기",
    done: "완료",
    loading: "로딩 중...",
    error: "오류가 발생했어요",
    "onboarding.title": "여행 취향 설정",
    "onboarding.subtitle": "AI 맞춤 여행 추천을 위한 정보를 입력해주세요",
    "onboarding.later": "나중에 하기",
    "onboarding.complete": "완료",
    "onboarding.nationality.title": "어느 나라에서 오셨나요?",
    "onboarding.nationality.subtitle": "선택한 국가에 맞는 언어로 서비스가 제공돼요",
    "onboarding.gender.title": "성별을 알려주세요",
    "onboarding.gender.subtitle": "맞춤 여행지 추천에 활용돼요",
    "onboarding.age.title": "나이대를 선택해주세요",
    "onboarding.age.subtitle": "연령대에 맞는 루트를 추천해드려요",
    "onboarding.diet.title": "식습관을 알려주세요",
    "onboarding.diet.subtitle": "먹거리 루트 구성에 반영돼요",
    "onboarding.religion.title": "종교가 있으신가요?",
    "onboarding.religion.subtitle": "여행 장소·음식 선정 시 고려해드려요",
    "onboarding.saving": "저장 중...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "AI와 함께 나만의 여행을 만들어보세요",
    "home.planner": "여행플래너",
    "home.planner.desc": "AI가 추천하는 여행 루트와 일정",
    "home.schedule": "일정관리",
    "home.schedule.desc": "저장된 내 여행 플랜 보기",
    "home.guide": "장소 추천",
    "home.guide.desc": "맛집 · 행사 한 번에 보기",
    "home.kcontent": "K-Content 플래너",
    "home.kcontent.desc": "K-콘텐츠 기반 여행 플랜 만들기",
    "home.onboarding.banner": "여행 취향을 설정하면 AI 추천이 정확해져요!",
    "home.onboarding.banner.sub": "성별·나이·식습관·종교를 입력하면 맞춤 루트를 추천드려요.",
    "home.onboarding.setup": "설정하기",
    "home.onboarding.close": "닫기",
    "sidebar.home": "홈",
    "sidebar.planner": "여행플래너",
    "sidebar.schedule": "일정관리",
    "sidebar.guide": "장소 추천",
    "sidebar.groupchat": "그룹채팅",
    "sidebar.friends": "친구",
    "sidebar.profile": "프로필",
    "sidebar.logout": "로그아웃",
  },

  en: {
    appName: "Kroaddy",
    logout: "Logout",
    save: "Save",
    cancel: "Cancel",
    next: "Next",
    skip: "Skip",
    done: "Done",
    loading: "Loading...",
    error: "Something went wrong",
    "onboarding.title": "Travel Preferences",
    "onboarding.subtitle": "Help us personalize your AI travel recommendations",
    "onboarding.later": "Later",
    "onboarding.complete": "Done",
    "onboarding.nationality.title": "Where are you from?",
    "onboarding.nationality.subtitle": "The app will switch to your preferred language",
    "onboarding.gender.title": "What is your gender?",
    "onboarding.gender.subtitle": "Used for personalized destination recommendations",
    "onboarding.age.title": "Select your age group",
    "onboarding.age.subtitle": "We'll suggest routes that suit your age group",
    "onboarding.diet.title": "Any dietary preferences?",
    "onboarding.diet.subtitle": "We'll include suitable food spots in your route",
    "onboarding.religion.title": "Do you have a religion?",
    "onboarding.religion.subtitle": "We'll consider this when selecting places & food",
    "onboarding.saving": "Saving...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "Create your perfect trip with AI",
    "home.planner": "Trip Planner",
    "home.planner.desc": "AI-recommended routes & itineraries",
    "home.schedule": "My Plans",
    "home.schedule.desc": "View your saved travel plans",
    "home.guide": "Discover",
    "home.guide.desc": "Restaurants & events in one place",
    "home.kcontent": "K-Content Planner",
    "home.kcontent.desc": "Plan trips inspired by K-content",
    "home.onboarding.banner": "Set your travel preferences for better AI recommendations!",
    "home.onboarding.banner.sub": "Add gender, age, diet & religion for personalized routes.",
    "home.onboarding.setup": "Set up",
    "home.onboarding.close": "Close",
    "sidebar.home": "Home",
    "sidebar.planner": "Trip Planner",
    "sidebar.schedule": "My Plans",
    "sidebar.guide": "Discover",
    "sidebar.groupchat": "Group Chat",
    "sidebar.friends": "Friends",
    "sidebar.profile": "Profile",
    "sidebar.logout": "Logout",
  },

  ja: {
    appName: "Kroaddy",
    logout: "ログアウト",
    save: "保存",
    cancel: "キャンセル",
    next: "次へ",
    skip: "スキップ",
    done: "完了",
    loading: "読み込み中...",
    error: "エラーが発生しました",
    "onboarding.title": "旅行の好みを設定",
    "onboarding.subtitle": "AIパーソナライズ旅行推薦のための情報を入力してください",
    "onboarding.later": "後で",
    "onboarding.complete": "完了",
    "onboarding.nationality.title": "どこから来ましたか？",
    "onboarding.nationality.subtitle": "お住まいの国に合わせた言語でサービスを提供します",
    "onboarding.gender.title": "性別を教えてください",
    "onboarding.gender.subtitle": "おすすめ旅行地のカスタマイズに使用します",
    "onboarding.age.title": "年齢層を選択してください",
    "onboarding.age.subtitle": "年齢に合ったルートをおすすめします",
    "onboarding.diet.title": "食事の好みは？",
    "onboarding.diet.subtitle": "グルメルートの構成に反映されます",
    "onboarding.religion.title": "宗教はありますか？",
    "onboarding.religion.subtitle": "旅行スポット・食事選定時に考慮します",
    "onboarding.saving": "保存中...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "AIと一緒に自分だけの旅を作りましょう",
    "home.planner": "旅行プランナー",
    "home.planner.desc": "AIおすすめのルートと日程",
    "home.schedule": "スケジュール管理",
    "home.schedule.desc": "保存した旅行プランを確認",
    "home.guide": "スポット発見",
    "home.guide.desc": "グルメ・イベントを一括で確認",
    "home.kcontent": "K-Contentプランナー",
    "home.kcontent.desc": "K-コンテンツ発想の旅行プラン作成",
    "home.onboarding.banner": "旅行の好みを設定するとAI推薦が精確になります！",
    "home.onboarding.banner.sub": "性別・年齢・食習慣・宗教を入力すると個別ルートをおすすめします。",
    "home.onboarding.setup": "設定する",
    "home.onboarding.close": "閉じる",
    "sidebar.home": "ホーム",
    "sidebar.planner": "旅行プランナー",
    "sidebar.schedule": "スケジュール",
    "sidebar.guide": "スポット",
    "sidebar.groupchat": "グループチャット",
    "sidebar.friends": "友達",
    "sidebar.profile": "プロフィール",
    "sidebar.logout": "ログアウト",
  },

  zh: {
    appName: "Kroaddy",
    logout: "退出登录",
    save: "保存",
    cancel: "取消",
    next: "下一步",
    skip: "跳过",
    done: "完成",
    loading: "加载中...",
    error: "出现错误",
    "onboarding.title": "旅行偏好设置",
    "onboarding.subtitle": "请输入信息以获取AI个性化旅行推荐",
    "onboarding.later": "稍后设置",
    "onboarding.complete": "完成",
    "onboarding.nationality.title": "您来自哪个国家？",
    "onboarding.nationality.subtitle": "我们将根据您的国籍提供相应语言的服务",
    "onboarding.gender.title": "请告诉我们您的性别",
    "onboarding.gender.subtitle": "用于个性化旅行目的地推荐",
    "onboarding.age.title": "请选择您的年龄段",
    "onboarding.age.subtitle": "我们将推荐适合您年龄段的路线",
    "onboarding.diet.title": "您的饮食习惯是？",
    "onboarding.diet.subtitle": "将反映在美食路线规划中",
    "onboarding.religion.title": "您有宗教信仰吗？",
    "onboarding.religion.subtitle": "在选择旅游地点和餐饮时会考虑到这一点",
    "onboarding.saving": "保存中...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "与AI一起打造专属旅行",
    "home.planner": "旅行规划师",
    "home.planner.desc": "AI推荐的旅行路线和行程",
    "home.schedule": "行程管理",
    "home.schedule.desc": "查看保存的旅行计划",
    "home.guide": "地点推荐",
    "home.guide.desc": "餐厅和活动一览",
    "home.kcontent": "K-Content规划师",
    "home.kcontent.desc": "基于K内容创建旅行计划",
    "home.onboarding.banner": "设置旅行偏好可使AI推荐更准确！",
    "home.onboarding.banner.sub": "输入性别、年龄、饮食习惯和宗教信仰，获取个性化路线推荐。",
    "home.onboarding.setup": "立即设置",
    "home.onboarding.close": "关闭",
    "sidebar.home": "首页",
    "sidebar.planner": "旅行规划师",
    "sidebar.schedule": "行程管理",
    "sidebar.guide": "地点推荐",
    "sidebar.groupchat": "群聊",
    "sidebar.friends": "好友",
    "sidebar.profile": "个人资料",
    "sidebar.logout": "退出登录",
  },

  de: {
    appName: "Kroaddy",
    logout: "Abmelden",
    save: "Speichern",
    cancel: "Abbrechen",
    next: "Weiter",
    skip: "Überspringen",
    done: "Fertig",
    loading: "Wird geladen...",
    error: "Ein Fehler ist aufgetreten",
    "onboarding.title": "Reisepräferenzen",
    "onboarding.subtitle": "Geben Sie Informationen für personalisierte KI-Reiseempfehlungen ein",
    "onboarding.later": "Später",
    "onboarding.complete": "Fertig",
    "onboarding.nationality.title": "Aus welchem Land kommen Sie?",
    "onboarding.nationality.subtitle": "Der Service wird in Ihrer Sprache angeboten",
    "onboarding.gender.title": "Was ist Ihr Geschlecht?",
    "onboarding.gender.subtitle": "Für personalisierte Reisezielempfehlungen",
    "onboarding.age.title": "Wählen Sie Ihre Altersgruppe",
    "onboarding.age.subtitle": "Wir empfehlen altersgerechte Routen",
    "onboarding.diet.title": "Ihre Ernährungsgewohnheiten?",
    "onboarding.diet.subtitle": "Wird bei der Essensroute berücksichtigt",
    "onboarding.religion.title": "Haben Sie eine Religion?",
    "onboarding.religion.subtitle": "Wird bei der Auswahl von Orten und Speisen berücksichtigt",
    "onboarding.saving": "Wird gespeichert...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "Erstellen Sie Ihre perfekte Reise mit KI",
    "home.planner": "Reiseplaner",
    "home.planner.desc": "KI-empfohlene Routen und Reisepläne",
    "home.schedule": "Meine Reisen",
    "home.schedule.desc": "Gespeicherte Reisepläne ansehen",
    "home.guide": "Entdecken",
    "home.guide.desc": "Restaurants & Veranstaltungen auf einen Blick",
    "home.kcontent": "K-Content Planer",
    "home.kcontent.desc": "Reisepläne inspiriert von K-Content",
    "home.onboarding.banner": "Reisepräferenzen für bessere KI-Empfehlungen setzen!",
    "home.onboarding.banner.sub": "Geben Sie Geschlecht, Alter, Ernährung & Religion ein.",
    "home.onboarding.setup": "Einrichten",
    "home.onboarding.close": "Schließen",
    "sidebar.home": "Start",
    "sidebar.planner": "Reiseplaner",
    "sidebar.schedule": "Meine Reisen",
    "sidebar.guide": "Entdecken",
    "sidebar.groupchat": "Gruppenchat",
    "sidebar.friends": "Freunde",
    "sidebar.profile": "Profil",
    "sidebar.logout": "Abmelden",
  },

  fr: {
    appName: "Kroaddy",
    logout: "Déconnexion",
    save: "Enregistrer",
    cancel: "Annuler",
    next: "Suivant",
    skip: "Passer",
    done: "Terminer",
    loading: "Chargement...",
    error: "Une erreur s'est produite",
    "onboarding.title": "Préférences de voyage",
    "onboarding.subtitle": "Entrez vos informations pour des recommandations IA personnalisées",
    "onboarding.later": "Plus tard",
    "onboarding.complete": "Terminer",
    "onboarding.nationality.title": "De quel pays venez-vous ?",
    "onboarding.nationality.subtitle": "Le service sera proposé dans votre langue",
    "onboarding.gender.title": "Quel est votre genre ?",
    "onboarding.gender.subtitle": "Pour des recommandations de destinations personnalisées",
    "onboarding.age.title": "Sélectionnez votre tranche d'âge",
    "onboarding.age.subtitle": "Nous recommanderons des itinéraires adaptés à votre âge",
    "onboarding.diet.title": "Vos habitudes alimentaires ?",
    "onboarding.diet.subtitle": "Reflété dans la composition de l'itinéraire gastronomique",
    "onboarding.religion.title": "Avez-vous une religion ?",
    "onboarding.religion.subtitle": "Pris en compte lors du choix des lieux et des repas",
    "onboarding.saving": "Enregistrement...",
    "home.greeting": "Kroaddy",
    "home.subtitle": "Créez votre voyage parfait avec l'IA",
    "home.planner": "Planificateur",
    "home.planner.desc": "Itinéraires et routes recommandés par l'IA",
    "home.schedule": "Mes voyages",
    "home.schedule.desc": "Voir mes plans de voyage sauvegardés",
    "home.guide": "Découvrir",
    "home.guide.desc": "Restaurants & événements en un coup d'œil",
    "home.kcontent": "Planificateur K-Content",
    "home.kcontent.desc": "Créer des voyages inspirés du K-content",
    "home.onboarding.banner": "Configurez vos préférences pour de meilleures recommandations IA !",
    "home.onboarding.banner.sub": "Ajoutez genre, âge, régime & religion pour des itinéraires personnalisés.",
    "home.onboarding.setup": "Configurer",
    "home.onboarding.close": "Fermer",
    "sidebar.home": "Accueil",
    "sidebar.planner": "Planificateur",
    "sidebar.schedule": "Mes voyages",
    "sidebar.guide": "Découvrir",
    "sidebar.groupchat": "Discussion de groupe",
    "sidebar.friends": "Amis",
    "sidebar.profile": "Profil",
    "sidebar.logout": "Déconnexion",
  },
};

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang][key] ?? translations["ko"][key] ?? key;
}
