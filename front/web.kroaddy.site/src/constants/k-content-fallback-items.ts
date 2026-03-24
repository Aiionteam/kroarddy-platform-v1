import type { ContentRowItem } from "@/components/k-content/ContentRow";

/**
 * API(`/api/v1/k-content/packages`)가 비어 있거나 실패할 때 목록 행을 유지하기 위한 폴백.
 * package_id·이미지 경로는 백엔드 시드 및 `public/k_content/*` 구조와 맞춤.
 */
export const K_CONTENT_KPOP_FALLBACK_ITEMS: ContentRowItem[] = [
  {
    id: "KPOP_01",
    title: "BTS: 영원한 화양연화",
    description: "BTS, ARMY, Gangnam, HYBE",
    imageUrl: "/k_content/k-pop/p01/bts.jpg",
    placeholderGradient: "from-rose-500 to-pink-600",
  },
  {
    id: "KPOP_02",
    title: "블랙핑크: 힙&럭셔리",
    description: "BLACKPINK, YG, Luxury, Trend",
    imageUrl: "/k_content/k-pop/p02/blackpink.png",
    placeholderGradient: "from-violet-500 to-purple-600",
  },
  {
    id: "KPOP_03",
    title: "세븐틴&스키즈: 퍼포먼스 에너지",
    description: "SEVENTEEN, Stray Kids, JYP, Performance",
    imageUrl: "/k_content/k-pop/p03/straykids.jpg",
    placeholderGradient: "from-fuchsia-500 to-rose-600",
  },
  {
    id: "KPOP_04",
    title: "뉴진스&아이브: 하이틴 서울",
    description: "NewJeans, IVE, Y2K, Seongsu, Hannam",
    imageUrl: "/k_content/k-pop/p04/ive.jpg",
    placeholderGradient: "from-indigo-500 to-violet-600",
  },
  {
    id: "KPOP_05",
    title: "SM: 광야 익스프레스",
    description: "SM, aespa, NCT, Kwangya, Seongsu",
    imageUrl: "/k_content/k-pop/p05/aespa.jpg",
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "KPOP_06",
    title: "아이돌 직접 체험하기",
    description: "Experience, Dance, Recording, Idol-life",
    imageUrl: "/k_content/k-pop/p06/1million.jpg",
    placeholderGradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "KPOP_07",
    title: "홍대: 팬덤 문화의 중심",
    description: "Hongdae, Busking, Album, Fans",
    imageUrl: "/k_content/k-pop/p07/withmuu.jpg",
    placeholderGradient: "from-sky-500 to-blue-600",
  },
  {
    id: "KPOP_08",
    title: "K-OST & 감성 힐링 서울",
    description: "IU, OST, Healing, Retro, Seoul",
    imageUrl: "/k_content/k-pop/p08/recordbar.jpg",
    placeholderGradient: "from-amber-600 to-rose-600",
  },
];

/** DB id 9..20 → package_id KD_01..KD_12 (schemas.py 규칙) */
export const K_CONTENT_KDRAMA_FALLBACK_ITEMS: ContentRowItem[] = [
  {
    id: "KD_01",
    title: "도깨비",
    description: "Goblin · #GongYoo #Fantasy #Romance",
    imageUrl: "/k_content/k-drama/d01/1.jpg",
    placeholderGradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "KD_02",
    title: "오징어 게임",
    description: "Squid Game · #Netflix #Survival #Thriller",
    imageUrl: "/k_content/k-drama/d02/1.jpg",
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "KD_03",
    title: "사랑의 불시착",
    description: "Crash Landing on You · #HyunBin #SonYeJin #Romance",
    imageUrl: "/k_content/k-drama/d03/1.jpg",
    placeholderGradient: "from-sky-500 to-blue-600",
  },
  {
    id: "KD_04",
    title: "킹덤",
    description: "Kingdom · #Zombies #Historical #Horror",
    imageUrl: "/k_content/k-drama/d04/1.jpg",
    placeholderGradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "KD_05",
    title: "기생충",
    description: "Parasite · #Oscar #BongJoonHo #SocialIssues",
    imageUrl: "/k_content/k-drama/d05/1.jpg",
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "KD_06",
    title: "선재 업고 튀어",
    description: "Lovely Runner · #ByeonWooSeok #TimeSlip #Youth",
    imageUrl: "/k_content/k-drama/d06/1.jpg",
    placeholderGradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "KD_07",
    title: "호텔 델루나",
    description: "Hotel Del Luna · #IU #Fantasy #Mystery",
    imageUrl: "/k_content/k-drama/d07/1.jpg",
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "KD_08",
    title: "킹더랜드",
    description: "King the Land · #JunHo #Yoona #Luxury",
    imageUrl: "/k_content/k-drama/d08/1.jpg",
    placeholderGradient: "from-sky-500 to-blue-600",
  },
  {
    id: "KD_09",
    title: "미스터 션샤인",
    description: "Mr. Sunshine · #History #LeeByungHun #KimTaeri",
    imageUrl: "/k_content/k-drama/d09/1.jpg",
    placeholderGradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "KD_10",
    title: "태양의 후예",
    description: "Descendants of the Sun · #SongJoongKi #SongHyeKyo #Military",
    imageUrl: "/k_content/k-drama/d10/1.jpg",
    placeholderGradient: "from-amber-500 to-orange-600",
  },
  {
    id: "KD_11",
    title: "눈물의 여왕",
    description: "Queen of Tears · #KimSooHyun #KimJiWon #Chaebol",
    imageUrl: "/k_content/k-drama/d11/1.jpg",
    placeholderGradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "KD_12",
    title: "왕과 사는 남자",
    description: "The Man Who Lives with the King · #GangDongWon #YooHaeJin #History",
    imageUrl: "/k_content/k-drama/d12/1.jpg",
    placeholderGradient: "from-fuchsia-500 to-pink-600",
  },
];
