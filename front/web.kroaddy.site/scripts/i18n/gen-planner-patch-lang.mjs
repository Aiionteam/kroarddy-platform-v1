/**
 * Generate {lang}-kcontent.json from English reference + top-level string map.
 * Market/fallback blocks copied from ja-kcontent with translated descriptions where needed.
 * Run: node scripts/i18n/gen-planner-patch-lang.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refPath = path.join(__dirname, "planner-patches/_en-kcontent-ref.json");
const jaPath = path.join(__dirname, "planner-patches/ja-kcontent.json");
const outDir = path.join(__dirname, "planner-patches");

const en = JSON.parse(fs.readFileSync(refPath, "utf8"));
const jaMarket = JSON.parse(fs.readFileSync(jaPath, "utf8")).market;
const jaFallback = JSON.parse(fs.readFileSync(jaPath, "utf8")).fallback;

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

/** Replace all string leaves; keep structure. Market/fallback from ja template for Asian langs, from en for others. */
function buildKcontent(base, top, marketSrc, fallbackSrc) {
  const k = clone(base);
  for (const key of Object.keys(top)) k[key] = top[key];
  k.market = clone(marketSrc);
  k.fallback = clone(fallbackSrc);
  return k;
}

const ZH_TOP = {
  title: "K-内容规划师",
  subtitle: "通过 K-Pop、韩剧、美食与美妆探索韩国",
  hero_title: "K-内容规划师",
  hero_subtitle: "通过 K-Pop、韩剧、美食与美妆探索韩国",
  hero_cta: "生成 AI 路线",
  back: "返回规划师",
  row_kpop: "K-POP",
  row_kdrama: "K-剧 / 电影",
  row_kfood: "K-美食",
  row_kbeauty: "K-美妆",
  sample_itinerary: "示例行程",
  search_bar: "搜索",
  quick_selection: "快捷选择",
  vibe_grid: "氛围选择",
  date: "日期",
  generating: "生成中…",
  generate: "✨ 生成行程",
  ai_recommended: "AI 推荐行程",
  region_select: "选择地区",
  traditional_market: "传统市场",
  market_generate: "生成此市场美食行程",
  cafe_question: "今天想要哪种氛围？",
  cafe_hint: "选择氛围或直接输入咖啡厅名称以生成 AI 行程。",
  cafe_placeholder: "直接输入咖啡厅名（例如：圣水 Tongue Planet）",
  cafe_generate: "生成 AI 行程",
  trending_items: "当下热门",
  my_recipe: "我的神仙搭配",
  convenience_q: "现在便利店最难买到什么？",
  trending_placeholder: "例如：延世牛奶奶油面包",
  recipe_q: "想尝试哪种口味组合？",
  extra_keywords: "额外关键词",
  recipe_placeholder: "例如：辣味挑战、甜咸甜点",
  recipe_generate: "生成 AI 搭配食谱",
  set_date_and_generate: "设置日期后\n生成行程",
  start_generate: "✨ 开始生成行程",
  making_schedule: "AI 正在创建<b>{{title}}</b>行程…",
  recommended_schedule_title: "{{title}} — 推荐行程",
  save_plan: "💾 保存行程",
  total_cost: "预计总费用",
  cost_per_day: "第{{day}}天 {{total}}",
  no_schedule: "未能生成行程，请重试。",
  saved_goto_schedule: "已保存 · 前往日程",
  find_nearby_store: "查找附近有售的地点",
  recipe_hashtags: "#便利店达人 #便利店挑战 #AI食谱",
  description_fallback: "在 {{place}} 值得打卡的推荐地点。",
  challenge_location: "挑战地点",
  challenge_location_desc: "AI 精选挑战点（100 公里内）— 圣水首尔森林前长椅区",
  subtotal: "小计 {{total}}",
  schedule_item_default: "行程",
  schedule_load_fail: "加载行程失败。",
  save_fail: "保存失败。",
  cafe_place_hint: "咖啡厅/地点提示",
  convenience_trending: "便利店热门单品",
  recipe_title_with_vibe: "{{vibe}} 挑战 2026 版",
  recipe_title_default: "马克定食 2026 版",
  "region_tab.all": "全部",
  "region_tab.seoul": "首尔",
  "region_tab.gangwon": "江原",
  "region_tab.jeonla": "全罗",
  "region_tab.gyeongsang": "庆尚",
  "region_tab.jeju": "济州",
  "cafe_vibe.industrial_raw.label": "工业/粗犷",
  "cafe_vibe.industrial_raw.description": "水泥与金属的酷感空间。",
  "cafe_vibe.traditional_zen.label": "传统/禅意",
  "cafe_vibe.traditional_zen.description": "韩屋与木色带来的安静时光。",
  "cafe_vibe.nature_botanical.label": "自然/植物",
  "cafe_vibe.nature_botanical.description": "绿意与阳光充盈的空间。",
  "cafe_vibe.retro_newtro.label": "复古/Newtro",
  "cafe_vibe.retro_newtro.description": "怀旧与小巷复古漫步。",
  "cafe_vibe.modern_minimal.label": "现代/极简",
  "cafe_vibe.modern_minimal.description": "克制的单色美学。",
  "brand.seveneleven": "7-Eleven",
  "brand.emart24": "emart24",
  "recipe_vibe.spicy_fire.label": "火辣挑战",
  "recipe_vibe.spicy_fire.description": "用辣味释放压力。",
  "recipe_vibe.sweet_salty.label": "甜咸经典",
  "recipe_vibe.sweet_salty.description": "甜与咸的平衡。",
  "recipe_vibe.diet_healthy.label": "便利店轻食",
  "recipe_vibe.diet_healthy.description": "轻盈又有饱腹感的健康组合。",
  "recipe_vibe.night_snack.label": "宵夜",
  "recipe_vibe.night_snack.description": "治愈系宵夜食谱。",
  "recipe_vibe.hangover.label": "解酒组合",
  "recipe_vibe.hangover.description": "专为宿醉舒缓设计。",
  "recipe_vibe.luxury_meal.label": "高性价比豪华餐",
  "recipe_vibe.luxury_meal.description": "便利店里的进阶美味。",
  "shopping.ramen": "杯面",
  "shopping.tuna_kimbap": "金枪鱼蛋黄酱三角饭团",
  "shopping.string_cheese": "手撕奶酪条",
  "shopping.sparkling_water": "气泡水",
  "cooking.1": "备好食材放入可微波容器。",
  "cooking.2": "混合酱料/配料微波 1 分 30 秒。",
  "cooking.3": "按喜好加配料并拍照打卡。",
  "trending_card.1.title": "延世牛奶奶油面包",
  "trending_card.2.title": "零度可乐冰杯嗨棒",
  "trending_card.default_title": "AI 推荐热门单品",
  "trending_card.tag.new": "#新品",
  "trending_card.tag.soldout": "#断货预警",
  "trending_card.tag.review": "#好评爆棚",
  "trending_card.tag.repurchase": "#回购",
  "meta.kf_market.title_ko": "全国传统市场美食之旅",
  "meta.kf_cafe.title_ko": "K-甜品与咖啡厅氛围之旅",
  "meta.kf_convenience.title_ko": "K-便利店神仙搭配挑战",
  "meta.kf_market.tags": "传统市场, 美食, 本地风味",
  "meta.kf_cafe.tags": "咖啡厅, 甜品, 买手店, 氛围之旅",
  "meta.kf_convenience.tags": "便利店, 搭配, 达人, 挑战",
  "empty.pick_market": "请先选择市场再生成行程",
  "empty.pick_vibe_or_cafe": "请选择氛围或输入咖啡厅名",
  "empty.pick_tab_condition": "请选择标签条件后生成",
  "empty.pick_date": "请选择日期后生成行程",
  "empty.market_guide": "在左侧选择市场，点击【生成此市场美食行程】或顶部 ✨ 生成",
  "empty.cafe_guide": "在左侧选择氛围/咖啡厅名，点击【生成 AI 行程】",
  "empty.convenience_guide": "在顶部标签选择模式，输入关键词后生成",
  "empty.default_guide": "点击顶部 ✨ 生成行程按钮",
  shopping_list_title: "购物清单",
  cooking_steps_title: "制作步骤",
};

const ZH_MARKET = {
  SEOUL: {
    "0": { name: "广藏市场", description: "生拌牛肉与绿豆饼圣地。" },
    "1": { name: "望远市场", description: "深受 MZ 世代喜爱的潮流市场。" },
    "2": { name: "通仁市场", description: "可体验著名铜钱便当的市场。" },
  },
  GANGWON: {
    "0": { name: "宁越中央市场", description: "荞麦煎饼与冷面之乡。" },
    "1": { name: "束草观光水产市场", description: "炸鸡块与海鲜小吃的天堂。" },
  },
  JEONLA: {
    "0": { name: "全州南部市场", description: "血肠与豆芽汤的发源地。" },
    "1": { name: "光州1913松汀站市场", description: "充满复古 Newtro 氛围的市场。" },
  },
  GYEONGSANG: {
    "0": { name: "釜山国际市场", description: "电影回忆与拌凉粉。" },
    "1": { name: "大邱西门市场", description: "韩国三大市场之一的规模与味道。" },
  },
  JEJU: {
    "0": { name: "济州东门市场", description: "艾草糕、黑猪肉块等岛屿风味。" },
  },
};

const ZH_FALLBACK = {
  kfood: {
    KF_MARKET: {
      title: "全国传统市场美食之旅",
      description: "走遍韩国各地，感受温暖在地风味与烟火气。",
    },
    KF_CAFE: {
      title: "K-甜品与咖啡厅氛围之旅",
      description: "串联符合你口味的咖啡厅与精选小店。",
    },
    KF_CONVENIENCE: {
      title: "K-便利店神仙搭配挑战",
      description: "从断货新品到隐藏食谱，成为便利店达人！",
    },
  },
  kbeauty: {
    KBEAUTY_01: {
      title: "Olive Young 旗舰店",
      description: "一站式比较与购买护肤彩妆趋势。",
    },
    KBEAUTY_02: {
      title: "明洞美妆街",
      description: "快速打卡主街周边畅销好物。",
    },
    KBEAUTY_03: {
      title: "护肤体验店",
      description: "基于肌肤检测的定制护理与互动美妆项目。",
    },
  },
};

const KO_TOP = {
  title: "K-콘텐츠 플래너",
  subtitle: "K-Pop, 드라마, 음식, 뷰티로 한국을 탐험해보세요",
  hero_title: "K-콘텐츠 플래너",
  hero_subtitle: "K-Pop, 드라마, 음식, 뷰티로 한국을 탐험해보세요",
  hero_cta: "AI 루트 생성",
  back: "플래너로 돌아가기",
  row_kpop: "K-POP",
  row_kdrama: "K-드라마 / 영화",
  row_kfood: "K-푸드",
  row_kbeauty: "K-뷰티",
  sample_itinerary: "샘플 일정",
  search_bar: "검색",
  quick_selection: "빠른 선택",
  vibe_grid: "무드 선택",
  date: "날짜",
  generating: "생성 중…",
  generate: "✨ 일정 생성",
  ai_recommended: "AI 추천 일정",
  region_select: "지역 선택",
  traditional_market: "전통시장",
  market_generate: "이 시장 먹방 일정 생성하기",
  cafe_question: "당신의 오늘 하루는 어떤 감성인가요?",
  cafe_hint: "취향에 맞는 Vibe를 고르거나 카페 이름을 직접 입력해 AI 코스를 생성하세요.",
  cafe_placeholder: "직접 카페 이름을 입력해 보세요 (예: 성수 텅플래닛)",
  cafe_generate: "AI 일정 생성하기",
  trending_items: "요즘 유행템",
  my_recipe: "나만의 꿀조합",
  convenience_q: "지금 편의점에서 가장 구하기 힘든 건?",
  trending_placeholder: "예: 연세우유 크림빵",
  recipe_q: "어떤 맛의 조합에 도전해볼까요?",
  extra_keywords: "추가 키워드",
  recipe_placeholder: "예: 맵부심 챌린지, 단짠 디저트",
  recipe_generate: "AI 꿀조합 레시피 생성하기",
  set_date_and_generate: "날짜를 설정하고\n일정을 생성해주세요",
  start_generate: "✨ 일정 생성 시작",
  making_schedule: "AI가 <b>{{title}}</b> 일정을 만드는 중…",
  recommended_schedule_title: "{{title}} — 추천 일정",
  save_plan: "💾 저장하기",
  total_cost: "예상 총 경비",
  cost_per_day: "{{day}}일차 {{total}}",
  no_schedule: "생성된 일정이 없습니다. 다시 시도해 주세요.",
  saved_goto_schedule: "✅ 저장됨 · 일정관리 보기",
  find_nearby_store: "이거 파는 가까운 곳 찾기",
  recipe_hashtags: "#모디슈머 #편의점챌린지 #AI레시피",
  description_fallback: "{{place}}에서 즐기기 좋은 추천 장소입니다.",
  challenge_location: "챌린지 장소",
  challenge_location_desc: "AI 추천 챌린지 명당 (100km 이내) — 성수 서울숲 앞 벤치존",
  subtotal: "소계 {{total}}",
  schedule_item_default: "일정",
  schedule_load_fail: "일정을 불러오지 못했습니다.",
  save_fail: "저장에 실패했습니다.",
  cafe_place_hint: "카페·장소 힌트",
  convenience_trending: "편의점 유행템",
  recipe_title_with_vibe: "{{vibe}} 챌린지 2026 Ver.",
  recipe_title_default: "마크정식 2026 Ver.",
  "region_tab.all": "전체",
  "region_tab.seoul": "서울",
  "region_tab.gangwon": "강원",
  "region_tab.jeonla": "전라",
  "region_tab.gyeongsang": "경상",
  "region_tab.jeju": "제주",
  "cafe_vibe.industrial_raw.label": "인더스트리얼/러프",
  "cafe_vibe.industrial_raw.description": "콘크리트와 철의 힙한 분위기.",
  "cafe_vibe.traditional_zen.label": "전통/선",
  "cafe_vibe.traditional_zen.description": "한옥과 나무 질감의 고요한 휴식.",
  "cafe_vibe.nature_botanical.label": "자연/보태니컬",
  "cafe_vibe.nature_botanical.description": "초록과 햇살이 가득한 공간.",
  "cafe_vibe.retro_newtro.label": "레트로/뉴트로",
  "cafe_vibe.retro_newtro.description": "응답하라 감성과 빈티지 골목 투어.",
  "cafe_vibe.modern_minimal.label": "모던/미니멀",
  "cafe_vibe.modern_minimal.description": "세련된 모노톤과 현대적 미학.",
  "brand.seveneleven": "세븐일레븐",
  "brand.emart24": "이마트24",
  "recipe_vibe.spicy_fire.label": "불타는 매운맛",
  "recipe_vibe.spicy_fire.description": "스트레스를 날려버릴 매운 도전.",
  "recipe_vibe.sweet_salty.label": "단짠 클래식",
  "recipe_vibe.sweet_salty.description": "달콤함과 짭짤함의 밸런스.",
  "recipe_vibe.diet_healthy.label": "편의점 다이어트",
  "recipe_vibe.diet_healthy.description": "가볍지만 든든한 건강 조합.",
  "recipe_vibe.night_snack.label": "야식",
  "recipe_vibe.night_snack.description": "소소한 행복 야식 레시피.",
  "recipe_vibe.hangover.label": "해장 조합",
  "recipe_vibe.hangover.description": "숙취 케어에 특화된 조합.",
  "recipe_vibe.luxury_meal.label": "가성비 프리미엄 한 끼",
  "recipe_vibe.luxury_meal.description": "프리미엄 편의점 식사.",
  "shopping.ramen": "컵라면",
  "shopping.tuna_kimbap": "참치마요 삼각김밥",
  "shopping.string_cheese": "스트링 치즈",
  "shopping.sparkling_water": "탄산수",
  "cooking.1": "재료를 모두 준비하고 전자레인지 가능한 용기에 담기",
  "cooking.2": "소스/토핑을 섞어 1분 30초 조리하기",
  "cooking.3": "취향에 맞게 토핑 추가 후 인증샷 남기기",
  "trending_card.1.title": "연세우유 크림빵",
  "trending_card.2.title": "제로콜라 얼음컵 하이볼",
  "trending_card.default_title": "AI 추천 유행템",
  "trending_card.tag.new": "#신상",
  "trending_card.tag.soldout": "#품절주의",
  "trending_card.tag.review": "#리뷰폭발",
  "trending_card.tag.repurchase": "#재구매",
  "meta.kf_market.title_ko": "전국 전통시장 먹거리 탐방",
  "meta.kf_cafe.title_ko": "K-디저트 & 카페 감성 투어",
  "meta.kf_convenience.title_ko": "K-편의점 꿀조합 챌린지",
  "meta.kf_market.tags": "전통시장, 먹거리, 로컬푸드",
  "meta.kf_cafe.tags": "카페, 디저트, 편집샵, 감성투어",
  "meta.kf_convenience.tags": "편의점, 꿀조합, 모디슈머, 챌린지",
  "empty.pick_market": "시장을 선택한 뒤 일정을 생성하세요",
  "empty.pick_vibe_or_cafe": "감성(Vibe) 또는 카페 이름을 선택하세요",
  "empty.pick_tab_condition": "탭별 조건을 선택하고 생성하세요",
  "empty.pick_date": "날짜 선택 후 일정을 생성하세요",
  "empty.market_guide": "왼쪽에서 시장을 고르고 [이 시장 먹방 일정 생성하기] 또는 상단 ✨ 일정 생성을 눌러주세요",
  "empty.cafe_guide": "왼쪽에서 감성/카페명을 정하고 [AI 일정 생성하기]를 눌러주세요",
  "empty.convenience_guide": "상단 탭에서 모드를 고른 뒤 키워드를 입력해 생성하세요",
  "empty.default_guide": "상단의 ✨ 일정 생성 버튼을 눌러주세요",
  shopping_list_title: "쇼핑 리스트",
  cooking_steps_title: "조리 단계",
};

// Fix typo in KO_TOP
const KO_MARKET = {
  SEOUL: {
    "0": { name: "광장시장", description: "육회와 빈대떡의 성지." },
    "1": { name: "망원시장", description: "MZ세대가 사랑하는 트렌디 시장." },
    "2": { name: "통인시장", description: "유명 엽전 도시락 체험을 즐기는 곳." },
  },
  GANGWON: {
    "0": { name: "영월 중앙시장", description: "메밀전병과 올챙이국수의 고장." },
    "1": { name: "속초 관광수산시장", description: "닭강정과 해산물 길거리 음식의 낙원." },
  },
  JEONLA: {
    "0": { name: "전주 남부시장", description: "순대와 콩나물국밥의 본고장." },
    "1": { name: "광주 1913 송정역시장", description: "레트로 뉴트로 가득한 시장." },
  },
  GYEONGSANG: {
    "0": { name: "부산 국제시장", description: "영화 속 추억과 비빔당면." },
    "1": { name: "대구 서문시장", description: "한국 3대 시장의 규모와 맛." },
  },
  JEJU: {
    "0": { name: "제주 동문시장", description: "오메기떡과 흑돼지 강정 등 섬의 맛." },
  },
};

const KO_FALLBACK_REAL = {
  kfood: {
    KF_MARKET: {
      title: "전국 전통시장 먹거리 탐방",
      description: "한국 곳곳의 따뜻한 로컬 맛과 활기로 가득한 시장 정복 투어.",
    },
    KF_CAFE: {
      title: "K-디저트 & 카페 감성 투어",
      description: "취향에 맞는 카페와 편집샵을 잇는 감성 루트.",
    },
    KF_CONVENIENCE: {
      title: "K-편의점 꿀조합 챌린지",
      description: "품절 신상부터 비밀 레시피까지, 진짜 편의점 모디슈머가 되어보세요!",
    },
  },
  kbeauty: {
    KBEAUTY_01: {
      title: "올리브영 플래그십",
      description: "스킨케어·메이크업 트렌드를 한곳에서 비교·쇼핑.",
    },
    KBEAUTY_02: {
      title: "명동 뷰티 거리",
      description: "메이저 로드샵 주변 베스트셀러를 빠르게 둘러보기.",
    },
    KBEAUTY_03: {
      title: "스킨케어 체험샵",
      description: "피부 진단 기반 맞춤 케어와 체험형 뷰티 프로그램.",
    },
  },
};

function writeK(lang, top, market, fallback) {
  const k = buildKcontent(en, top, market, fallback);
  fs.writeFileSync(path.join(outDir, `${lang}-kcontent.json`), JSON.stringify(k, null, 2) + "\n");
  console.log("wrote", lang + "-kcontent.json");
}

writeK("zh", ZH_TOP, ZH_MARKET, ZH_FALLBACK);
writeK("ko", KO_TOP, KO_MARKET, KO_FALLBACK_REAL);
