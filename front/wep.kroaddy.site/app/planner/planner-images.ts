// slug → 대표 이미지 경로 (public/image 실제 파일명 기반)
const IMAGE_MAP: Record<string, string> = {
  // ── 충청 ─────────────────────────────────────────────────────
  "asan":        "/image/chungcheong/asan/Type1_아산 성웅이순신축제_한국관광공사 김지호_V0TOEa.jpg",
  "boryeong":    "/image/chungcheong/boryeong/Type1_머드축제_정성주_Ef8yLa.jpg",
  "buyeo":       "/image/chungcheong/buyeo/Type1_서동공원과 궁남지_한국관광공사 김지호_Dek5ca.jpg",
  "cheonan":     "/image/chungcheong/cheonan/Type1_독립기념관_IR 스튜디오_JFYFBa.jpg",
  "cheongju":    "/image/chungcheong/cheongju/Type1_청주수암골_한국관광공사 김지호_m337ga.jpg",
  "chungju":     "/image/chungcheong/chungju/Type1_아름다운 문화유산_고대성_34voBa.jpg",
  "dangjin":     "/image/chungcheong/dangjin/Type1_삽교호 함상공원_한국관광공사 이범수_ryqHUa.jpg",
  "danyang":     "/image/chungcheong/danyang/Type1_아름다운 비행_우제용_Rv9vOa.jpg",
  "gongju":      "/image/chungcheong/gongju/Type1_공산성_한국관광공사 김지호_Lt0qWa.jpg",
  "jecheon":     "/image/chungcheong/jecheon/Type1_제천 의림지와 제림_한국관광공사 송재근_5rs0ia.jpg",
  "nonsan":      "/image/chungcheong/nonsan/Type1_강경젓갈시장_한국관광공사 박은경_MhP6Ia.jpg",
  "seosan":      "/image/chungcheong/seosan/Type1_웅도의 바닷길_유충열_42t2Va.jpg",
  "taean":       "/image/chungcheong/taean/Type1_태안 세계튤립축제_한국관광공사 김지호_h3RWGa.jpg",

  // ── 강원 ─────────────────────────────────────────────────────
  "chuncheon":   "/image/gangwon/chuncheon/Type1_닭갈비_스튜디오 4cats_JcBAiU.jpg",
  "donghae":     "/image/gangwon/donghae/Type1_동해 바다열차_한국관광공사 이범수_CSXpPa.jpg",
  "gangneung":   "/image/gangwon/gangneung/Type1_경포 일출_한국관광공사 김지호_Nc9mFa.jpg",
  "goseong":     "/image/gangwon/goseong/Type1_송지호해수욕장_한국관광공사 이범수 _F7kK9a.jpg",
  "inje":        "/image/gangwon/inje/Type1_인제 빙어축제_한국관광공사 김지호_bbSc7a.jpg",
  "jeongseon":   "/image/gangwon/jeongseon/Type1_짚와이어_정선_마이픽쳐스_ERexBa.jpg",
  "pyeongchang": "/image/gangwon/pyeongchang/Type1_눈내리는대관령_김은도_uB2dHW.jpg",
  "samcheok":    "/image/gangwon/samcheok/Type1_여름의 찬가_김설자_Nvklna.jpg",
  "sokcho":      "/image/gangwon/sokcho/Type1_속초 관광수산시장_테마상품팀 IR 스튜디오_zxHyba.jpg",
  "taebaek":     "/image/gangwon/taebaek/Type1_태백산 국립공원_IR 스튜디오_Q0FNra.jpg",
  "wonju":       "/image/gangwon/wonju/Type1_소금산 그랜드밸리_한국관광공사 김지호_dM8UJb.jpg",
  "yangyang":    "/image/gangwon/yangyang/Type1_죽도해수욕장_강원지사 모먼트스튜디오_6sqmqa.jpg",

  // ── 경상 ─────────────────────────────────────────────────────
  "andong":      "/image/gyeongsang/andong/Type1_안동하회마을_오세근_pWkI2a.jpg",
  "changwon":    "/image/gyeongsang/changwon/Type1_2019 진해군항제_라이브스튜디오_Bvw8wa.jpg",
  "geoje":       "/image/gyeongsang/geoje/Type1_거제 바람의 언덕_BOKEH_UHVvDa.jpg",
  "gimcheon":    "/image/gyeongsang/gimcheon/Type1_직지사_한국관광공사 이범수_Gpevfa.jpg",
  "gimhae":      "/image/gyeongsang/gimhae/Type1_김해가야테마파크_한국관광공사 김지호_W0rH0T.jpg",
  "gumi":        "/image/gyeongsang/gumi/Type1_도리사 _한국관광공사 박성근_Gpa0oa.jpg",
  "gyeongju":    "/image/gyeongsang/gyeongju/Type1_경주의 봄_김호열_MYHE1U.jpg",
  "gyeongsan":   "/image/gyeongsang/gyeongsan/Type1_반곡지의 봄_최재영_e7tf0a.jpg",
  "hapcheon":    "/image/gyeongsang/hapcheon/Type1_한국의 은하수_윤은준_mGCGza.jpg",
  "jinju":       "/image/gyeongsang/jinju/Type1_진주남강유등축제_한국관광공사 김지호_dWThKa.jpg",
  "miryang":     "/image/gyeongsang/miryang/Type1_위양지의 아침_심재국_guBaVa.jpg",
  "mungyeong":   "/image/gyeongsang/mungyeong/Type1_문경새재도립공원_한국관광공사 김지호_riwBRa.jpg",
  "namhae":      "/image/gyeongsang/namhae/Type1_보리암 추경_노정후_TFZbtZ.jpg",
  "pohang":      "/image/gyeongsang/pohang/Type1_호미곶일출_한국관광공사 김지호_hYdjFa.jpg",
  "sangju":      "/image/gyeongsang/sangju/Type1_선병국가옥_한국관광공사 김지호_zuqlqa.jpg",
  "tongyeong":   "/image/gyeongsang/tongyeong/Type1_동피랑마을_한국관광공사 김지호_G54Msa.jpg",
  "yangsan":     "/image/gyeongsang/yangsan/Type1_양산 통도사_한국관광공사 김지호_MQ7kgt.jpg",
  "yeongcheon":  "/image/gyeongsang/yeongcheon/Type1_보현산댐 별빛 전망대_두드림_Q6etEA.jpg",
  "yeongju":     "/image/gyeongsang/yeongju/Type1_영주 무섬마을_앙지뉴 필름_vTpnWV.jpg",

  // ── 제주 ─────────────────────────────────────────────────────
  "jeju":        "/image/jejudo/jeju/Type1_The One Summer_이경재_ciTm3a.jpg",
  "seogwipo":    "/image/jejudo/seogwipo/Type1_성산봉의 여명_임성복_Nvklsa.jpg",

  // ── 전라 ─────────────────────────────────────────────────────
  "boseong":     "/image/jeolla/boseong/Type1_보성녹차밭_박아순_IlUkfa.jpg",
  "damyang":     "/image/jeolla/damyang/Type1_죽녹원 _한국관광공사 김지호_OxycYa.jpg",
  "gimje":       "/image/jeolla/gimje/Type1_칠월의 인사.._전영호_Ef8yua.jpg",
  "gunsan":      "/image/jeolla/gunsan/Type1_경암동 철길마을_한국관광공사 이범수_ruUWsa.jpg",
  "gwangyang":   "/image/jeolla/gwangyang/Type1_매화꽃_한국관광공사 김지호_fIrJea.jpg",
  "iksan":       "/image/jeolla/iksan/Type1_익산 미륵사지_한국관광공사 박성근_j27Bza.jpg",
  "jeongeup":    "/image/jeolla/jeongeup/Type1_내장사_두드림_NCyAOa.jpg",
  "jeonju":      "/image/jeolla/jeonju/Type1_전주비빔밥_한국관광공사 김지호_hEM1aa.jpg",
  "mokpo":       "/image/jeolla/mokpo/Type1_목포 해상케이블카_디엔에이스튜디오_9zjmje.jpg",
  "naju":        "/image/jeolla/naju/Type1_금성관_황성훈_bjuQZ2.jpg",
  "namwon":      "/image/jeolla/namwon/Type1_광한루원_황성훈_w4dkQ1.jpg",
  "suncheon":    "/image/jeolla/suncheon/Type1_순천만_조성근_Nvklka.jpg",
  "wando":       "/image/jeolla/wando/Type1_완도몽돌해변_한국관광공사-박동철_fQShYa.jpg",
  "yeosu":       "/image/jeolla/yeosu/Type1_여수 해상케이블카_한국관광공사 이범수_sGE6Va.jpg",

  // ── 광역시 ───────────────────────────────────────────────────
  "busan":       "/image/metropolitan-cities/busan/Type1_더베이101_한국관광공사 김지호_VZJFQa.jpg",
  "daegu":       "/image/metropolitan-cities/daegu/Type1_대구 동성로거리_앙지뉴 필름_0HusGK.jpg",
  "daejeon":     "/image/metropolitan-cities/daejeon/Type1_대전 엑스포다리_한국관광공사 김지호_atgwSa.jpg",
  "gwangju":     "/image/metropolitan-cities/gwangju/Type1_1913 송정역시장_한국관광공사 김지호_D6QeMa.jpg",
  "incheon":     "/image/metropolitan-cities/incheon/Type1_미래도시 송도_전종훈_qsmMUa.jpg",
  "sejong":      "/image/metropolitan-cities/sejong/Type1_국립세종수목원_김용훈_195a3f.jpg",
  "ulsan":       "/image/metropolitan-cities/ulsan/Type1_간절곶_두잇컴퍼니 노시현_jCdpja.jpg",

  // ── 경기 북부 ─────────────────────────────────────────────────
  "dongducheon": "/image/northern-gyeonggi/dongducheon/Type1_벨기에 및 룩셈부르크군 참전기념비_한국관광공사 박성근_hGCkca.jpg",
  "gapyeong":    "/image/northern-gyeonggi/gapyeong/Type1_자라섬_한국관광공사 김지호_lB8Uw6.jpg",
  "gimpo":       "/image/northern-gyeonggi/gimpo/Type1_김포 장릉_김민수_UxFVXS.jpg",
  "goyang":      "/image/northern-gyeonggi/goyang/Type1_행주산성_안영관_tE4jWB.jpg",
  "guri":        "/image/northern-gyeonggi/guri/Type1_건원릉(태조)_한국관광공사 이범수_RCK2Pa.jpg",
  "namyangju":   "/image/northern-gyeonggi/namyangju/Type1_정약용유적지_한국관광공사 이범수_eVz3RL.jpg",
  "paju":        "/image/northern-gyeonggi/paju/Type1_임진각 관광지_IR 스튜디오_NliTga.jpg",
  "pocheon":     "/image/northern-gyeonggi/pocheon/Type1_비둘기낭 폭포_한국관광공사 김경조 _udl6Ja.jpg",
  "uijeongbu":   "/image/northern-gyeonggi/uijeongbu/Type1_의정부 제일시장_우창민_2Z6Y1G.jpg",
  "yangju":      "/image/northern-gyeonggi/yangju/Type1_나리농원_전지민_aeb7C0.jpg",
  "yangpyeong":  "/image/northern-gyeonggi/yangpyeong/Type1_고요한 아침_유영훈_Ef8y9a.jpg",

  // ── 서울 ─────────────────────────────────────────────────────
  "bukchon":     "/image/seoul/bukchon/Type1_북촌한옥마을_IR 스튜디오_3Xgcka.jpg",
  "gangnam":     "/image/seoul/gangnam/Type1_강남야경_김미숙_t5ShFa.jpg",
  "hongdae":     "/image/seoul/hongdae/Type1_연남동 경의선숲길_한국관광공사 이범수_ONxkva.jpg",
  "itaewon":     "/image/seoul/itaewon/Type1_서울야경_한국관광공사, 전형준_hoHV3a.jpg",
  "jamsil":      "/image/seoul/jamsil/Type1_구름좋은날_이성우_rD85xD.jpg",
  "jongno":      "/image/seoul/jongno/Type1_광화문_한국관광공사 김지호_4hPPTa.jpg",
  "myeongdong":  "/image/seoul/myeongdong/Type1_닭강정_한국관광공사 전형준_qJCFja.jpg",
  "nowon":       "/image/seoul/nowon/Type1_도봉산의 가을 운해_송기덕_mGCG9a.jpg",
  "seongsu":     "/image/seoul/seongsu/Type1_성수구름다리_서문교_pFy2tW.jpg",

  // ── 경기 남부 ─────────────────────────────────────────────────
  "ansan":       "/image/southern-gyeonggi/ansan/Type1_탄도항_이형찬_5gSMQ3.jpg",
  "anseong":     "/image/southern-gyeonggi/anseong/Type1_목장의 봄_권기대_Nvkl5a.jpg",
  "anyang":      "/image/southern-gyeonggi/anyang/Type1_갈대숲 길따라_고영훈_qhpcMa.jpg",
  "gunpo":       "/image/southern-gyeonggi/gunpo/Type1_지리산_한국관광공사 김지호_uGi4Ra.jpg",
  "hanam":       "/image/southern-gyeonggi/hanam/Type1_하남 유니온파크_라이브스튜디오_E1lsJe.jpg",
  "hwaseong":    "/image/southern-gyeonggi/hwaseong/Type1_화성 융릉과 건릉_한국관광공사 송재근_Gpe6QU.jpg",
  "icheon":      "/image/southern-gyeonggi/icheon/Type1_이천 세라피아_도자쇼핑몰_한국관광공사 김지호_16BLva.jpg",
  "osan":        "/image/southern-gyeonggi/osan/Type1_물향기수목원_박아름_NIYptG.jpg",
  "pyeongtaek":  "/image/southern-gyeonggi/pyeongtaek/Type1_서해대교_IR 스튜디오_x9IOya.jpg",
  "seongnam":    "/image/southern-gyeonggi/seongnam/Type1_정겨운 재래시장_우태하_Rv9vPa.jpg",
  "siheung":     "/image/southern-gyeonggi/siheung/Type1_오이도 빨강등대_임태진_GsapBv.jpg",
  "suwon":       "/image/southern-gyeonggi/suwon/Type1_수원화성_박병수_IlUkda.jpg",
  "yeoju":       "/image/southern-gyeonggi/yeoju/Type1_신륵사_한국관광공사 김지호_mOLDwa.jpg",
  "yongin":      "/image/southern-gyeonggi/yongin/Type1_용인 대장금 파크_라이브스튜디오_2l8Mda.jpg",
};

// 이미지가 없는 세부 지역 → 상위 도시 이미지로 대체
const ALIAS: Record<string, string> = {
  // 서울 세부
  "seoul":         "jongno",
  "yongsan":       "itaewon",
  // 부산 세부
  "haeundae":      "busan",
  "gwangalli":     "busan",
  "gijang":        "busan",
  "songjeong":     "busan",
  "nampo":         "busan",
  "seomyeon":      "busan",
  "gamcheon":      "busan",
  "yeongdo":       "busan",
  "geumjeong":     "busan",
  "gangseo-bs":    "busan",
  "dadaepo":       "busan",
  // 대구 세부
  "dongseongno":   "daegu",
  "gimgwangseok":  "daegu",
  "suseongmot":    "daegu",
  "palgongsan":    "daegu",
  "dalseong":      "daegu",
  "gunwi":         "daegu",
  // 울산 세부
  "ganjeolgot":    "ulsan",
  "daewangam":     "ulsan",
  "taehwagang":    "ulsan",
  "bangudae":      "ulsan",
  // 강원 slug 차이
  "goseong-gw":    "goseong",
  // 경남 세부
  "goseong-gn":    "geoje",
  "hamyang":       "hapcheon",
  "sancheong":     "hapcheon",
  "hadong":        "namhae",
  "changnyeong":   "jinju",
  "uiryeong":      "jinju",
  // 경북 세부
  "yeongdeok":     "pohang",
  "uljin":         "pohang",
  "dokdo":         "pohang",
  // 경기 남부 세부
  "gwacheon":      "anyang",
  "uiwang":        "anyang",
  "gwangmyeong":   "seongnam",
  "bucheon":       "seongnam",
};

/** slug에 해당하는 이미지 경로 반환 (raw, Next.js <Image> 전용). 없으면 null */
export function getDestinationImage(slug: string): string | null {
  const key = IMAGE_MAP[slug] ? slug : ALIAS[slug];
  if (!key) return null;
  return IMAGE_MAP[key] ?? null;
}
