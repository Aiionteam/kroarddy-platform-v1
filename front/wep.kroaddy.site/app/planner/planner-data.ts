/** 여행지 계층 데이터 – 특별시·광역시 / 권역별 아코디언 */

export interface Destination {
  name: string;
  slug: string;
  emoji?: string;
  highlights?: string[];
  popular?: boolean;
}

export interface SubSection {
  title: string;
  destinations: Destination[];
}

export interface RegionGroup {
  id: string;
  label: string;
  subLabel: string;
  accent: string;      // Tailwind 색상 조합 (border + text + bg 원)
  headerBg: string;   // 헤더 배경
  subSections: SubSection[];
}

// ── 특별시 · 광역시 바로가기 ──────────────────────────────────
export const METRO_CITIES: Destination[] = [
  { name: "서울",  slug: "seoul",   emoji: "🏙️", highlights: ["경복궁", "홍대", "한강공원"],       popular: true },
  { name: "부산",  slug: "busan",   emoji: "🌊", highlights: ["해운대", "감천마을", "자갈치시장"],  popular: true },
  { name: "대구",  slug: "daegu",   emoji: "🌹", highlights: ["동성로", "김광석거리", "수성못"],    popular: true },
  { name: "인천",  slug: "incheon", emoji: "✈️", highlights: ["송도", "강화도", "차이나타운"],      popular: true },
  { name: "광주",  slug: "gwangju", emoji: "🎨", highlights: ["국립아시아문화전당", "양림동"],      popular: true },
  { name: "대전",  slug: "daejeon", emoji: "🍞", highlights: ["성심당", "엑스포공원", "유성온천"],  popular: true },
  { name: "울산",  slug: "ulsan",   emoji: "🐋", highlights: ["간절곶", "대왕암", "태화강"]                     },
  { name: "세종",  slug: "sejong",  emoji: "🌿", highlights: ["세종호수공원", "국립수목원"]                      },
];

// ── 권역별 그룹 (아코디언) ────────────────────────────────────
export const REGION_GROUPS: RegionGroup[] = [
  // ─ 서울 ───────────────────────────────────────────────────
  {
    id: "seoul-areas",
    label: "서울",
    subLabel: "권역별 대표 지역",
    accent: "border-violet-300 text-violet-700 bg-violet-50",
    headerBg: "bg-violet-50 hover:bg-violet-100",
    subSections: [
      {
        title: "도심·역사",
        destinations: [
          { name: "종로·광화문", slug: "jongno",     emoji: "🏛️", highlights: ["경복궁", "청와대", "인사동"],      popular: true },
          { name: "명동·을지로", slug: "myeongdong",  emoji: "🛍️", highlights: ["명동성당", "을지로골목"],          popular: true },
          { name: "용산·이태원", slug: "yongsan",     emoji: "🌍", highlights: ["국립중앙박물관", "이태원"],         popular: true },
        ],
      },
      {
        title: "강남·동부",
        destinations: [
          { name: "강남·서초",   slug: "gangnam",    emoji: "💼", highlights: ["코엑스", "압구정로데오", "도산공원"],  popular: true },
          { name: "잠실·송파",   slug: "jamsil",     emoji: "🎡", highlights: ["롯데월드", "올림픽공원", "석촌호수"], popular: true },
          { name: "성수·한남",   slug: "seongsu",    emoji: "☕", highlights: ["성수카페거리", "한남동 갤러리"],      popular: true },
        ],
      },
      {
        title: "서부·북부",
        destinations: [
          { name: "홍대·마포",   slug: "hongdae",    emoji: "🎸", highlights: ["홍대클럽", "연남동", "경의선숲길"],  popular: true },
          { name: "북촌·삼청",   slug: "bukchon",    emoji: "🏮", highlights: ["북촌한옥마을", "삼청동카페"],         popular: true },
          { name: "노원·도봉",   slug: "nowon",      emoji: "⛰️", highlights: ["수락산", "도봉산", "불암산"]                       },
        ],
      },
    ],
  },

  // ─ 경기 북부 ──────────────────────────────────────────────
  {
    id: "gyeonggi-north",
    label: "경기 북부",
    subLabel: "고양·파주·의정부·남양주 등",
    accent: "border-indigo-300 text-indigo-700 bg-indigo-50",
    headerBg: "bg-indigo-50 hover:bg-indigo-100",
    subSections: [
      {
        title: "서북부",
        destinations: [
          { name: "고양",    slug: "goyang",      emoji: "🌸", highlights: ["킨텍스", "서오릉", "행주산성"]                 },
          { name: "파주",    slug: "paju",        emoji: "📚", highlights: ["헤이리마을", "출판단지", "임진각"],   popular: true },
          { name: "김포",    slug: "gimpo",       emoji: "🌾", highlights: ["애기봉평화생태공원", "아라뱃길"]               },
        ],
      },
      {
        title: "동북부",
        destinations: [
          { name: "의정부",  slug: "uijeongbu",   emoji: "🍖", highlights: ["부대찌개거리", "회룡사"]                       },
          { name: "남양주",  slug: "namyangju",   emoji: "🌿", highlights: ["두물머리", "다산길"],              popular: true },
          { name: "구리",    slug: "guri",        emoji: "🌸", highlights: ["한강시민공원", "아차산"]                        },
          { name: "가평",    slug: "gapyeong",    emoji: "🚣", highlights: ["남이섬", "자라섬", "청평"],         popular: true },
          { name: "양평",    slug: "yangpyeong",  emoji: "☕", highlights: ["두물머리", "카페거리", "용문산"],   popular: true },
          { name: "포천",    slug: "pocheon",     emoji: "🌳", highlights: ["산정호수", "허브아일랜드"],         popular: true },
          { name: "양주",    slug: "yangju",      emoji: "🌻", highlights: ["나리공원", "송암스페이스센터"]                  },
          { name: "동두천",  slug: "dongducheon", emoji: "🎶", highlights: ["소요산", "자유시장"]                            },
        ],
      },
    ],
  },

  // ─ 경기 남부 ──────────────────────────────────────────────
  {
    id: "gyeonggi-south",
    label: "경기 남부",
    subLabel: "수원·용인·성남·평택 등",
    accent: "border-blue-300 text-blue-700 bg-blue-50",
    headerBg: "bg-blue-50 hover:bg-blue-100",
    subSections: [
      {
        title: "서남부",
        destinations: [
          { name: "수원",    slug: "suwon",       emoji: "🏯", highlights: ["화성행궁", "행리단길"],              popular: true },
          { name: "화성",    slug: "hwaseong",    emoji: "🌅", highlights: ["궁평항", "제부도"]                               },
          { name: "안산",    slug: "ansan",       emoji: "🎨", highlights: ["대부도", "시화호"]                               },
          { name: "시흥",    slug: "siheung",     emoji: "🦢", highlights: ["갯골생태공원", "오이도"]                         },
          { name: "안양",    slug: "anyang",      emoji: "⛰️", highlights: ["삼성산", "평촌"]                                },
          { name: "군포",    slug: "gunpo",       emoji: "🌲", highlights: ["수리산", "산본"]                                },
          { name: "평택",    slug: "pyeongtaek",  emoji: "🚢", highlights: ["평택항", "소사벌"]                              },
        ],
      },
      {
        title: "동남부",
        destinations: [
          { name: "용인",    slug: "yongin",      emoji: "🎡", highlights: ["에버랜드", "한국민속촌"],            popular: true },
          { name: "성남",    slug: "seongnam",    emoji: "🏢", highlights: ["판교테크노밸리", "분당중앙공원"]                 },
          { name: "하남",    slug: "hanam",       emoji: "🛍️", highlights: ["스타필드하남", "팔당호"]                         },
          { name: "이천",    slug: "icheon",      emoji: "🍚", highlights: ["도자기마을", "이천쌀밥"],            popular: true },
          { name: "여주",    slug: "yeoju",       emoji: "👑", highlights: ["세종대왕릉", "신륵사"]                           },
          { name: "안성",    slug: "anseong",     emoji: "🎭", highlights: ["안성맞춤랜드", "미리내성지"]                     },
          { name: "오산",    slug: "osan",        emoji: "🏛️", highlights: ["독산성", "물향기수목원"]                         },
          { name: "의왕",    slug: "uiwang",      emoji: "🚂", highlights: ["왕송호수", "철도박물관"]                         },
          { name: "과천",    slug: "gwacheon",    emoji: "🦁", highlights: ["서울대공원", "과천경마공원"]                      },
        ],
      },
      {
        title: "서부",
        destinations: [
          { name: "부천",    slug: "bucheon",     emoji: "🎬", highlights: ["부천판타스틱스튜디오", "부천수목원"]              },
          { name: "광명",    slug: "gwangmyeong", emoji: "🌊", highlights: ["광명동굴", "광명 KTX"]                           },
        ],
      },
    ],
  },

  // ─ 강원권 ─────────────────────────────────────────────────
  {
    id: "gangwon",
    label: "강원도",
    subLabel: "강원특별자치도",
    accent: "border-emerald-300 text-emerald-700 bg-emerald-50",
    headerBg: "bg-emerald-50 hover:bg-emerald-100",
    subSections: [
      {
        title: "영서 (내륙)",
        destinations: [
          { name: "춘천",   slug: "chuncheon",   emoji: "🍗", highlights: ["남이섬", "닭갈비골목", "소양강"],    popular: true },
          { name: "원주",   slug: "wonju",       emoji: "🎨", highlights: ["뮤지엄산", "소금산출렁다리"],        popular: true },
          { name: "평창",   slug: "pyeongchang", emoji: "🐑", highlights: ["대관령양떼목장", "오대산"],          popular: true },
          { name: "정선",   slug: "jeongseon",   emoji: "⛰️", highlights: ["민둥산", "아우라지", "레일바이크"]               },
          { name: "인제",   slug: "inje",        emoji: "🦌", highlights: ["내린천", "자작나무숲"]                           },
          { name: "태백",   slug: "taebaek",     emoji: "⛏️", highlights: ["태백산", "용연동굴"]                             },
        ],
      },
      {
        title: "영동 (동해안)",
        destinations: [
          { name: "강릉",   slug: "gangneung",   emoji: "☕", highlights: ["경포대", "안목커피거리", "오죽헌"],  popular: true },
          { name: "속초",   slug: "sokcho",      emoji: "🏔️", highlights: ["설악산", "중앙시장", "영금정"],     popular: true },
          { name: "양양",   slug: "yangyang",    emoji: "🏄", highlights: ["서피비치", "낙산사", "죽도"],        popular: true },
          { name: "동해",   slug: "donghae",     emoji: "🌊", highlights: ["망상해변", "추암촛대바위"]                       },
          { name: "삼척",   slug: "samcheok",    emoji: "🐉", highlights: ["해신당공원", "죽서루", "환선굴"]                 },
          { name: "고성",   slug: "goseong-gw",  emoji: "🏰", highlights: ["DMZ박물관", "화진포", "통일전망대"]              },
        ],
      },
    ],
  },

  // ─ 충청북도 ─────────────────────────────────────────────────
  {
    id: "chungbuk",
    label: "충청북도",
    subLabel: "청주·충주·제천·단양",
    accent: "border-amber-300 text-amber-700 bg-amber-50",
    headerBg: "bg-amber-50 hover:bg-amber-100",
    subSections: [
      {
        title: "북부·중부",
        destinations: [
          { name: "청주",   slug: "cheongju",  emoji: "📜", highlights: ["고인쇄박물관", "상당산성"]                        },
          { name: "충주",   slug: "chungju",   emoji: "🌊", highlights: ["충주호", "탄금대"]                               },
        ],
      },
      {
        title: "관광·자연",
        destinations: [
          { name: "제천",   slug: "jecheon",   emoji: "🌸", highlights: ["청풍호", "의림지", "비봉산"],          popular: true },
          { name: "단양",   slug: "danyang",   emoji: "🪂", highlights: ["단양팔경", "도담삼봉", "패러글라이딩"], popular: true },
        ],
      },
    ],
  },

  // ─ 충청남도 ─────────────────────────────────────────────────
  {
    id: "chungnam",
    label: "충청남도",
    subLabel: "공주·부여·보령·태안 등",
    accent: "border-yellow-300 text-yellow-700 bg-yellow-50",
    headerBg: "bg-yellow-50 hover:bg-yellow-100",
    subSections: [
      {
        title: "백제·내륙",
        destinations: [
          { name: "공주",   slug: "gongju",    emoji: "👑", highlights: ["공산성", "무령왕릉"],                  popular: true },
          { name: "부여",   slug: "buyeo",     emoji: "🏛️", highlights: ["부소산성", "낙화암", "백제문화단지"],  popular: true },
          { name: "아산",   slug: "asan",      emoji: "♨️", highlights: ["온양온천", "현충사"]                               },
          { name: "천안",   slug: "cheonan",   emoji: "🍓", highlights: ["독립기념관", "천안삼거리공원"]                       },
          { name: "논산",   slug: "nonsan",    emoji: "🍓", highlights: ["논산딸기", "관촉사"]                               },
        ],
      },
      {
        title: "서해안",
        destinations: [
          { name: "보령",   slug: "boryeong",  emoji: "🌊", highlights: ["머드축제", "대천해수욕장"],            popular: true },
          { name: "태안",   slug: "taean",     emoji: "🐚", highlights: ["안면도", "꽃지해수욕장"],              popular: true },
          { name: "서산",   slug: "seosan",    emoji: "🦢", highlights: ["서산마애삼존불", "간월암"]                          },
          { name: "당진",   slug: "dangjin",   emoji: "🌅", highlights: ["왜목마을", "신리성지"]                              },
        ],
      },
    ],
  },

  // ─ 전북특별자치도 ────────────────────────────────────────────
  {
    id: "jeonbuk",
    label: "전북",
    subLabel: "전북특별자치도",
    accent: "border-green-300 text-green-700 bg-green-50",
    headerBg: "bg-green-50 hover:bg-green-100",
    subSections: [
      {
        title: "대표 도시",
        destinations: [
          { name: "전주",   slug: "jeonju",   emoji: "🏮", highlights: ["한옥마을", "막걸리골목"],               popular: true },
          { name: "군산",   slug: "gunsan",   emoji: "🚢", highlights: ["근대문화유산거리", "이성당"],            popular: true },
          { name: "익산",   slug: "iksan",    emoji: "🏛️", highlights: ["미륵사지", "왕궁리유적"]                           },
        ],
      },
      {
        title: "내륙·자연",
        destinations: [
          { name: "정읍",   slug: "jeongeup", emoji: "🌸", highlights: ["내장산", "황토현"]                                 },
          { name: "남원",   slug: "namwon",   emoji: "💕", highlights: ["광한루원", "지리산"]                               },
          { name: "김제",   slug: "gimje",    emoji: "🌾", highlights: ["지평선축제", "벽골제"]                             },
        ],
      },
    ],
  },

  // ─ 전라남도 ─────────────────────────────────────────────────
  {
    id: "jeonnam",
    label: "전라남도",
    subLabel: "여수·순천·목포·담양 등",
    accent: "border-lime-300 text-lime-700 bg-lime-50",
    headerBg: "bg-lime-50 hover:bg-lime-100",
    subSections: [
      {
        title: "남해안",
        destinations: [
          { name: "여수",   slug: "yeosu",    emoji: "🦀", highlights: ["해상케이블카", "오동도", "밤바다"],     popular: true },
          { name: "순천",   slug: "suncheon", emoji: "🦢", highlights: ["순천만국가정원", "낙안읍성"],           popular: true },
          { name: "목포",   slug: "mokpo",    emoji: "🌉", highlights: ["해상케이블카", "유달산"],               popular: true },
          { name: "완도",   slug: "wando",    emoji: "🐟", highlights: ["청산도", "완도수목원"]                              },
        ],
      },
      {
        title: "내륙·힐링",
        destinations: [
          { name: "담양",   slug: "damyang",  emoji: "🎋", highlights: ["죽녹원", "메타세쿼이아길"],             popular: true },
          { name: "광양",   slug: "gwangyang",emoji: "🌸", highlights: ["매화마을", "백운산"]                                },
          { name: "보성",   slug: "boseong",  emoji: "🍵", highlights: ["녹차밭", "율포해수욕장"],               popular: true },
          { name: "나주",   slug: "naju",     emoji: "🍐", highlights: ["나주배", "영산강", "목관아"]                        },
        ],
      },
    ],
  },

  // ─ 부산광역시 ────────────────────────────────────────────────
  {
    id: "busan",
    label: "부산",
    subLabel: "부산광역시",
    accent: "border-blue-300 text-blue-700 bg-blue-50",
    headerBg: "bg-blue-50 hover:bg-blue-100",
    subSections: [
      {
        title: "해안·동부",
        destinations: [
          { name: "해운대",      slug: "haeundae",   emoji: "🏖️", highlights: ["해운대해수욕장", "동백섬", "달맞이길"],  popular: true },
          { name: "광안리·수영", slug: "gwangalli",  emoji: "🌉", highlights: ["광안대교", "광안리해수욕장"],             popular: true },
          { name: "기장",        slug: "gijang",     emoji: "🦀", highlights: ["죽성드림성당", "대변항", "아쿠아리움"],   popular: true },
          { name: "송정·청사포", slug: "songjeong",  emoji: "🌊", highlights: ["송정해수욕장", "청사포 다릿돌전망대"]               },
        ],
      },
      {
        title: "도심·구도심",
        destinations: [
          { name: "남포·중구",   slug: "nampo",      emoji: "🎬", highlights: ["자갈치시장", "BIFF광장", "보수동책방골목"], popular: true },
          { name: "서면·부전",   slug: "seomyeon",   emoji: "🛍️", highlights: ["서면거리", "쥬디스태화", "부전시장"]               },
          { name: "감천문화마을",slug: "gamcheon",   emoji: "🏘️", highlights: ["감천문화마을", "하늘마루"],               popular: true },
          { name: "영도",        slug: "yeongdo",    emoji: "⚓", highlights: ["태종대", "흰여울문화마을", "봉래산"]               },
        ],
      },
      {
        title: "북부·서부",
        destinations: [
          { name: "금정·온천장", slug: "geumjeong",  emoji: "♨️", highlights: ["금정산성", "범어사", "온천장"]                     },
          { name: "강서·가덕도", slug: "gangseo-bs", emoji: "🌅", highlights: ["을숙도", "가덕도 대항새바지"]                       },
          { name: "사하·다대포", slug: "dadaepo",    emoji: "🌅", highlights: ["다대포해수욕장", "낙동강 하구"]                      },
        ],
      },
    ],
  },

  // ─ 대구광역시 ────────────────────────────────────────────────
  {
    id: "daegu",
    label: "대구",
    subLabel: "대구광역시",
    accent: "border-rose-300 text-rose-700 bg-rose-50",
    headerBg: "bg-rose-50 hover:bg-rose-100",
    subSections: [
      {
        title: "도심",
        destinations: [
          { name: "동성로·중구",  slug: "dongseongno", emoji: "🛍️", highlights: ["동성로", "서문시장", "약령시"],      popular: true },
          { name: "김광석거리",   slug: "gimgwangseok", emoji: "🎵", highlights: ["김광석거리", "방천시장"],            popular: true },
          { name: "수성못·범어",  slug: "suseongmot",  emoji: "🦢", highlights: ["수성못", "수성유원지"],              popular: true },
        ],
      },
      {
        title: "외곽·자연",
        destinations: [
          { name: "팔공산",       slug: "palgongsan",  emoji: "⛰️", highlights: ["동화사", "갓바위", "팔공스카이라인"], popular: true },
          { name: "비슬산·달성",  slug: "dalseong",    emoji: "🌸", highlights: ["비슬산 참꽃", "달성습지"],            popular: true },
          { name: "군위",         slug: "gunwi",       emoji: "🏛️", highlights: ["삼국유사테마파크", "화산산성"]                   },
        ],
      },
    ],
  },

  // ─ 울산광역시 ────────────────────────────────────────────────
  {
    id: "ulsan",
    label: "울산",
    subLabel: "울산광역시",
    accent: "border-teal-300 text-teal-700 bg-teal-50",
    headerBg: "bg-teal-50 hover:bg-teal-100",
    subSections: [
      {
        title: "울산",
        destinations: [
          { name: "간절곶",      slug: "ganjeolgot",  emoji: "🌅", highlights: ["간절곶등대", "새해 일출"],             popular: true },
          { name: "대왕암",      slug: "daewangam",   emoji: "🐉", highlights: ["대왕암공원", "일산해수욕장"],          popular: true },
          { name: "태화강",      slug: "taehwagang",  emoji: "🐦", highlights: ["태화강국가정원", "십리대숲"]                       },
          { name: "반구대",      slug: "bangudae",    emoji: "🦣", highlights: ["반구대 암각화", "집청정"]                          },
        ],
      },
    ],
  },

  // ─ 경상북도 ───────────────────────────────────────────────────
  {
    id: "gyeongbuk",
    label: "경상북도",
    subLabel: "경주·포항·안동 등",
    accent: "border-orange-300 text-orange-700 bg-orange-50",
    headerBg: "bg-orange-50 hover:bg-orange-100",
    subSections: [
      {
        title: "역사·문화",
        destinations: [
          { name: "경주",   slug: "gyeongju",   emoji: "🌸", highlights: ["황리단길", "첨성대", "불국사"],      popular: true },
          { name: "안동",   slug: "andong",     emoji: "🎭", highlights: ["하회마을", "도산서원"],              popular: true },
          { name: "영주",   slug: "yeongju",    emoji: "🍎", highlights: ["부석사", "소수서원", "선비세상"]                  },
          { name: "문경",   slug: "mungyeong",  emoji: "⛩️", highlights: ["문경새재", "가은오픈세트장"],        popular: true },
        ],
      },
      {
        title: "동해안",
        destinations: [
          { name: "포항",   slug: "pohang",     emoji: "🌅", highlights: ["호미곶", "스페이스워크"],            popular: true },
          { name: "영덕",   slug: "yeongdeok",  emoji: "🦀", highlights: ["대게거리", "해파랑길"]                          },
          { name: "울진",   slug: "uljin",      emoji: "🌊", highlights: ["불영계곡", "성류굴", "후포항"]                  },
          { name: "독도",   slug: "dokdo",      emoji: "🏝️", highlights: ["독도", "울릉도"],                    popular: true },
        ],
      },
      {
        title: "내륙",
        destinations: [
          { name: "구미",   slug: "gumi",       emoji: "🏭", highlights: ["금오산", "박정희역사자료관"]                   },
          { name: "김천",   slug: "gimcheon",   emoji: "🍑", highlights: ["직지사", "황악산"]                           },
          { name: "영천",   slug: "yeongcheon", emoji: "🍇", highlights: ["영천와인", "보현산천문과학관"]                 },
          { name: "상주",   slug: "sangju",     emoji: "🚴", highlights: ["상주자전거박물관", "경천섬"]                   },
          { name: "경산",   slug: "gyeongsan",  emoji: "🌿", highlights: ["반곡지", "갓바위"]                           },
        ],
      },
    ],
  },

  // ─ 경상남도 ───────────────────────────────────────────────────
  {
    id: "gyeongnam",
    label: "경상남도",
    subLabel: "통영·거제·진주·창원 등",
    accent: "border-pink-300 text-pink-700 bg-pink-50",
    headerBg: "bg-pink-50 hover:bg-pink-100",
    subSections: [
      {
        title: "남해안·섬",
        destinations: [
          { name: "통영",   slug: "tongyeong",  emoji: "⛵", highlights: ["루지", "동피랑마을", "다도해"],      popular: true },
          { name: "거제",   slug: "geoje",      emoji: "🌬️", highlights: ["바람의언덕", "외도", "해금강"],     popular: true },
          { name: "남해",   slug: "namhae",     emoji: "🇩🇪", highlights: ["독일마을", "다랭이마을"],           popular: true },
          { name: "고성",   slug: "goseong-gn", emoji: "🦕", highlights: ["공룡엑스포", "상족암"]                         },
        ],
      },
      {
        title: "내륙",
        destinations: [
          { name: "진주",   slug: "jinju",      emoji: "🪔", highlights: ["유등축제", "진주성"],               popular: true },
          { name: "창원",   slug: "changwon",   emoji: "🌸", highlights: ["마산어시장", "진해군항제"]                      },
          { name: "합천",   slug: "hapcheon",   emoji: "🌸", highlights: ["해인사", "황매산"]                             },
          { name: "밀양",   slug: "miryang",    emoji: "🌿", highlights: ["얼음골", "표충사", "영남루"]                   },
          { name: "함양",   slug: "hamyang",    emoji: "🌲", highlights: ["지리산", "상림공원"]                           },
          { name: "산청",   slug: "sancheong",  emoji: "🌿", highlights: ["지리산", "동의보감촌"]                         },
          { name: "하동",   slug: "hadong",     emoji: "🍵", highlights: ["화개장터", "최참판댁", "쌍계사"],   popular: true },
        ],
      },
      {
        title: "동부",
        destinations: [
          { name: "김해",   slug: "gimhae",     emoji: "👑", highlights: ["가야테마파크", "수로왕릉"]                     },
          { name: "양산",   slug: "yangsan",    emoji: "🏔️", highlights: ["통도사", "오봉산"]                           },
          { name: "창녕",   slug: "changnyeong",emoji: "🦩", highlights: ["우포늪", "화왕산"]                            },
          { name: "의령",   slug: "uiryeong",   emoji: "🌸", highlights: ["솥바위", "의병박물관"]                         },
        ],
      },
    ],
  },

  // ─ 제주권 ─────────────────────────────────────────────────
  {
    id: "jeju",
    label: "제주도",
    subLabel: "제주특별자치도",
    accent: "border-cyan-300 text-cyan-700 bg-cyan-50",
    headerBg: "bg-cyan-50 hover:bg-cyan-100",
    subSections: [
      {
        title: "제주도",
        destinations: [
          { name: "제주",   slug: "jeju",     emoji: "🌺", highlights: ["한라산", "성산일출봉", "협재해변"],  popular: true },
          { name: "서귀포", slug: "seogwipo", emoji: "🌊", highlights: ["천지연폭포", "올레길", "중문해변"], popular: true },
        ],
      },
    ],
  },
];

/** 광역시/특별시처럼 바로 찾는 수요가 큰 도시 상세 그룹 */
export const METRO_REGION_GROUP_IDS = [
  "seoul-areas",
  "busan",
  "daegu",
  "ulsan",
] as const;

/** 도 단위로 탐색하는 지역 그룹 */
export const PROVINCE_REGION_GROUP_IDS = REGION_GROUPS
  .map((group) => group.id)
  .filter((id) => !METRO_REGION_GROUP_IDS.includes(id as (typeof METRO_REGION_GROUP_IDS)[number]));

// ── 파생 데이터 ────────────────────────────────────────────────
export const ALL_DESTINATIONS: Destination[] = [
  ...METRO_CITIES,
  ...REGION_GROUPS.flatMap((g) => g.subSections.flatMap((s) => s.destinations)),
];

/** slug → 한글 지명 */
export const SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
  ALL_DESTINATIONS.map((d) => [d.slug, d.name])
);

/** 한글 지명 → slug */
export const DESTINATION_SLUG: Record<string, string> = Object.fromEntries(
  ALL_DESTINATIONS.map((d) => [d.name, d.slug])
);
