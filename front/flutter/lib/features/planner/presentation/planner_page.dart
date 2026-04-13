import "dart:math" show Random;

import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/router/main_shell.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../../../core/router/shell_back_handler.dart";
import "../../auth/presentation/state/auth_controller.dart";
import "../data/k_content_repository.dart";
import "../data/planner_models.dart";
import "../data/planner_repository.dart";
import "../data/user_content_models.dart";
import "state/planner_controller.dart";
import "state/user_content_controller.dart";
import "state/user_content_state.dart";
import "planner_dest_i18n.dart";
import "user_content_upload_sheet.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = KroaddyColors.primary;
const _primaryLight = KroaddyColors.brandWash;
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

// ── 여행지 데이터 모델 (이름·하이라이트는 웹 동기화 `planner_dest.*`) ──
class _Destination {
  const _Destination(this.slug, this.emoji, {this.popular = false});
  final String slug;
  final String emoji;
  final bool popular;
}

class _DestGroup {
  const _DestGroup(this.regionKey, this.items);
  /// Web `planner.region` key with `-` → `_` (e.g. seoul_areas).
  final String regionKey;
  final List<_Destination> items;
}

/// 광역 카드: `slug`는 `planner_dest` 키(예: seoul). 드릴다운이 있으면 [drillRegionKey].
class _MetroCity {
  const _MetroCity({
    required this.slug,
    required this.emoji,
    required this.drillRegionKey,
    this.popular = false,
  });
  final String slug;
  final String emoji;
  final String? drillRegionKey;
  final bool popular;
}

// ── 이미지 Base URL (웹 서버와 공유) ──────────────────────────
const _imageBase = "https://web.kroaddy.site";
const _imageMap = <String, String>{
  // 충청
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
  // 강원
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
  // 경상
  "andong":      "/image/gyeongsang/andong/Type1_안동하회마을_오세근_pWkI2a.jpg",
  "changwon":    "/image/gyeongsang/changwon/Type1_2019 진해군항제_라이브스튜디오_Bvw8wa.jpg",
  "geoje":       "/image/gyeongsang/geoje/Type1_거제 바람의 언덕_BOKEH_UHVvDa.jpg",
  "gimcheon":    "/image/gyeongsang/gimcheon/Type1_직지사_한국관광공사 이범수_Gpevfa.jpg",
  "gimhae":      "/image/gyeongsang/gimhae/Type1_김해가야테마파크_한국관광공사 김지호_W0rH0T.jpg",
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
  // 제주
  "jeju":        "/image/jejudo/jeju/Type1_The One Summer_이경재_ciTm3a.jpg",
  "seogwipo":    "/image/jejudo/seogwipo/Type1_성산봉의 여명_임성복_Nvklsa.jpg",
  // 전라
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
  // 광역시
  "busan":       "/image/metropolitan-cities/busan/Type1_더베이101_한국관광공사 김지호_VZJFQa.jpg",
  "daegu":       "/image/metropolitan-cities/daegu/Type1_대구 동성로거리_앙지뉴 필름_0HusGK.jpg",
  "daejeon":     "/image/metropolitan-cities/daejeon/Type1_대전 엑스포다리_한국관광공사 김지호_atgwSa.jpg",
  "gwangju":     "/image/metropolitan-cities/gwangju/Type1_1913 송정역시장_한국관광공사 김지호_D6QeMa.jpg",
  "incheon":     "/image/metropolitan-cities/incheon/Type1_미래도시 송도_전종훈_qsmMUa.jpg",
  "sejong":      "/image/metropolitan-cities/sejong/Type1_국립세종수목원_김용훈_195a3f.jpg",
  "ulsan":       "/image/metropolitan-cities/ulsan/Type1_간절곶_두잇컴퍼니 노시현_jCdpja.jpg",
  // 경기 북부
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
  // 서울
  "bukchon":     "/image/seoul/bukchon/Type1_북촌한옥마을_IR 스튜디오_3Xgcka.jpg",
  "gangnam":     "/image/seoul/gangnam/Type1_강남야경_김미숙_t5ShFa.jpg",
  "hongdae":     "/image/seoul/hongdae/Type1_연남동 경의선숲길_한국관광공사 이범수_ONxkva.jpg",
  "itaewon":     "/image/seoul/itaewon/Type1_서울야경_한국관광공사, 전형준_hoHV3a.jpg",
  "jamsil":      "/image/seoul/jamsil/Type1_구름좋은날_이성우_rD85xD.jpg",
  "jongno":      "/image/seoul/jongno/Type1_광화문_한국관광공사 김지호_4hPPTa.jpg",
  "myeongdong":  "/image/seoul/myeongdong/Type1_닭강정_한국관광공사 전형준_qJCFja.jpg",
  "nowon":       "/image/seoul/nowon/Type1_도봉산의 가을 운해_송기덕_mGCG9a.jpg",
  "seongsu":     "/image/seoul/seongsu/Type1_성수구름다리_서문교_pFy2tW.jpg",
  // 경기 남부
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

// slug에 이미지가 없으면 상위 대표 slug로 폴백
const _aliasMap = <String, String>{
  "seoul":          "jongno",
  "yongsan":        "itaewon",
  "haeundae":       "busan", "gwangalli": "busan", "gijang": "busan",
  "songjeong":      "busan", "nampo":     "busan", "seomyeon": "busan",
  "gamcheon":       "busan", "yeongdo":   "busan", "geumjeong": "busan",
  "gangseo-bs":     "busan", "dadaepo":   "busan",
  "dongseongno":    "daegu", "gimgwangseok": "daegu", "suseongmot": "daegu",
  "palgongsan":     "daegu", "dalseong":  "daegu", "gunwi":     "daegu",
  "ganjeolgot":     "ulsan", "daewangam": "ulsan", "taehwagang": "ulsan",
  "bangudae":       "ulsan",
  "goseong-gw":     "goseong",
  "goseong-gn":     "geoje",
  "hamyang":        "hapcheon", "sancheong": "hapcheon", "hadong": "namhae",
  "changnyeong":    "jinju", "uiryeong":  "jinju",
  "yeongdeok":      "pohang", "uljin":    "pohang", "dokdo":    "pohang",
  "gwacheon":       "anyang", "uiwang":   "anyang",
  "gwangmyeong":    "seongnam", "bucheon": "seongnam",
  "gumi":           "gimcheon",
};

String? _getImageUrl(String slug) {
  final key = _imageMap.containsKey(slug) ? slug : _aliasMap[slug];
  if (key == null) return null;
  final path = _imageMap[key];
  if (path == null) return null;
  return _imageBase + Uri.encodeFull(path);
}

// ── 광역시 바로가기 (`planner_dest.{slug}`) ─────────────────────
const _metroCities = [
  _MetroCity(slug: "seoul", emoji: "🏙️", drillRegionKey: "seoul_areas", popular: true),
  _MetroCity(slug: "busan", emoji: "🌊", drillRegionKey: "busan", popular: true),
  _MetroCity(slug: "daegu", emoji: "🌹", drillRegionKey: "daegu", popular: true),
  _MetroCity(slug: "incheon", emoji: "✈️", drillRegionKey: null, popular: true),
  _MetroCity(slug: "gwangju", emoji: "🎨", drillRegionKey: null, popular: true),
  _MetroCity(slug: "daejeon", emoji: "🍞", drillRegionKey: null, popular: true),
  _MetroCity(slug: "ulsan", emoji: "🐋", drillRegionKey: "ulsan"),
  _MetroCity(slug: "sejong", emoji: "🌿", drillRegionKey: null),
];

// ── Netflix 스타일 지역 그룹 (`planner_region.{regionKey}`) ───
final _metroGroups = [
  _DestGroup("seoul_areas", const [
    _Destination("jongno", "🏛️", popular: true),
    _Destination("myeongdong", "🛍️", popular: true),
    _Destination("yongsan", "🌍", popular: true),
    _Destination("gangnam", "💼", popular: true),
    _Destination("jamsil", "🎡", popular: true),
    _Destination("seongsu", "☕", popular: true),
    _Destination("hongdae", "🎸", popular: true),
    _Destination("bukchon", "🏮", popular: true),
    _Destination("nowon", "⛰️"),
  ]),
  _DestGroup("busan", const [
    _Destination("haeundae", "🏖️", popular: true),
    _Destination("gwangalli", "🌉", popular: true),
    _Destination("gijang", "🦀", popular: true),
    _Destination("nampo", "🎬", popular: true),
    _Destination("gamcheon", "🏘️", popular: true),
    _Destination("seomyeon", "🛍️"),
    _Destination("yeongdo", "⚓"),
    _Destination("geumjeong", "♨️"),
    _Destination("dadaepo", "🌅"),
  ]),
  _DestGroup("daegu", const [
    _Destination("dongseongno", "🛍️", popular: true),
    _Destination("gimgwangseok", "🎵", popular: true),
    _Destination("suseongmot", "🦢", popular: true),
    _Destination("palgongsan", "⛰️", popular: true),
    _Destination("dalseong", "🌸", popular: true),
  ]),
  _DestGroup("ulsan", const [
    _Destination("ganjeolgot", "🌅", popular: true),
    _Destination("daewangam", "🐉", popular: true),
    _Destination("taehwagang", "🐦"),
    _Destination("bangudae", "🦣"),
  ]),
];

final _provinceGroups = [
  _DestGroup("gyeonggi_north", const [
    _Destination("goyang", "🌸"),
    _Destination("paju", "📚", popular: true),
    _Destination("namyangju", "🌿", popular: true),
    _Destination("gapyeong", "🚣", popular: true),
    _Destination("yangpyeong", "☕", popular: true),
    _Destination("pocheon", "🌳", popular: true),
    _Destination("uijeongbu", "🍖"),
    _Destination("yangju", "🌻"),
    _Destination("dongducheon", "🎶"),
    _Destination("gimpo", "🌾"),
    _Destination("guri", "🌸"),
  ]),
  _DestGroup("gyeonggi_south", const [
    _Destination("suwon", "🏯", popular: true),
    _Destination("yongin", "🎡", popular: true),
    _Destination("icheon", "🍚", popular: true),
    _Destination("seongnam", "🏢"),
    _Destination("hanam", "🛍️"),
    _Destination("hwaseong", "🌅"),
    _Destination("ansan", "🎨"),
    _Destination("pyeongtaek", "🚢"),
    _Destination("yeoju", "👑"),
    _Destination("gunpo", "🌲"),
    _Destination("anyang", "⛰️"),
    _Destination("anseong", "🎭"),
    _Destination("siheung", "🦢"),
    _Destination("osan", "🏛️"),
  ]),
  _DestGroup("gangwon", const [
    _Destination("gangneung", "☕", popular: true),
    _Destination("sokcho", "🏔️", popular: true),
    _Destination("chuncheon", "🍗", popular: true),
    _Destination("yangyang", "🏄", popular: true),
    _Destination("pyeongchang", "🐑", popular: true),
    _Destination("wonju", "🎨", popular: true),
    _Destination("donghae", "🌊"),
    _Destination("samcheok", "🐉"),
    _Destination("taebaek", "⛏️"),
    _Destination("jeongseon", "⛰️"),
    _Destination("inje", "🦌"),
  ]),
  _DestGroup("chungbuk", const [
    _Destination("danyang", "🪂", popular: true),
    _Destination("jecheon", "🌸", popular: true),
    _Destination("cheongju", "📜"),
    _Destination("chungju", "🌊"),
  ]),
  _DestGroup("chungnam", const [
    _Destination("gongju", "👑", popular: true),
    _Destination("buyeo", "🏛️", popular: true),
    _Destination("boryeong", "🌊", popular: true),
    _Destination("taean", "🐚", popular: true),
    _Destination("asan", "♨️"),
    _Destination("cheonan", "🍓"),
    _Destination("seosan", "🦢"),
    _Destination("nonsan", "🍓"),
    _Destination("dangjin", "🌅"),
  ]),
  _DestGroup("jeonbuk", const [
    _Destination("jeonju", "🏮", popular: true),
    _Destination("gunsan", "🚢", popular: true),
    _Destination("namwon", "💕"),
    _Destination("iksan", "🏛️"),
    _Destination("jeongeup", "🌸"),
    _Destination("gimje", "🌾"),
  ]),
  _DestGroup("jeonnam", const [
    _Destination("yeosu", "🦀", popular: true),
    _Destination("suncheon", "🦢", popular: true),
    _Destination("mokpo", "🌉", popular: true),
    _Destination("damyang", "🎋", popular: true),
    _Destination("boseong", "🍵", popular: true),
    _Destination("wando", "🐟"),
    _Destination("gwangyang", "🌸"),
    _Destination("naju", "🍐"),
  ]),
  _DestGroup("gyeongbuk", const [
    _Destination("gyeongju", "🌸", popular: true),
    _Destination("andong", "🎭", popular: true),
    _Destination("pohang", "🌅", popular: true),
    _Destination("mungyeong", "⛩️", popular: true),
    _Destination("yeongju", "🍎"),
    _Destination("gimcheon", "🍑"),
    _Destination("yeongcheon", "🍇"),
    _Destination("gyeongsan", "🌿"),
    _Destination("sangju", "🚴"),
  ]),
  _DestGroup("gyeongnam", const [
    _Destination("tongyeong", "⛵", popular: true),
    _Destination("geoje", "🌬️", popular: true),
    _Destination("namhae", "🇩🇪", popular: true),
    _Destination("jinju", "🪔", popular: true),
    _Destination("hapcheon", "🌸"),
    _Destination("changwon", "🌸"),
    _Destination("miryang", "🌿"),
    _Destination("gimhae", "👑"),
    _Destination("yangsan", "🏔️"),
    _Destination("hadong", "🍵", popular: true),
  ]),
  _DestGroup("jeju", const [
    _Destination("jeju", "🌺", popular: true),
    _Destination("seogwipo", "🌊", popular: true),
  ]),
];

// ── 진입점 ─────────────────────────────────────────────────────
class PlannerPage extends ConsumerWidget {
  const PlannerPage({super.key, this.initialTabIndex = 0});

  final int initialTabIndex;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      initialIndex: initialTabIndex.clamp(0, 2),
      child: Scaffold(
        backgroundColor: _bgPage,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.menu, color: _textPrimary),
            onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
          ),
          title: Text(
            "sidebar.planner".tr(),
            style: const TextStyle(
              color: _textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          bottom: TabBar(
            labelColor: _primary,
            unselectedLabelColor: _textSecondary,
            indicatorColor: _primary,
            indicatorWeight: 3,
            tabs: [
              Tab(text: "screens.planner.tab_standard".tr()),
              Tab(text: "screens.planner.tab_user_content".tr()),
              Tab(text: "screens.planner.tab_k_content".tr()),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _StandardTab(),
            _UserContentTab(),
            _KContentTab(),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// STANDARD TAB
// ═══════════════════════════════════════════════════════════════
class _StandardTab extends ConsumerStatefulWidget {
  const _StandardTab();

  @override
  ConsumerState<_StandardTab> createState() => _StandardTabState();
}

class _StandardTabState extends ConsumerState<_StandardTab> {
  // 0 = 여행지 선택, 1 = 세부 권역(드릴다운), 2 = 루트 & 일정
  int _step = 0;
  _DestGroup? _drillGroup;
  _Destination? _picked;

  /// 지역 타일 탭 → 세부 권역 드릴다운
  void _onGroupTap(_DestGroup group) {
    setState(() {
      _drillGroup = group;
      _step = 1;
    });
  }

  void _selectDest(_Destination dest) {
    setState(() {
      _picked = dest;
      _step = 2;
    });
    final ctrl = ref.read(plannerControllerProvider.notifier);
    ctrl.setLocation(dest.slug);
  }

  void _backToSelect() {
    setState(() {
      _step = 0;
      _picked = null;
      _drillGroup = null;
    });
  }

  void _backToDrill() {
    setState(() {
      _step = 1;
      _picked = null;
    });
  }

  /// 루트·일정 화면에서 뒤로: 세부 권역(드릴다운)을 거쳤으면 1단계로, 광역시 직선택(인천·대전 등)이면 지역 선택(0)으로
  void _backFromWorkspace() {
    if (_drillGroup == null) {
      _backToSelect();
    } else {
      _backToDrill();
    }
  }

  @override
  Widget build(BuildContext context) {
    late final Widget body;
    if (_step == 0) {
      body = _DestinationSelector(onSelect: _selectDest, onGroupTap: _onGroupTap);
    } else if (_step == 1 && _drillGroup != null) {
      body = _DrillDownScreen(
        group: _drillGroup!,
        onSelect: _selectDest,
        onBack: _backToSelect,
      );
    } else {
      body = _PlannerWorkspace(dest: _picked!, onBack: _backFromWorkspace);
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        if (_step > 0) {
          if (_step == 2) {
            _backFromWorkspace();
          } else {
            _backToSelect();
          }
          return;
        }
        handleShellBackButton(GoRouter.of(context));
      },
      child: body,
    );
  }
}

// ── 여행지 선택 화면 ───────────────────────────────────────────
class _DestinationSelector extends StatefulWidget {
  const _DestinationSelector({required this.onSelect, required this.onGroupTap});
  final void Function(_Destination) onSelect;
  final void Function(_DestGroup) onGroupTap;

  @override
  State<_DestinationSelector> createState() => _DestinationSelectorState();
}

class _DestinationSelectorState extends State<_DestinationSelector> {
  String _query = "";

  List<_Destination> get _allDests => [
        ..._metroCities.map(
          (c) => _Destination(c.slug, c.emoji, popular: c.popular),
        ),
        ..._metroGroups.expand((g) => g.items),
        ..._provinceGroups.expand((g) => g.items),
      ];

  List<_Destination> get _filtered {
    if (_query.isEmpty) return [];
    return _allDests.where((d) => plannerDestMatchesQuery(d.slug, _query)).toSet().toList();
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // 검색 바
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: "screens.planner.search_hint".tr(),
                hintStyle: const TextStyle(color: _textSecondary, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: _textSecondary, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: _textSecondary),
                        onPressed: () => setState(() => _query = ""),
                      )
                    : null,
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _primary, width: 1.5),
                ),
              ),
            ),
          ),
        ),

        // 검색 결과
        if (_query.isNotEmpty)
          SliverToBoxAdapter(
            child: _filtered.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(32),
                    child: Center(
                      child: Text(
                        "screens.planner.search_empty".tr(),
                        style: const TextStyle(color: _textSecondary),
                      ),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "screens.planner.search_result".tr(
                            namedArgs: {"query": _query, "count": "${_filtered.length}"},
                          ),
                          style: const TextStyle(fontSize: 12, color: _textSecondary),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _filtered
                              .map((d) => ActionChip(
                                    avatar: Text(d.emoji),
                                    label: Text(plannerDestName(d.slug)),
                                    backgroundColor: Colors.white,
                                    side: BorderSide(color: Colors.grey.shade200),
                                    onPressed: () => widget.onSelect(d),
                                  ))
                              .toList(),
                        ),
                      ],
                    ),
                  ),
          ),

        if (_query.isEmpty) ...[
          // ── 광역시·특별시 섹션 ───────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Text(
                "screens.planner.grid_header_metro".tr(),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.22,
              ),
              delegate: SliverChildListDelegate([
                ..._metroCities.map((city) {
                  final group = city.drillRegionKey != null
                      ? _metroGroups.cast<_DestGroup?>().firstWhere(
                            (g) => g!.regionKey == city.drillRegionKey,
                            orElse: () => null,
                          )
                      : null;
                  final subtitle = group != null
                      ? group.items
                          .take(3)
                          .map((i) => plannerDestName(i.slug))
                          .join(" · ")
                      : plannerDestHighlightsLine(city.slug, maxItems: 2);
                  final title = plannerDestName(city.slug);
                  return _RegionTileCard(
                    emoji: city.emoji,
                    title: title,
                    backgroundAssetPath: _metroCardBackgroundAssetBySlug(city.slug),
                    assetPath: _metroIconAssetBySlug(city.slug),
                    subtitle: subtitle,
                    hasDrill: group != null,
                    onTap: group != null
                        ? () => widget.onGroupTap(group)
                        : () => widget.onSelect(
                              _Destination(city.slug, city.emoji, popular: city.popular),
                            ),
                  );
                }),
              ]),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 20)),

          // ── 도 단위 지역 섹션 ───────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Text(
                "screens.planner.grid_header_province".tr(),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.22,
              ),
              delegate: SliverChildListDelegate([
                ..._provinceGroups.map(
                  (g) => _RegionTileCard(
                    emoji: g.items.first.emoji,
                    title: plannerRegionLabel(g.regionKey),
                    backgroundAssetPath: _provinceCardBackgroundAssetByRegionKey(g.regionKey),
                    assetPath: _provinceIconAssetByRegionKey(g.regionKey),
                    subtitle: plannerRegionSubLabel(g.regionKey),
                    hasDrill: true,
                    onTap: () => widget.onGroupTap(g),
                  ),
                ),
              ]),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ],
    );
  }
}

String? _metroCardBackgroundAssetBySlug(String slug) {
  return switch (slug) {
    "seoul" => "icons/bg/seoul_bg.jpg",
    "busan" => "icons/bg/busan_bg.jpg",
    "daegu" => "icons/bg/daegu_bg.jpg",
    "incheon" => "icons/bg/incheon_bg.jpg",
    "gwangju" => "icons/bg/gwangu_bg.jpg",
    "daejeon" => "icons/bg/daejun_bg.jpg",
    "ulsan" => "icons/bg/ulsan_bg.jpg",
    "sejong" => "icons/bg/sejong_bg.jpg",
    _ => null,
  };
}

String? _metroIconAssetBySlug(String slug) {
  return switch (slug) {
    "seoul" => "icons/seoul.png",
    "busan" => "icons/busan.png",
    "daegu" => "icons/daegu.png",
    "incheon" => "icons/inchoen.png",
    "gwangju" => "icons/gwangju.png",
    "daejeon" => "icons/daejun.png",
    "ulsan" => "icons/ulsan.png",
    "sejong" => "icons/sejong.png",
    _ => null,
  };
}

String? _provinceCardBackgroundAssetByRegionKey(String regionKey) {
  return switch (regionKey) {
    "gyeonggi_north" => "icons/bg/gyungi1_bg.jpg",
    "gyeonggi_south" => "icons/bg/gyungi2_bg.jpg",
    "gangwon" => "icons/bg/gangwondo_bg.jpg",
    "chungbuk" => "icons/bg/chungju_bg.jpg",
    "chungnam" => "icons/bg/chunan_bg.jpg",
    "jeonbuk" => "icons/bg/junbuk_bg.jpg",
    "jeonnam" => "icons/bg/junam_bg.jpg",
    "gyeongbuk" => "icons/bg/gyungbuk_bg.jpg",
    "gyeongnam" => "icons/bg/gyungnam_bg.jpg",
    "jeju" => "icons/bg/jejudo_bg.jpg",
    _ => null,
  };
}

String? _provinceIconAssetByRegionKey(String regionKey) {
  return switch (regionKey) {
    "gyeonggi_north" => "icons/gyeongi.png",
    "gyeonggi_south" => "icons/gyeongi2.png",
    "gangwon" => "icons/gangwon.png",
    "chungnam" => "icons/chungnam-Photoroom.png",
    "chungbuk" => "icons/chungbukk.png",
    "jeonnam" => "icons/zunra-Photoroom.png",
    "jeonbuk" => "icons/zunbuk.png",
    "jeju" => "icons/zezudo-Photoroom.png",
    "gyeongnam" => "icons/gyeongnam.png",
    "gyeongbuk" => "icons/gyeongbuk.png",
    _ => null,
  };
}

// ── 지역 선택 타일 카드 (이모지 + 지역명만) ─────────────────────
class _RegionTileCard extends StatelessWidget {
  const _RegionTileCard({
    required this.emoji,
    required this.title,
    required this.onTap,
    this.assetPath,
    this.backgroundAssetPath,
    // subtitle·hasDrill 파라미터 유지 (호출부 변경 없이 무시)
    String subtitle = "",
    bool hasDrill = false,
  });

  /// 배경 사진이 묻히지 않도록 높게 유지(그라데이션으로 글자만 보조)
  static const double _bgImageOpacity = 0.92;

  final String emoji;
  final String title;
  final VoidCallback onTap;
  final String? assetPath;
  /// 지역 카드 뒤 풍경(예: 서울) — 흰색 위에 투명도·그라데이션으로 얹음
  final String? backgroundAssetPath;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Colors.white),
            if (backgroundAssetPath != null) ...[
              Positioned.fill(
                child: Opacity(
                  opacity: _bgImageOpacity,
                  child: Image.asset(
                    backgroundAssetPath!,
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                  ),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.white.withValues(alpha: 0.22),
                        Colors.white.withValues(alpha: 0.42),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (assetPath != null)
                    Image.asset(
                      assetPath!,
                      width: 52,
                      height: 52,
                      fit: BoxFit.contain,
                    )
                  else
                    Text(emoji, style: const TextStyle(fontSize: 40)),
                  const SizedBox(height: 6),
                  Text(
                    title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      height: 1.15,
                      color: _textPrimary,
                      shadows: backgroundAssetPath != null
                          ? [
                              Shadow(
                                color: Colors.white.withValues(alpha: 0.95),
                                blurRadius: 6,
                              ),
                              Shadow(
                                color: Colors.white.withValues(alpha: 0.85),
                                blurRadius: 2,
                              ),
                            ]
                          : null,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 순위 배지가 있는 이미지 카드 ────────────────────────────────
class _RankedCard extends StatelessWidget {
  const _RankedCard({
    required this.rank,
    required this.dest,
    required this.height,
    required this.onTap,
  });

  final int rank;
  final _Destination dest;
  final double height;
  final VoidCallback onTap;

  // 1·2·3위 뱃지 색상
  static const _badgeColors = [
    Color(0xFFEF4444), // 1위 red
    Color(0xFFF97316), // 2위 orange
    Color(0xFFF59E0B), // 3위 amber
  ];

  @override
  Widget build(BuildContext context) {
    final imgUrl = _getImageUrl(dest.slug);
    final badgeColor = rank <= 3 ? _badgeColors[rank - 1] : const Color(0xFF6B7280);

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        height: height,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 배경 이미지
              if (imgUrl != null)
                Image.network(
                  imgUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _PlaceholderBg(dest: dest),
                )
              else
                _PlaceholderBg(dest: dest),

              // 그라디언트 오버레이
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0.35, 1.0],
                    colors: [Colors.transparent, Color(0xE0000000)],
                  ),
                ),
              ),

              // 순위 뱃지 (좌상단)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: badgeColor,
                    boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 6, offset: Offset(0, 2))],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    "$rank",
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

              // 텍스트 (하단)
              Positioned(
                left: 10,
                right: 10,
                bottom: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      plannerDestName(dest.slug),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
                    if (plannerDestHighlights(dest.slug).isNotEmpty)
                      Text(
                        plannerDestHighlightsLine(dest.slug, maxItems: 2),
                        style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlaceholderBg extends StatelessWidget {
  const _PlaceholderBg({required this.dest});
  final _Destination dest;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFEDE9FE),
      alignment: Alignment.center,
      child: Text(dest.emoji, style: const TextStyle(fontSize: 36)),
    );
  }
}

// ── 세부 권역 드릴다운 화면 — 순위별 Netflix 레이아웃 ───────────
class _DrillDownScreen extends StatelessWidget {
  const _DrillDownScreen({
    required this.group,
    required this.onSelect,
    required this.onBack,
  });

  final _DestGroup group;
  final void Function(_Destination) onSelect;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    // 인기(popular) 우선 정렬 → 임시 순위로 활용
    final sorted = [...group.items]
      ..sort((a, b) {
        if (a.popular == b.popular) return 0;
        return a.popular ? -1 : 1;
      });

    final top1 = sorted.isNotEmpty ? sorted[0] : null;
    final top2 = sorted.length > 1 ? sorted[1] : null;
    final top3 = sorted.length > 2 ? sorted[2] : null;
    final rest = sorted.length > 3 ? sorted.sublist(3) : <_Destination>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── 헤더 ─────────────────────────────────────────────────
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: _textPrimary),
                onPressed: onBack,
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plannerRegionLabel(group.regionKey),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: _textPrimary),
                  ),
                  Text(
                    plannerRegionSubLabel(group.regionKey),
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
                ],
              ),
            ],
          ),
        ),

        // ── 순위 콘텐츠 ──────────────────────────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              // TOP 섹션 헤더
              Row(
                children: [
                  const Icon(Icons.local_fire_department, color: Colors.orange, size: 18),
                  const SizedBox(width: 4),
                  Text(
                    "screens.planner.top_spots_row".tr(),
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // ── 1위: 풀-width 히어로 카드 ─────────────────────
              if (top1 != null) ...[
                _RankedCard(rank: 1, dest: top1, height: 210, onTap: () => onSelect(top1)),
                const SizedBox(height: 10),
              ],

              // ── 2위 · 3위: 나란히 ─────────────────────────────
              if (top2 != null)
                Row(
                  children: [
                    Expanded(
                      child: _RankedCard(rank: 2, dest: top2, height: 135, onTap: () => onSelect(top2)),
                    ),
                    if (top3 != null) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: _RankedCard(rank: 3, dest: top3, height: 135, onTap: () => onSelect(top3)),
                      ),
                    ],
                  ],
                ),

              // ── 4위 이하: 가로 스크롤 포스터 ─────────────────
              if (rest.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  "screens.planner.more_destinations".tr(),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 165,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: rest.length,
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: SizedBox(
                        width: 110,
                        child: _RankedCard(
                          rank: i + 4,
                          dest: rest[i],
                          height: 165,
                          onTap: () => onSelect(rest[i]),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── 루트 & 일정 워크스페이스 ───────────────────────────────────
class _PlannerWorkspace extends ConsumerWidget {
  const _PlannerWorkspace({required this.dest, required this.onBack});
  final _Destination dest;
  final VoidCallback onBack;

  Future<void> _pickDate(
    BuildContext context,
    WidgetRef ref, {
    required bool isStart,
  }) async {
    final state = ref.read(plannerControllerProvider);
    final source = isStart ? state.startDate : state.endDate;
    final parsed = DateTime.tryParse(source) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: parsed,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: _primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: _textPrimary,
            ),
            datePickerTheme: DatePickerThemeData(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              headerBackgroundColor: const Color(0xFFF7F3FF),
              headerForegroundColor: _textPrimary,
              dayStyle: const TextStyle(fontWeight: FontWeight.w600),
              todayBorder: const BorderSide(color: _primary),
              dayShape: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return const CircleBorder();
                }
                return RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));
              }),
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: _primary,
                textStyle: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
    if (picked == null) return;
    final s = picked.toIso8601String().split("T").first;
    if (isStart) {
      final end = state.endDate.compareTo(s) < 0 ? s : state.endDate;
      ref.read(plannerControllerProvider.notifier).setDateRange(startDate: s, endDate: end);
    } else {
      final end = s.compareTo(state.startDate) < 0 ? state.startDate : s;
      ref.read(plannerControllerProvider.notifier).setDateRange(
            startDate: state.startDate,
            endDate: end,
          );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(plannerControllerProvider);
    final ctrl = ref.read(plannerControllerProvider.notifier);

    return Column(
      children: [
        // 헤더
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              GestureDetector(
                onTap: onBack,
                child: Row(
                  children: [
                    const Icon(Icons.chevron_left, color: _primary),
                    Text(
                      "${dest.emoji} ${plannerDestName(dest.slug)}",
                      style: const TextStyle(
                        color: _primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (state.routesLoading || state.scheduleLoading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
                ),
            ],
          ),
        ),
        if (state.routesLoading || state.scheduleLoading)
          const LinearProgressIndicator(color: _primary, minHeight: 2),

        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final loc = state.location.trim();
              final displayPlannerStatus = state.statusMessage.isNotEmpty
                  ? state.statusMessage
                  : (loc.isEmpty ? "screens.planner.status_region_required".tr() : "");
              if (constraints.maxWidth >= 980) {
                return Row(
                  children: [
                    SizedBox(
                      width: 360,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: () => _pickDate(context, ref, isStart: true),
                                        icon: const Icon(Icons.event, size: 16),
                                        label: Text(
                                          "screens.planner.start_date".tr(namedArgs: {"date": state.startDate}),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const Padding(
                                      padding: EdgeInsets.symmetric(horizontal: 8),
                                      child: Text("~", style: TextStyle(color: _textSecondary)),
                                    ),
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: () => _pickDate(context, ref, isStart: false),
                                        icon: const Icon(Icons.event, size: 16),
                                        label: Text(
                                          "screens.planner.end_date".tr(namedArgs: {"date": state.endDate}),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                // 이동수단 선택
                                Row(
                                  children: [
                                    _TransportButton(
                                      label: "screens.planner.transport_car".tr(),
                                      mode: "car",
                                      selected: state.transportMode == "car",
                                      disabled: state.routesLoading || state.scheduleLoading,
                                      onTap: () => ctrl.setTransportMode("car"),
                                    ),
                                    const SizedBox(width: 6),
                                    _TransportButton(
                                      label: "screens.planner.transport_transit".tr(),
                                      mode: "transit",
                                      selected: state.transportMode == "transit",
                                      disabled: state.routesLoading || state.scheduleLoading,
                                      onTap: () => ctrl.setTransportMode("transit"),
                                    ),
                                    const SizedBox(width: 6),
                                    _TransportButton(
                                      label: "screens.planner.transport_walk".tr(),
                                      mode: "walk",
                                      selected: state.transportMode == "walk",
                                      disabled: state.routesLoading || state.scheduleLoading,
                                      onTap: () => ctrl.setTransportMode("walk"),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                FilledButton.icon(
                                  onPressed: state.routesLoading ? null : ctrl.fetchRoutes,
                                  icon: const Icon(Icons.auto_awesome),
                                  label: Text(
                                    state.routesLoading
                                        ? "screens.planner.generating".tr()
                                        : "screens.planner.generate_route".tr(),
                                  ),
                                  style: FilledButton.styleFrom(backgroundColor: _primary),
                                ),
                              ],
                            ),
                          ),
                          if (!state.routesTriggered && !state.routesLoading)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text("📅", style: TextStyle(fontSize: 40)),
                                    const SizedBox(height: 8),
                                    Text(
                                      "screens.planner.hint_set_date".tr(),
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: _textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      "${state.startDate} ~ ${state.endDate}",
                                      style: const TextStyle(fontSize: 11, color: _textSecondary),
                                    ),
                                    const SizedBox(height: 12),
                                    FilledButton.icon(
                                      onPressed: state.routesLoading ? null : ctrl.fetchRoutes,
                                      icon: const Icon(Icons.auto_awesome, size: 18),
                                      label: Text("screens.planner.standard_start_generate".tr()),
                                      style: FilledButton.styleFrom(backgroundColor: _primary),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          if (state.routesError != null)
                            Container(
                              padding: const EdgeInsets.all(10),
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                state.routesError!,
                                style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12),
                              ),
                            ),
                          if (state.routes.isNotEmpty && !state.routesLoading) ...[
                            Text(
                              "screens.planner.ai_routes_title".tr(),
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: _textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ...state.routes.map((r) {
                              final selected = state.selectedRouteName == r.name;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _RouteCard(
                                  route: r,
                                  selected: selected,
                                  expand: true,
                                  onTap: () {
                                    ctrl.selectRoute(r.name);
                                    ctrl.fetchSchedule();
                                  },
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (state.scheduleLoading)
                            Container(
                              padding: const EdgeInsets.all(14),
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: Column(
                                children: [
                                  const SizedBox(
                                    width: 26,
                                    height: 26,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    "screens.planner.making_schedule_progress".tr(
                                      namedArgs: {
                                        "name": state.selectedRouteName ??
                                            "screens.planner.route_name_fallback".tr(),
                                      },
                                    ),
                                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          if (state.schedule.isNotEmpty) ...[
                            Row(
                              children: [
                                Text(
                                  "screens.planner.schedule_title".tr(),
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: _textPrimary,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  "screens.planner.schedule_item_count".tr(
                                    namedArgs: {"count": "${state.schedule.length}"},
                                  ),
                                  style: const TextStyle(fontSize: 12, color: _textSecondary),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ...state.schedule.map((s) => _ScheduleCard(item: s)),
                            const SizedBox(height: 8),
                            FilledButton.icon(
                              onPressed: state.saving ? null : ctrl.savePlan,
                              icon: const Icon(Icons.save),
                              label: Text(
                                state.saving
                                    ? "screens.planner.msg_saving_plan".tr()
                                    : "screens.planner.save_plan".tr(),
                              ),
                              style: FilledButton.styleFrom(backgroundColor: _primary),
                            ),
                            if (state.savedPlanId != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: OutlinedButton(
                                  onPressed: () => context.push("/planner/schedule"),
                                  child: Text("screens.planner.saved_goto_schedule".tr()),
                                ),
                              ),
                          ] else if (!state.scheduleLoading)
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    state.routesTriggered && state.routes.isNotEmpty
                                        ? "screens.planner.schedule_pick_route_hint".tr()
                                        : "screens.planner.standard_map_need_generate".tr(),
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: _textPrimary,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    state.routesTriggered && state.routes.isNotEmpty
                                        ? "screens.planner.standard_map_range_hint".tr(
                                            namedArgs: {
                                              "start": state.startDate,
                                              "end": state.endDate,
                                            },
                                          )
                                        : "screens.planner.standard_map_tap_generate".tr(),
                                    style: const TextStyle(fontSize: 13, color: _textSecondary),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                );
              }
              return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickDate(context, ref, isStart: true),
                            icon: const Icon(Icons.event, size: 16),
                            label: Text(
                              "screens.planner.start_date".tr(namedArgs: {"date": state.startDate}),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8),
                          child: Text("~", style: TextStyle(color: _textSecondary)),
                        ),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickDate(context, ref, isStart: false),
                            icon: const Icon(Icons.event, size: 16),
                            label: Text(
                              "screens.planner.end_date".tr(namedArgs: {"date": state.endDate}),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: _primary.withValues(alpha: 0.35)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // 이동수단 선택
                    Row(
                      children: [
                        _TransportButton(
                          label: "screens.planner.transport_car".tr(),
                          mode: "car",
                          selected: state.transportMode == "car",
                          disabled: state.routesLoading || state.scheduleLoading,
                          onTap: () => ctrl.setTransportMode("car"),
                        ),
                        const SizedBox(width: 6),
                        _TransportButton(
                          label: "screens.planner.transport_transit".tr(),
                          mode: "transit",
                          selected: state.transportMode == "transit",
                          disabled: state.routesLoading || state.scheduleLoading,
                          onTap: () => ctrl.setTransportMode("transit"),
                        ),
                        const SizedBox(width: 6),
                        _TransportButton(
                          label: "screens.planner.transport_walk".tr(),
                          mode: "walk",
                          selected: state.transportMode == "walk",
                          disabled: state.routesLoading || state.scheduleLoading,
                          onTap: () => ctrl.setTransportMode("walk"),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: state.routesLoading ? null : ctrl.fetchRoutes,
                            icon: const Icon(Icons.auto_awesome),
                            label: Text(
                              state.routesLoading
                                  ? "screens.planner.generating".tr()
                                  : "screens.planner.generate_route".tr(),
                            ),
                            style: FilledButton.styleFrom(backgroundColor: _primary),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // 상태 메시지
              if (displayPlannerStatus.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: _primaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    displayPlannerStatus,
                    style: const TextStyle(fontSize: 13, color: _primary),
                  ),
                ),

              if (state.routesError != null)
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    state.routesError!,
                    style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12),
                  ),
                ),

              if (!state.routesTriggered && !state.routesLoading)
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      Text(
                        "screens.planner.hint_set_date".tr(),
                        style: const TextStyle(fontSize: 13, color: _textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "${state.startDate} ~ ${state.endDate}",
                        style: const TextStyle(fontSize: 12, color: _textSecondary),
                      ),
                    ],
                  ),
                ),

              if (state.routesLoading)
                SizedBox(
                  height: 118,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: 5,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, _) => Container(
                      width: 160,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              // 루트 목록
              if (state.routes.isNotEmpty && !state.routesLoading) ...[
                Text(
                  "screens.planner.ai_routes_title".tr(),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 110,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: state.routes.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final r = state.routes[i];
                      final selected = state.selectedRouteName == r.name;
                      return _RouteCard(
                        route: r,
                        selected: selected,
                        onTap: () {
                          ctrl.selectRoute(r.name);
                          ctrl.fetchSchedule();
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
              ],

              if (state.routesTriggered &&
                  state.routes.isNotEmpty &&
                  state.selectedRouteName == null &&
                  !state.scheduleLoading)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    "screens.planner.schedule_pick_route_hint".tr(),
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
                ),

              if (state.scheduleLoading)
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      const SizedBox(
                        width: 26,
                        height: 26,
                        child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        "screens.planner.making_schedule_progress".tr(
                          namedArgs: {
                            "name": state.selectedRouteName ?? "screens.planner.route_name_fallback".tr(),
                          },
                        ),
                        style: const TextStyle(fontSize: 12, color: _textSecondary),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "${state.startDate} ~ ${state.endDate}",
                        style: const TextStyle(fontSize: 11, color: _textSecondary),
                      ),
                    ],
                  ),
                ),

              // 일정 타임라인
              if (state.schedule.isNotEmpty) ...[
                Row(
                  children: [
                    Text(
                      "screens.planner.schedule_title".tr(),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                    ),
                    const Spacer(),
                    Text(
                      "screens.planner.schedule_item_count".tr(
                        namedArgs: {"count": "${state.schedule.length}"},
                      ),
                      style: const TextStyle(fontSize: 12, color: _textSecondary),
                    ),
                  ],
                ),
                if (state.costSummary != null) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          "총 경비 ${state.costSummary!.tripTotal}",
                          style: const TextStyle(
                            color: Color(0xFF047857),
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      ...state.costSummary!.perDay.map(
                        (d) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            "Day${d.day} ${d.total}",
                            style: const TextStyle(fontSize: 11, color: _textSecondary),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                ...state.schedule.map((s) => _ScheduleCard(item: s)),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: state.saving ? null : ctrl.savePlan,
                  icon: const Icon(Icons.save),
                  label: Text(
                    state.saving
                        ? "screens.planner.msg_saving_plan".tr()
                        : "screens.planner.save_plan".tr(),
                  ),
                  style: FilledButton.styleFrom(backgroundColor: _primary),
                ),
                if (state.savedPlanId != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: OutlinedButton(
                      onPressed: () => context.push("/planner/schedule"),
                      child: Text("screens.planner.saved_goto_schedule".tr()),
                    ),
                  ),
              ],

              if (state.scheduleError != null)
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    state.scheduleError!,
                    style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12),
                  ),
                ),

              if (state.routesTriggered && state.routes.isEmpty && !state.routesLoading)
                Center(
                  child: Column(
                    children: [
                      const SizedBox(height: 32),
                      Text(dest.emoji, style: const TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      Text(
                        "screens.planner.dest_plan_cta".tr(namedArgs: {"name": plannerDestName(dest.slug)}),
                        style: const TextStyle(fontSize: 14, color: _textSecondary),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: ctrl.fetchRoutes,
                        icon: const Icon(Icons.auto_awesome),
                        label: Text("screens.planner.generate_route".tr()),
                        style: FilledButton.styleFrom(backgroundColor: _primary),
                      ),
                    ],
                  ),
                ),
            ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({
    required this.route,
    required this.selected,
    required this.onTap,
    this.expand = false,
  });
  final PlanRoute route;
  final bool selected;
  final VoidCallback onTap;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: expand ? double.infinity : 160,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [KroaddyColors.accent, KroaddyColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? _primary : Colors.grey.shade200, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: selected
                  ? _primary.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected ? Colors.white.withValues(alpha: 0.2) : _primaryLight,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                route.theme,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : _primary,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              route.name,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: selected ? Colors.white : _textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              route.description,
              style: TextStyle(
                fontSize: 11,
                color: selected ? Colors.white.withValues(alpha: 0.8) : _textSecondary,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.item});
  final ScheduleItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 10, left: 8),
            decoration: BoxDecoration(
              color: _primary,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _primaryLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          "DAY ${item.day}",
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          item.time,
                          style: const TextStyle(fontSize: 11, color: _textSecondary),
                        ),
                      ),
                      const Spacer(),
                      if ((item.estimatedCost ?? "").isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.estimatedCost!,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF047857),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.title,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.place,
                    style: const TextStyle(fontSize: 12, color: _primary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.description,
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
                  if (item.tips != null && item.tips!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("💡 ", style: TextStyle(fontSize: 12)),
                          Expanded(
                            child: Text(
                              item.tips!,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// USER CONTENT TAB
// ═══════════════════════════════════════════════════════════════
class _UserContentTab extends ConsumerStatefulWidget {
  const _UserContentTab();

  @override
  ConsumerState<_UserContentTab> createState() => _UserContentTabState();
}

class _UserContentTabState extends ConsumerState<_UserContentTab> {
  UserRoute? _detailRoute;
  bool _showUpload = false;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() => ref.read(userContentControllerProvider.notifier).loadFeed());
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  int? _myUserId() {
    final t = ref.read(authControllerProvider).accessToken;
    if (t == null || t.isEmpty) return null;
    return getAppUserIdFromToken(t) ?? getUserIdFromToken(t);
  }

  void _setMode(UserContentViewMode mode) {
    _searchCtrl.clear();
    ref.read(userContentControllerProvider.notifier).setViewMode(mode);
    ref.read(userContentControllerProvider.notifier).loadFeed();
  }

  void _search() {
    ref.read(userContentControllerProvider.notifier).setAppliedSearchNickname(_searchCtrl.text);
    ref.read(userContentControllerProvider.notifier).loadFeed();
  }

  void _clearSearch() {
    _searchCtrl.clear();
    ref.read(userContentControllerProvider.notifier).setAppliedSearchNickname("");
    ref.read(userContentControllerProvider.notifier).loadFeed();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);
    final myId = _myUserId();

    ref.listen<int>(
      userContentControllerProvider.select((s) => s.saveSuccessCount),
      (prev, next) {
        if (prev != null && next > prev) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("루트가 공유됐습니다! 🎉")),
          );
        }
      },
    );

    return Scaffold(
      backgroundColor: _bgPage,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "유저 콘텐츠",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: _textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            "여행자들이 공유한 추천 루트",
                            style: TextStyle(fontSize: 11, color: _textSecondary),
                          ),
                        ],
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () {
                          ref.read(userContentControllerProvider.notifier).resetUploadDraft();
                          setState(() => _showUpload = true);
                        },
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text("내 루트 업로드"),
                        style: FilledButton.styleFrom(
                          backgroundColor: _primary,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: SegmentedButton<UserContentViewMode>(
                          segments: const [
                            ButtonSegment(
                              value: UserContentViewMode.all,
                              label: Text("전체 루트", style: TextStyle(fontSize: 12)),
                              icon: Text("🌍"),
                            ),
                            ButtonSegment(
                              value: UserContentViewMode.mine,
                              label: Text("내 루트", style: TextStyle(fontSize: 12)),
                              icon: Text("👤"),
                            ),
                          ],
                          selected: {state.viewMode},
                          onSelectionChanged: (s) {
                            if (s.isEmpty) return;
                            if (s.first == UserContentViewMode.mine && myId == null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text("로그인 후 이용할 수 있습니다.")),
                              );
                              return;
                            }
                            _setMode(s.first);
                          },
                          style: ButtonStyle(
                            visualDensity: VisualDensity.compact,
                            foregroundColor: WidgetStateProperty.resolveWith((st) {
                              if (st.contains(WidgetState.selected)) return Colors.white;
                              return _textSecondary;
                            }),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (state.viewMode == UserContentViewMode.all)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _searchCtrl,
                            onSubmitted: (_) => _search(),
                            decoration: InputDecoration(
                              hintText: "닉네임으로 검색…",
                              hintStyle: const TextStyle(fontSize: 13),
                              prefixIcon: const Icon(Icons.search, size: 18, color: _textSecondary),
                              suffixIcon: _searchCtrl.text.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.close, size: 18),
                                      onPressed: _clearSearch,
                                    )
                                  : null,
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: _search,
                          style: FilledButton.styleFrom(
                            backgroundColor: _primaryLight,
                            foregroundColor: _primary,
                          ),
                          child: const Text("검색"),
                        ),
                      ],
                    ),
                  ),
                ),
              if (state.viewMode == UserContentViewMode.all && state.appliedSearchNickname.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            "\"${state.appliedSearchNickname}\" 닉네임 검색 결과",
                            style: const TextStyle(fontSize: 11, color: _primary, fontWeight: FontWeight.w600),
                          ),
                        ),
                        TextButton(
                          onPressed: _clearSearch,
                          child: const Text("전체 보기", style: TextStyle(fontSize: 11)),
                        ),
                      ],
                    ),
                  ),
                ),
              if (state.message.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: state.message.contains("실패") ? const Color(0xFFFEF2F2) : _primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        state.message,
                        style: TextStyle(
                          fontSize: 12,
                          color: state.message.contains("실패") ? Colors.red.shade800 : _primary,
                        ),
                      ),
                    ),
                  ),
                ),
              if (state.loading)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.68,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (_, _) => Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                      ),
                      childCount: 6,
                    ),
                  ),
                )
              else if (state.feed.isEmpty)
                SliverFillRemaining(
                  child: Center(
                    child: state.viewMode == UserContentViewMode.mine
                        ? Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text("🗺️", style: TextStyle(fontSize: 46)),
                              const SizedBox(height: 8),
                              const Text(
                                "아직 내가 올린 루트가 없습니다",
                                style: TextStyle(color: _textPrimary, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                "나만의 여행 루트를 공유해보세요!",
                                style: TextStyle(color: _textSecondary, fontSize: 12),
                              ),
                              const SizedBox(height: 10),
                              OutlinedButton(
                                onPressed: () {
                                  ref.read(userContentControllerProvider.notifier).resetUploadDraft();
                                  setState(() => _showUpload = true);
                                },
                                child: const Text("＋ 첫 루트 올리기"),
                              ),
                            ],
                          )
                        : Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text("👥", style: TextStyle(fontSize: 46)),
                              const SizedBox(height: 8),
                              const Text(
                                "아직 공유된 루트가 없습니다",
                                style: TextStyle(color: _textPrimary, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                "첫 번째로 루트를 공유해보세요!",
                                style: TextStyle(color: _textSecondary, fontSize: 12),
                              ),
                              const SizedBox(height: 10),
                              OutlinedButton(
                                onPressed: () {
                                  ref.read(userContentControllerProvider.notifier).resetUploadDraft();
                                  setState(() => _showUpload = true);
                                },
                                child: const Text("＋ 첫 루트 업로드"),
                              ),
                            ],
                          ),
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.68,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (_, i) {
                        final r = state.feed[i];
                        final isOwner = myId != null && r.userId == myId;
                        return _UserRouteCard(
                          route: r,
                          isOwner: isOwner,
                          onTap: () => setState(() => _detailRoute = r),
                          onLike: () => ctrl.likeRoute(r.id),
                          onDelete: isOwner ? () async {
                            await ctrl.deleteRoute(r.id);
                            if (_detailRoute?.id == r.id) {
                              setState(() => _detailRoute = null);
                            }
                          } : null,
                          onAuthorTap: () {
                            final uid = r.userId;
                            final nick = (r.nickname ?? "").trim();
                            if (uid == null && nick.isEmpty) return;
                            final q = <String, String>{};
                            if (uid != null) q["authorUserId"] = "$uid";
                            if (nick.isNotEmpty) q["authorName"] = nick;
                            context.push(Uri(path: "/tourstar", queryParameters: q).toString());
                          },
                        );
                      },
                      childCount: state.feed.length,
                    ),
                  ),
                ),
                if (state.hasMoreFeed)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Center(
                        child: OutlinedButton(
                          onPressed: state.loadingMore ? null : ctrl.loadMoreFeed,
                          child: state.loadingMore
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text("더 보기"),
                        ),
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          ),
          if (_detailRoute != null)
            _RouteDetailSheet(
              route: _detailRoute!,
              onClose: () => setState(() => _detailRoute = null),
            ),
          if (_showUpload)
            UserContentUploadSheet(
              onClose: () => setState(() => _showUpload = false),
            ),
        ],
      ),
    );
  }
}

class _UserRouteCard extends StatelessWidget {
  const _UserRouteCard({
    required this.route,
    required this.onTap,
    required this.onLike,
    required this.isOwner,
    this.onDelete,
    this.onAuthorTap,
  });

  final UserRoute route;
  final VoidCallback onTap;
  final VoidCallback onLike;
  final bool isOwner;
  final VoidCallback? onDelete;
  final VoidCallback? onAuthorTap;

  static const _grads = [
    [Color(0xFF8B5CF6), Color(0xFF4F46E5)],
    [Color(0xFFEC4899), Color(0xFFBE185D)],
    [Color(0xFFF59E0B), Color(0xFFEA580C)],
    [Color(0xFF14B8A6), Color(0xFF0891B2)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  @override
  Widget build(BuildContext context) {
    final tags = route.tags.take(3).toList();
    final grad = _grads[route.id.abs() % _grads.length];
    final liked = route.likedByMe;
    final nick = (route.nickname ?? "").trim();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            fit: StackFit.expand,
            children: [
              route.imageUrl != null
                  ? Image.network(
                      route.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _gradientFallback(grad),
                    )
                  : _gradientFallback(grad),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0.35, 1],
                    colors: [Colors.transparent, Color(0xCC000000)],
                  ),
                ),
              ),
              if (isOwner && onDelete != null)
                Positioned(
                  top: 10,
                  left: 10,
                  child: GestureDetector(
                    onTap: onDelete,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Icon(Icons.delete_outline, size: 14, color: Colors.white),
                    ),
                  ),
                ),
              Positioned(
                top: 10,
                right: 10,
                child: GestureDetector(
                  onTap: liked ? null : onLike,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: liked ? const Color(0xCCF43F5E) : Colors.black.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(liked ? "❤️" : "🤍", style: const TextStyle(fontSize: 11)),
                        const SizedBox(width: 4),
                        Text(
                          "${route.likes}",
                          style: const TextStyle(fontSize: 11, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 10,
                right: 10,
                bottom: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (tags.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: tags
                            .map(
                              (t) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  t.startsWith("#") ? t : "#$t",
                                  style: const TextStyle(fontSize: 10, color: Colors.white),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    const SizedBox(height: 6),
                    Text(
                      route.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "📍 ${route.location}",
                      style: const TextStyle(fontSize: 11, color: Colors.white70),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      route.description,
                      style: const TextStyle(fontSize: 11, color: Colors.white60),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (nick.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: () {
                          onAuthorTap?.call();
                        },
                        child: Row(
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                shape: BoxShape.circle,
                              ),
                              child: const Text("👤", style: TextStyle(fontSize: 9)),
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                nick,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  decoration: TextDecoration.underline,
                                  decorationColor: Colors.white70,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _gradientFallback(List<Color> grad) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: grad,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

/// 웹 `RouteDetailModal` — 내 일정에 추가 + 방문 날짜 선택
class _RouteDetailSheet extends ConsumerStatefulWidget {
  const _RouteDetailSheet({required this.route, required this.onClose});
  final UserRoute route;
  final VoidCallback onClose;

  @override
  ConsumerState<_RouteDetailSheet> createState() => _RouteDetailSheetState();
}

class _RouteDetailSheetState extends ConsumerState<_RouteDetailSheet> {
  static const _defaultDayTimes = ["10:00", "12:30", "15:00", "17:30", "19:00", "20:30"];

  bool _adding = false;
  bool _addDone = false;
  String? _addError;
  bool _datePickerOpen = false;
  late DateTime _tripDate;

  @override
  void initState() {
    super.initState();
    _tripDate = _dateOnly(DateTime.now());
  }

  @override
  void didUpdateWidget(covariant _RouteDetailSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.route.id != widget.route.id) {
      _adding = false;
      _addDone = false;
      _addError = null;
      _datePickerOpen = false;
      _tripDate = _dateOnly(DateTime.now());
    }
  }

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  String _iso(DateTime d) =>
      "${d.year.toString().padLeft(4, "0")}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}";

  int? _currentUserId() {
    final t = ref.read(authControllerProvider).accessToken;
    if (t == null || t.isEmpty) return null;
    return getAppUserIdFromToken(t) ?? getUserIdFromToken(t);
  }

  List<ScheduleItem> _userRouteToScheduleItems(String tripDate) {
    return widget.route.routeItems.asMap().entries.map((e) {
      final idx = e.key;
      final item = e.value;
      return ScheduleItem(
        day: 1,
        date: tripDate,
        time: _defaultDayTimes[idx % _defaultDayTimes.length],
        place: item.place,
        title: item.place,
        description: item.description,
        tips: item.tip.trim().isNotEmpty ? item.tip : null,
      );
    }).toList();
  }

  Future<void> _handleAddToMySchedule(String dateIso) async {
    final userId = _currentUserId();
    if (userId == null || widget.route.routeItems.isEmpty) return;
    if (!RegExp(r"^\d{4}-\d{2}-\d{2}$").hasMatch(dateIso)) return;

    setState(() {
      _adding = true;
      _addError = null;
    });
    try {
      await ref.read(plannerRepositoryProvider).savePlan(
            location: widget.route.location.trim().isEmpty ? "custom" : widget.route.location.trim(),
            routeName: widget.route.title.trim().isEmpty ? "공유 루트" : widget.route.title.trim(),
            startDate: dateIso,
            endDate: dateIso,
            schedule: _userRouteToScheduleItems(dateIso),
            userId: userId,
          );
      if (!mounted) return;
      setState(() {
        _addDone = true;
        _datePickerOpen = false;
        _adding = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _adding = false;
        _addError = e.toString();
      });
    }
  }

  Future<void> _pickTripDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _tripDate,
      firstDate: _dateOnly(DateTime.now()),
      lastDate: DateTime(DateTime.now().year + 2, 12, 31),
      locale: Localizations.localeOf(context),
    );
    if (picked != null && mounted) {
      setState(() => _tripDate = _dateOnly(picked));
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = widget.route;
    final userId = _currentUserId();
    final canAdd = userId != null && route.routeItems.isNotEmpty;

    return GestureDetector(
      onTap: widget.onClose,
      child: Container(
        color: Colors.black54,
        child: GestureDetector(
          onTap: () {},
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560, maxHeight: 760),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    Column(
                      children: [
                        SizedBox(
                          height: 210,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(20),
                              topRight: Radius.circular(20),
                            ),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                if (route.imageUrl != null)
                                  Image.network(
                                    route.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) => Container(
                                      decoration: const BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [KroaddyColors.primary, Color(0xFFEC4899)],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        ),
                                      ),
                                    ),
                                  )
                                else
                                  Container(
                                    decoration: const BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [KroaddyColors.primary, Color(0xFFEC4899)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                    ),
                                  ),
                                const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [Colors.transparent, Color(0xAA000000)],
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 12,
                                  right: 12,
                                  child: IconButton(
                                    onPressed: widget.onClose,
                                    style: IconButton.styleFrom(
                                      backgroundColor: Colors.black.withValues(alpha: 0.3),
                                      foregroundColor: Colors.white,
                                    ),
                                    icon: const Icon(Icons.close),
                                  ),
                                ),
                                Positioned(
                                  top: 12,
                                  left: 12,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.3),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      "❤️ ${route.likes}",
                                      style: const TextStyle(color: Colors.white, fontSize: 12),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 16,
                                  right: 16,
                                  bottom: 14,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (route.tags.isNotEmpty)
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 6,
                                          children: route.tags
                                              .map(
                                                (t) => Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: Colors.white.withValues(alpha: 0.22),
                                                    borderRadius: BorderRadius.circular(999),
                                                  ),
                                                  child: Text(
                                                    t.startsWith("#") ? t : "#$t",
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                        ),
                                      const SizedBox(height: 6),
                                      Text(
                                        route.title,
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        "📍 ${route.location}",
                                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Expanded(
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
                            children: [
                              Text(
                                route.description,
                                style: const TextStyle(fontSize: 13, color: _textSecondary, height: 1.4),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                "루트",
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: _textSecondary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ...route.routeItems.asMap().entries.map((e) {
                                final idx = e.key;
                                final item = e.value;
                                return Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Column(
                                      children: [
                                        Container(
                                          width: 18,
                                          height: 18,
                                          decoration: const BoxDecoration(
                                            color: Color(0xFFD8B4FE),
                                            shape: BoxShape.circle,
                                          ),
                                          alignment: Alignment.center,
                                          child: Text(
                                            "${idx + 1}",
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: Color(0xFF6D28D9),
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                        if (idx < route.routeItems.length - 1)
                                          Container(
                                            width: 2,
                                            height: 34,
                                            color: const Color(0xFFE9D5FF),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Container(
                                        margin: const EdgeInsets.only(bottom: 10),
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF9FAFB),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(color: const Color(0xFFE5E7EB)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              "📍 ${item.place}",
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: _textPrimary,
                                              ),
                                            ),
                                            if (item.description.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.only(top: 4),
                                                child: Text(
                                                  item.description,
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: _textSecondary,
                                                  ),
                                                ),
                                              ),
                                            if (item.tip.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.only(top: 6),
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFFEF3C7),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Text(
                                                    "💡 ${item.tip}",
                                                    style: const TextStyle(
                                                      fontSize: 11,
                                                      color: Color(0xFF92400E),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                );
                              }),
                            ],
                          ),
                        ),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            border: Border(top: BorderSide(color: Colors.grey.shade200)),
                            borderRadius: const BorderRadius.only(
                              bottomLeft: Radius.circular(20),
                              bottomRight: Radius.circular(20),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_addError != null)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    _addError!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontSize: 12, color: Colors.red),
                                  ),
                                ),
                              if (_addDone)
                                Column(
                                  children: [
                                    const Text(
                                      "✅ 내 일정에 추가되었습니다",
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF047857),
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    FilledButton(
                                      onPressed: () {
                                        widget.onClose();
                                        context.push("/planner/schedule");
                                      },
                                      style: FilledButton.styleFrom(
                                        backgroundColor: const Color(0xFF4F46E8),
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                      child: const Text("일정 관리로 이동"),
                                    ),
                                  ],
                                )
                              else
                                FilledButton.icon(
                                  onPressed: (!canAdd || _adding)
                                      ? null
                                      : () {
                                          setState(() {
                                            _tripDate = _dateOnly(DateTime.now());
                                            _datePickerOpen = true;
                                          });
                                        },
                                  style: FilledButton.styleFrom(
                                    backgroundColor: _primary,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  icon: const Icon(Icons.calendar_month_outlined, size: 20),
                                  label: const Text("내 일정에 추가", style: TextStyle(fontWeight: FontWeight.w600)),
                                ),
                              if (userId == null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    "로그인 후 이용할 수 있습니다.",
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                  ),
                                )
                              else if (route.routeItems.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    "저장할 장소가 없습니다.",
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (_datePickerOpen && !_addDone)
                      Positioned.fill(
                        child: GestureDetector(
                          onTap: _adding ? null : () => setState(() => _datePickerOpen = false),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.4),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            alignment: Alignment.center,
                            child: GestureDetector(
                              onTap: () {},
                              child: Material(
                                borderRadius: BorderRadius.circular(16),
                                color: Colors.white,
                                elevation: 8,
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 340),
                                  child: Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        const Text(
                                          "언제 다녀오실 예정인가요?",
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: _textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          "선택한 날짜가 일정에 반영됩니다.",
                                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                        ),
                                        const SizedBox(height: 16),
                                        const Text(
                                          "방문 날짜",
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: _textSecondary,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        OutlinedButton.icon(
                                          onPressed: _adding ? null : _pickTripDate,
                                          icon: const Icon(Icons.edit_calendar_outlined, size: 18),
                                          label: Text(
                                            _iso(_tripDate),
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: OutlinedButton(
                                                onPressed: _adding
                                                    ? null
                                                    : () => setState(() => _datePickerOpen = false),
                                                child: const Text("취소"),
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: FilledButton(
                                                onPressed: _adding
                                                    ? null
                                                    : () => _handleAddToMySchedule(_iso(_tripDate)),
                                                style: FilledButton.styleFrom(backgroundColor: _primary),
                                                child: _adding
                                                    ? const SizedBox(
                                                        height: 20,
                                                        width: 20,
                                                        child: CircularProgressIndicator(
                                                          strokeWidth: 2,
                                                          color: Colors.white,
                                                        ),
                                                      )
                                                    : const Text("이 날짜로 추가"),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}


// ═══════════════════════════════════════════════════════════════
// K-CONTENT TAB
// ═══════════════════════════════════════════════════════════════
// ── K-Content 데이터 ─────────────────────────────────────────
class _KItem {
  const _KItem(this.id, this.title, this.description, this.gradient);
  final String id;
  final String title;
  final String description;
  final List<Color> gradient;
}

/// K-FOOD 플래너 행: id·그라데이션만 상수로 두고, 제목·설명은 `screens.k_content.fallback.kfood.*` (웹 `planner.kcontent.fallback.kfood`)
class _KFoodRowSpec {
  const _KFoodRowSpec(this.id, this.gradient);
  final String id;
  final List<Color> gradient;
}

const _kpopItems = [
  _KItem("KPOP_01", "HYBE Building", "HYBE Insight museum and label headquarters.", [Color(0xFFFF4D6D), Color(0xFFD63384)]),
  _KItem("KPOP_02", "SM Entertainment", "SM Town and SM Entertainment building.", [KroaddyColors.primary, Color(0xFF9333EA)]),
  _KItem("KPOP_03", "Hongdae K-Pop Street", "Street performances, K-Pop stores.", [Color(0xFFD63384), Color(0xFFE11D74)]),
  _KItem("KPOP_04", "K-Pop Store", "Official albums, merch, and photo cards.", [Color(0xFF4F46E5), KroaddyColors.primary]),
];

const _kdramaItems = [
  _KItem("KDRAMA_01", "Goblin Filming Location", "Famous drama shooting spots.", [Color(0xFFF59E0B), Color(0xFFEA580C)]),
  _KItem("KDRAMA_02", "Itaewon Class Street", "DanBam and the streets of the drama.", [Color(0xFF10B981), Color(0xFF0D9488)]),
  _KItem("KDRAMA_03", "Namsan Tower", "Locks of love and panoramic Seoul.", [Color(0xFF0EA5E9), Color(0xFF3B82F6)]),
  _KItem("KDRAMA_04", "Bukchon Hanok Village", "Traditional hanok alleys.", [Color(0xFFD97706), Color(0xFFE11D48)]),
];

/// 웹 `K_CONTENT_KFOOD_FALLBACK_ITEMS` (`constants.ts`) — 동일 id·그라데이션 톤; 카피는 i18n
const _kfoodRowSpecs = [
  _KFoodRowSpec("KF_MARKET", [Color(0xFFF59E0B), Color(0xFFEA580C)]),
  _KFoodRowSpec("KF_CAFE", [Color(0xFFF43F5E), Color(0xFFD946EF)]),
  _KFoodRowSpec("KF_CONVENIENCE", [Color(0xFFA3E635), Color(0xFF10B981), Color(0xFF7C3AED)]),
];

List<_KItem> _localizedKfoodRowItems() {
  return _kfoodRowSpecs
      .map(
        (s) => _KItem(
          s.id,
          "screens.k_content.fallback.kfood.${s.id}.title".tr(),
          "screens.k_content.fallback.kfood.${s.id}.description".tr(),
          s.gradient,
        ),
      )
      .toList();
}

const _kbeautyItems = [
  _KItem("KBEAUTY_01", "Olive Young", "K-Beauty flagship. Skincare and makeup.", [Color(0xFFEC4899), Color(0xFFE11D48)]),
  _KItem("KBEAUTY_02", "Myeongdong Beauty Street", "Density of beauty stores and brands.", [Color(0xFFD946EF), Color(0xFFEC4899)]),
  _KItem("KBEAUTY_03", "K-Beauty Store", "Sheet masks, serums, cushion compacts.", [KroaddyColors.primary, Color(0xFF9333EA)]),
  _KItem("KBEAUTY_04", "Skincare Experience Shop", "Facials and personalized skincare.", [Color(0xFFFB7185), Color(0xFFEC4899)]),
];

/// 웹 `k-content/page.tsx` 의 그라데이션 풀과 동일한 역할
const _kpopGradientPool = <List<Color>>[
  [Color(0xFFFF4D6D), Color(0xFFD63384)],
  [KroaddyColors.primary, Color(0xFF9333EA)],
  [Color(0xFFD63384), Color(0xFFE11D74)],
  [Color(0xFF4F46E5), KroaddyColors.primary],
  [Color(0xFFF43F5E), Color(0xFFEC4899)],
  [Color(0xFF10B981), Color(0xFF0D9488)],
  [Color(0xFF0EA5E9), Color(0xFF3B82F6)],
  [Color(0xFFF59E0B), Color(0xFFEA580C)],
];

const _kdramaGradientPool = <List<Color>>[
  [Color(0xFFF59E0B), Color(0xFFEA580C)],
  [Color(0xFF10B981), Color(0xFF0D9488)],
  [Color(0xFF0EA5E9), Color(0xFF3B82F6)],
  [Color(0xFFD97706), Color(0xFFE11D48)],
  [Color(0xFFA855F7), Color(0xFF6366F1)],
  [Color(0xFFF472B6), Color(0xFFDB2777)],
  [Color(0xFF34D399), Color(0xFF059669)],
  [Color(0xFF60A5FA), Color(0xFF2563EB)],
];

void _shuffleKItems(List<_KItem> list) {
  final r = Random();
  for (var i = list.length - 1; i > 0; i--) {
    final j = r.nextInt(i + 1);
    final t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
}

/// 백엔드 `GET /api/v1/k-content/packages` 한 카테고리 분량 → 카드 모델 (웹 `mapKpopPackages` / `mapDramaMoviePackages` 대응)
List<_KItem> _mapKContentApiToItems(
  List<Map<String, dynamic>> raw,
  List<List<Color>> gradientPool,
  bool preferKorean,
) {
  final out = <_KItem>[];
  for (var i = 0; i < raw.length; i++) {
    final p = raw[i];
    final id = p["package_id"]?.toString() ?? "";
    if (id.isEmpty) continue;
    final titleKo = p["title_ko"]?.toString();
    final titleEn = p["title_en"]?.toString();
    final title = preferKorean
        ? ((titleKo != null && titleKo.isNotEmpty) ? titleKo : (titleEn ?? ""))
        : ((titleEn != null && titleEn.isNotEmpty) ? titleEn : (titleKo ?? ""));
    final tags = p["tags"]?.toString();
    final descEn = p["description_en"]?.toString();
    final description = preferKorean
        ? ((tags != null && tags.isNotEmpty) ? tags : (descEn ?? ""))
        : ((descEn != null && descEn.isNotEmpty) ? descEn : (tags ?? ""));
    out.add(_KItem(id, title, description, gradientPool[i % gradientPool.length]));
  }
  return out;
}

class _KContentTab extends ConsumerStatefulWidget {
  const _KContentTab();

  @override
  ConsumerState<_KContentTab> createState() => _KContentTabState();
}

class _KContentTabState extends ConsumerState<_KContentTab> {
  String? _heroImageUrl;
  final Map<String, String> _cardImageMap = <String, String>{};
  bool _loadingImages = false;
  bool _loadingPackages = true;
  List<_KItem> _kpopRow = [];
  List<_KItem> _kdramaRow = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    await _loadPackageRows();
    if (!mounted) return;
    await _loadBannerAndCardImages();
  }

  /// 웹 `fetchKContentPackages('KPOP'|'KDRAMA'|'KMOVIE')` + 드라마·영화 행 병합
  Future<void> _loadPackageRows() async {
    final repo = ref.read(kContentRepositoryProvider);
    final isKo = context.locale.languageCode == "ko";
    setState(() => _loadingPackages = true);
    try {
      final bundles = await Future.wait([
        repo.fetchPackages(category: "KPOP"),
        repo.fetchPackages(category: "KDRAMA"),
        repo.fetchPackages(category: "KMOVIE"),
      ]);
      var kpop = _mapKContentApiToItems(bundles[0], _kpopGradientPool, isKo);
      var kdrama = <_KItem>[
        ..._mapKContentApiToItems(bundles[1], _kdramaGradientPool, isKo),
        ..._mapKContentApiToItems(bundles[2], _kdramaGradientPool, isKo),
      ];
      if (kpop.isEmpty) kpop = List<_KItem>.from(_kpopItems);
      if (kdrama.isEmpty) kdrama = List<_KItem>.from(_kdramaItems);
      _shuffleKItems(kpop);
      _shuffleKItems(kdrama);
      if (!mounted) return;
      setState(() {
        _kpopRow = kpop;
        _kdramaRow = kdrama;
        _loadingPackages = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _kpopRow = List<_KItem>.from(_kpopItems);
        _kdramaRow = List<_KItem>.from(_kdramaItems);
        _loadingPackages = false;
      });
    }
  }

  Future<void> _loadBannerAndCardImages() async {
    if (_loadingImages) return;
    setState(() => _loadingImages = true);
    final repo = ref.read(kContentRepositoryProvider);
    try {
      final banner = await repo.fetchBannerImages();
      final nextCardMap = <String, String>{};
      final ids = <String>{
        ..._kpopRow.map((e) => e.id),
        ..._kdramaRow.map((e) => e.id),
        ..._kfoodRowSpecs.map((e) => e.id),
        ..._kbeautyItems.map((e) => e.id),
      };
      for (final id in ids) {
        final imgs = await repo.fetchPackageImages(id);
        final picked = repo.pickRandomImage(imgs);
        if (picked.isNotEmpty) nextCardMap[id] = picked;
      }
      if (!mounted) return;
      setState(() {
        _heroImageUrl = banner.isNotEmpty ? repo.pickRandomImage(banner) : null;
        _cardImageMap
          ..clear()
          ..addAll(nextCardMap);
      });
    } finally {
      if (mounted) setState(() => _loadingImages = false);
    }
  }

  String get _heroCtaTargetId =>
      _kpopRow.isNotEmpty ? _kpopRow.first.id : _kpopItems.first.id;

  @override
  Widget build(BuildContext context) {
    if (_loadingPackages && _kpopRow.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 12),
            Text(
              "screens.k_content.tab_loading".tr(),
              style: const TextStyle(fontSize: 13, color: _textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView(
      children: [
        // ── 히어로 배너 ────────────────────────────────────────
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [KroaddyColors.primary, Color(0xFFEC4899)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            image: _heroImageUrl != null
                ? DecorationImage(
                    image: NetworkImage(_heroImageUrl!),
                    fit: BoxFit.cover,
                    onError: (_, _) {},
                  )
                : null,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: _heroImageUrl != null ? Colors.black.withValues(alpha: 0.25) : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "screens.k_content.hero_title".tr(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "screens.k_content.hero_subtitle".tr(),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => context.push("/planner/k-content/$_heroCtaTargetId"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: KroaddyColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    elevation: 0,
                  ),
                  child: Text(
                    _loadingImages ? "common.loading".tr() : "screens.k_content.hero_cta".tr(),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
        // ── 콘텐츠 행 (웹과 동일: K-POP / K-DRAMA·K-MOVIE 병합 / K-FOOD·K-BEAUTY 폴백) ──
        _KContentRow(
          title: "screens.k_content.row_kpop".tr(),
          items: _kpopRow,
          cardImageMap: _cardImageMap,
        ),
        _KContentRow(
          title: "screens.k_content.row_kdrama".tr(),
          items: _kdramaRow,
          cardImageMap: _cardImageMap,
        ),
        _KContentRow(
          title: "screens.k_content.row_kfood".tr(),
          items: _localizedKfoodRowItems(),
          cardImageMap: _cardImageMap,
        ),
        _KContentRow(
          title: "screens.k_content.row_kbeauty".tr(),
          items: _kbeautyItems,
          cardImageMap: _cardImageMap,
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _KContentRow extends StatelessWidget {
  const _KContentRow({
    required this.title,
    required this.items,
    required this.cardImageMap,
  });
  final String title;
  final List<_KItem> items;
  final Map<String, String> cardImageMap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: 0.5,
            ),
          ),
        ),
        SizedBox(
          height: 140,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final item = items[i];
              return GestureDetector(
                onTap: () => context.push("/planner/k-content/${item.id}"),
                child: Container(
                  width: 160,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: item.gradient,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    image: cardImageMap[item.id] != null
                        ? DecorationImage(
                            image: NetworkImage(cardImageMap[item.id]!),
                            fit: BoxFit.cover,
                            onError: (_, _) {},
                          )
                        : null,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Spacer(),
                      Text(
                        item.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.description,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 11,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── 이동수단 선택 버튼 ─────────────────────────────────────────
class _TransportButton extends StatelessWidget {
  const _TransportButton({
    required this.label,
    required this.mode,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  final String label;
  final String mode;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: disabled ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? _primary : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? _primary : Colors.grey.shade300,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                color: selected ? Colors.white : const Color(0xFF6B7280),
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
