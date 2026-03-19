import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/router/main_shell.dart";
import "../data/planner_models.dart";
import "../data/user_content_models.dart";
import "state/planner_controller.dart";
import "state/user_content_controller.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

// ── 여행지 데이터 모델 ─────────────────────────────────────────
class _Destination {
  const _Destination(this.slug, this.name, this.emoji, {
    this.highlights = const [],
    this.popular = false,
  });
  final String slug;
  final String name;
  final String emoji;
  final List<String> highlights;
  final bool popular;
}

class _DestGroup {
  const _DestGroup(this.label, this.subLabel, this.items);
  final String label;
  final String subLabel;
  final List<_Destination> items;
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

// ── 광역시 바로가기 ────────────────────────────────────────────
const _metroCities = [
  _Destination("jongno",    "서울",  "🏙️", highlights: ["경복궁", "홍대", "한강공원"],        popular: true),
  _Destination("busan",     "부산",  "🌊", highlights: ["해운대", "감천마을", "자갈치시장"],   popular: true),
  _Destination("daegu",     "대구",  "🌹", highlights: ["동성로", "김광석거리", "수성못"],     popular: true),
  _Destination("incheon",   "인천",  "✈️", highlights: ["송도", "강화도", "차이나타운"],       popular: true),
  _Destination("gwangju",   "광주",  "🎨", highlights: ["국립아시아문화전당", "양림동"],       popular: true),
  _Destination("daejeon",   "대전",  "🍞", highlights: ["성심당", "엑스포공원", "유성온천"],   popular: true),
  _Destination("ulsan",     "울산",  "🐋", highlights: ["간절곶", "대왕암", "태화강"]),
  _Destination("sejong",    "세종",  "🌿", highlights: ["세종호수공원", "국립수목원"]),
];

// ── Netflix 스타일 지역 그룹 데이터 ─────────────────────────────
final _metroGroups = [
  _DestGroup("서울", "권역별 대표 지역", const [
    _Destination("jongno",    "종로·광화문", "🏛️", highlights: ["경복궁", "청와대", "인사동"],      popular: true),
    _Destination("myeongdong","명동·을지로",  "🛍️", highlights: ["명동성당", "을지로골목"],          popular: true),
    _Destination("yongsan",   "용산·이태원",  "🌍", highlights: ["국립중앙박물관", "이태원"],         popular: true),
    _Destination("gangnam",   "강남·서초",   "💼", highlights: ["코엑스", "압구정로데오"],           popular: true),
    _Destination("jamsil",    "잠실·송파",   "🎡", highlights: ["롯데월드", "올림픽공원"],           popular: true),
    _Destination("seongsu",   "성수·한남",   "☕", highlights: ["성수카페거리", "한남동 갤러리"],     popular: true),
    _Destination("hongdae",   "홍대·마포",   "🎸", highlights: ["홍대클럽", "연남동"],              popular: true),
    _Destination("bukchon",   "북촌·삼청",   "🏮", highlights: ["북촌한옥마을", "삼청동카페"],       popular: true),
    _Destination("nowon",     "노원·도봉",   "⛰️", highlights: ["수락산", "도봉산"]),
  ]),
  _DestGroup("부산", "부산광역시", const [
    _Destination("haeundae",  "해운대",       "🏖️", highlights: ["해운대해수욕장", "동백섬"],         popular: true),
    _Destination("gwangalli", "광안리·수영",  "🌉", highlights: ["광안대교", "광안리해수욕장"],        popular: true),
    _Destination("gijang",    "기장",         "🦀", highlights: ["죽성드림성당", "아쿠아리움"],        popular: true),
    _Destination("nampo",     "남포·중구",    "🎬", highlights: ["자갈치시장", "BIFF광장"],           popular: true),
    _Destination("gamcheon",  "감천문화마을",  "🏘️", highlights: ["감천문화마을", "하늘마루"],          popular: true),
    _Destination("seomyeon",  "서면·부전",    "🛍️", highlights: ["서면거리", "부전시장"]),
    _Destination("yeongdo",   "영도",         "⚓", highlights: ["태종대", "흰여울문화마을"]),
    _Destination("geumjeong", "금정·온천장",  "♨️", highlights: ["금정산성", "범어사"]),
    _Destination("dadaepo",   "사하·다대포",  "🌅", highlights: ["다대포해수욕장", "낙동강 하구"]),
  ]),
  _DestGroup("대구", "대구광역시", const [
    _Destination("dongseongno","동성로·중구",  "🛍️", highlights: ["동성로", "서문시장"],              popular: true),
    _Destination("gimgwangseok","김광석거리",  "🎵", highlights: ["김광석거리", "방천시장"],           popular: true),
    _Destination("suseongmot", "수성못·범어",  "🦢", highlights: ["수성못", "수성유원지"],             popular: true),
    _Destination("palgongsan", "팔공산",       "⛰️", highlights: ["동화사", "갓바위"],                popular: true),
    _Destination("dalseong",   "비슬산·달성",  "🌸", highlights: ["비슬산 참꽃", "달성습지"],          popular: true),
  ]),
  _DestGroup("울산", "울산광역시", const [
    _Destination("ganjeolgot", "간절곶",       "🌅", highlights: ["간절곶등대", "새해 일출"],          popular: true),
    _Destination("daewangam",  "대왕암",       "🐉", highlights: ["대왕암공원", "일산해수욕장"],        popular: true),
    _Destination("taehwagang", "태화강",       "🐦", highlights: ["태화강국가정원", "십리대숲"]),
    _Destination("bangudae",   "반구대",       "🦣", highlights: ["반구대 암각화"]),
  ]),
];

final _provinceGroups = [
  _DestGroup("경기 북부", "고양·파주·가평·양평 등", const [
    _Destination("goyang",      "고양",     "🌸", highlights: ["킨텍스", "행주산성"]),
    _Destination("paju",        "파주",     "📚", highlights: ["헤이리마을", "임진각"],              popular: true),
    _Destination("namyangju",   "남양주",   "🌿", highlights: ["두물머리", "다산길"],               popular: true),
    _Destination("gapyeong",    "가평",     "🚣", highlights: ["남이섬", "자라섬"],                 popular: true),
    _Destination("yangpyeong",  "양평",     "☕", highlights: ["두물머리", "카페거리"],             popular: true),
    _Destination("pocheon",     "포천",     "🌳", highlights: ["산정호수", "허브아일랜드"],          popular: true),
    _Destination("uijeongbu",   "의정부",   "🍖", highlights: ["부대찌개거리", "회룡사"]),
    _Destination("yangju",      "양주",     "🌻", highlights: ["나리공원"]),
    _Destination("dongducheon", "동두천",   "🎶", highlights: ["소요산"]),
    _Destination("gimpo",       "김포",     "🌾", highlights: ["아라뱃길"]),
    _Destination("guri",        "구리",     "🌸", highlights: ["한강시민공원", "아차산"]),
  ]),
  _DestGroup("경기 남부", "수원·용인·성남·이천 등", const [
    _Destination("suwon",       "수원",     "🏯", highlights: ["화성행궁", "행리단길"],              popular: true),
    _Destination("yongin",      "용인",     "🎡", highlights: ["에버랜드", "한국민속촌"],            popular: true),
    _Destination("icheon",      "이천",     "🍚", highlights: ["도자기마을"],                       popular: true),
    _Destination("seongnam",    "성남",     "🏢", highlights: ["판교테크노밸리"]),
    _Destination("hanam",       "하남",     "🛍️", highlights: ["스타필드하남"]),
    _Destination("hwaseong",    "화성",     "🌅", highlights: ["궁평항", "제부도"]),
    _Destination("ansan",       "안산",     "🎨", highlights: ["대부도", "시화호"]),
    _Destination("pyeongtaek",  "평택",     "🚢", highlights: ["평택항"]),
    _Destination("yeoju",       "여주",     "👑", highlights: ["세종대왕릉", "신륵사"]),
    _Destination("gunpo",       "군포",     "🌲", highlights: ["수리산"]),
    _Destination("anyang",      "안양",     "⛰️", highlights: ["삼성산"]),
    _Destination("anseong",     "안성",     "🎭", highlights: ["안성맞춤랜드"]),
    _Destination("siheung",     "시흥",     "🦢", highlights: ["갯골생태공원", "오이도"]),
    _Destination("osan",        "오산",     "🏛️", highlights: ["물향기수목원"]),
  ]),
  _DestGroup("강원도", "강원특별자치도", const [
    _Destination("gangneung",   "강릉",     "☕", highlights: ["경포대", "안목커피거리", "오죽헌"],   popular: true),
    _Destination("sokcho",      "속초",     "🏔️", highlights: ["설악산", "중앙시장"],               popular: true),
    _Destination("chuncheon",   "춘천",     "🍗", highlights: ["남이섬", "닭갈비골목"],              popular: true),
    _Destination("yangyang",    "양양",     "🏄", highlights: ["서피비치", "낙산사"],                popular: true),
    _Destination("pyeongchang", "평창",     "🐑", highlights: ["대관령양떼목장", "오대산"],           popular: true),
    _Destination("wonju",       "원주",     "🎨", highlights: ["뮤지엄산", "소금산출렁다리"],         popular: true),
    _Destination("donghae",     "동해",     "🌊", highlights: ["망상해변", "추암촛대바위"]),
    _Destination("samcheok",    "삼척",     "🐉", highlights: ["해신당공원", "죽서루"]),
    _Destination("taebaek",     "태백",     "⛏️", highlights: ["태백산", "용연동굴"]),
    _Destination("jeongseon",   "정선",     "⛰️", highlights: ["민둥산", "레일바이크"]),
    _Destination("inje",        "인제",     "🦌", highlights: ["내린천", "자작나무숲"]),
  ]),
  _DestGroup("충청북도", "청주·충주·제천·단양", const [
    _Destination("danyang",     "단양",     "🪂", highlights: ["단양팔경", "도담삼봉", "패러글라이딩"], popular: true),
    _Destination("jecheon",     "제천",     "🌸", highlights: ["청풍호", "의림지"],                  popular: true),
    _Destination("cheongju",    "청주",     "📜", highlights: ["고인쇄박물관", "상당산성"]),
    _Destination("chungju",     "충주",     "🌊", highlights: ["충주호", "탄금대"]),
  ]),
  _DestGroup("충청남도", "공주·부여·보령·태안 등", const [
    _Destination("gongju",      "공주",     "👑", highlights: ["공산성", "무령왕릉"],                popular: true),
    _Destination("buyeo",       "부여",     "🏛️", highlights: ["부소산성", "낙화암"],               popular: true),
    _Destination("boryeong",    "보령",     "🌊", highlights: ["머드축제", "대천해수욕장"],           popular: true),
    _Destination("taean",       "태안",     "🐚", highlights: ["안면도", "꽃지해수욕장"],            popular: true),
    _Destination("asan",        "아산",     "♨️", highlights: ["온양온천", "현충사"]),
    _Destination("cheonan",     "천안",     "🍓", highlights: ["독립기념관"]),
    _Destination("seosan",      "서산",     "🦢", highlights: ["서산마애삼존불", "간월암"]),
    _Destination("nonsan",      "논산",     "🍓", highlights: ["관촉사"]),
    _Destination("dangjin",     "당진",     "🌅", highlights: ["왜목마을"]),
  ]),
  _DestGroup("전북", "전북특별자치도", const [
    _Destination("jeonju",      "전주",     "🏮", highlights: ["한옥마을", "막걸리골목"],            popular: true),
    _Destination("gunsan",      "군산",     "🚢", highlights: ["근대문화유산거리", "이성당"],          popular: true),
    _Destination("namwon",      "남원",     "💕", highlights: ["광한루원", "지리산"]),
    _Destination("iksan",       "익산",     "🏛️", highlights: ["미륵사지", "왕궁리유적"]),
    _Destination("jeongeup",    "정읍",     "🌸", highlights: ["내장산"]),
    _Destination("gimje",       "김제",     "🌾", highlights: ["지평선축제"]),
  ]),
  _DestGroup("전라남도", "여수·순천·목포·담양 등", const [
    _Destination("yeosu",       "여수",     "🦀", highlights: ["해상케이블카", "오동도", "밤바다"],   popular: true),
    _Destination("suncheon",    "순천",     "🦢", highlights: ["순천만국가정원", "낙안읍성"],          popular: true),
    _Destination("mokpo",       "목포",     "🌉", highlights: ["해상케이블카", "유달산"],             popular: true),
    _Destination("damyang",     "담양",     "🎋", highlights: ["죽녹원", "메타세쿼이아길"],           popular: true),
    _Destination("boseong",     "보성",     "🍵", highlights: ["녹차밭"],                           popular: true),
    _Destination("wando",       "완도",     "🐟", highlights: ["청산도"]),
    _Destination("gwangyang",   "광양",     "🌸", highlights: ["매화마을"]),
    _Destination("naju",        "나주",     "🍐", highlights: ["영산강"]),
  ]),
  _DestGroup("경상북도", "경주·포항·안동 등", const [
    _Destination("gyeongju",    "경주",     "🌸", highlights: ["황리단길", "첨성대", "불국사"],        popular: true),
    _Destination("andong",      "안동",     "🎭", highlights: ["하회마을", "도산서원"],               popular: true),
    _Destination("pohang",      "포항",     "🌅", highlights: ["호미곶", "스페이스워크"],             popular: true),
    _Destination("mungyeong",   "문경",     "⛩️", highlights: ["문경새재"],                         popular: true),
    _Destination("yeongju",     "영주",     "🍎", highlights: ["부석사", "소수서원"]),
    _Destination("gimcheon",    "김천",     "🍑", highlights: ["직지사", "황악산"]),
    _Destination("yeongcheon",  "영천",     "🍇", highlights: ["영천와인", "보현산천문과학관"]),
    _Destination("gyeongsan",   "경산",     "🌿", highlights: ["반곡지", "갓바위"]),
    _Destination("sangju",      "상주",     "🚴", highlights: ["상주자전거박물관"]),
  ]),
  _DestGroup("경상남도", "통영·거제·진주·창원 등", const [
    _Destination("tongyeong",   "통영",     "⛵", highlights: ["루지", "동피랑마을", "다도해"],        popular: true),
    _Destination("geoje",       "거제",     "🌬️", highlights: ["바람의언덕", "외도", "해금강"],       popular: true),
    _Destination("namhae",      "남해",     "🇩🇪", highlights: ["독일마을", "다랭이마을"],             popular: true),
    _Destination("jinju",       "진주",     "🪔", highlights: ["유등축제", "진주성"],                popular: true),
    _Destination("hapcheon",    "합천",     "🌸", highlights: ["해인사", "황매산"]),
    _Destination("changwon",    "창원",     "🌸", highlights: ["진해군항제"]),
    _Destination("miryang",     "밀양",     "🌿", highlights: ["얼음골", "영남루"]),
    _Destination("gimhae",      "김해",     "👑", highlights: ["가야테마파크"]),
    _Destination("yangsan",     "양산",     "🏔️", highlights: ["통도사"]),
    _Destination("hadong",      "하동",     "🍵", highlights: ["화개장터", "쌍계사"],                popular: true),
  ]),
  _DestGroup("제주도", "제주특별자치도", const [
    _Destination("jeju",        "제주",     "🌺", highlights: ["한라산", "성산일출봉", "협재해변"],    popular: true),
    _Destination("seogwipo",    "서귀포",   "🌊", highlights: ["천지연폭포", "올레길", "중문해변"],   popular: true),
  ]),
];

// ── 진입점 ─────────────────────────────────────────────────────
class PlannerPage extends ConsumerWidget {
  const PlannerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: _bgPage,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.menu, color: _textPrimary),
            onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
          ),
          title: const Text(
            "여행플래너",
            style: TextStyle(
              color: _textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          bottom: const TabBar(
            labelColor: _primary,
            unselectedLabelColor: _textSecondary,
            indicatorColor: _primary,
            indicatorWeight: 3,
            tabs: [
              Tab(text: "스탠다드"),
              Tab(text: "유저 루트"),
              Tab(text: "K-콘텐츠"),
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
    ctrl.fetchRoutes();
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

  @override
  Widget build(BuildContext context) {
    if (_step == 0) {
      return _DestinationSelector(onSelect: _selectDest, onGroupTap: _onGroupTap);
    }
    if (_step == 1 && _drillGroup != null) {
      return _DrillDownScreen(
        group: _drillGroup!,
        onSelect: _selectDest,
        onBack: _backToSelect,
      );
    }
    return _PlannerWorkspace(dest: _picked!, onBack: _backToDrill);
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
        ..._metroCities,
        ..._metroGroups.expand((g) => g.items),
        ..._provinceGroups.expand((g) => g.items),
      ];

  List<_Destination> get _filtered {
    if (_query.isEmpty) return [];
    final q = _query.toLowerCase();
    return _allDests
        .where((d) =>
            d.name.contains(_query) ||
            d.slug.contains(q) ||
            d.highlights.any((h) => h.contains(_query)))
        .toSet()
        .toList();
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
                hintText: "도시·명소 검색 (예: 강릉, 한옥마을, 해운대)",
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
                ? const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                      child: Text("검색 결과가 없습니다.", style: TextStyle(color: _textSecondary)),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '"$_query" 검색 결과 ${_filtered.length}곳',
                          style: const TextStyle(fontSize: 12, color: _textSecondary),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _filtered
                              .map((d) => ActionChip(
                                    avatar: Text(d.emoji),
                                    label: Text(d.name),
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
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Text(
                "광역시·특별시",
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
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
                childAspectRatio: 1.55,
              ),
              delegate: SliverChildListDelegate([
                ..._metroCities.map((city) {
                  final group = _metroGroups.cast<_DestGroup?>().firstWhere(
                        (g) => g!.label == city.name,
                        orElse: () => null,
                      );
                  final subtitle = group != null
                      ? group.items.take(3).map((i) => i.name).join(' · ')
                      : city.highlights.take(2).join(' · ');
                  return _RegionTileCard(
                    emoji: city.emoji,
                    title: city.name,
                    subtitle: subtitle,
                    hasDrill: group != null,
                    onTap: group != null
                        ? () => widget.onGroupTap(group)
                        : () => widget.onSelect(city),
                  );
                }),
              ]),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 20)),

          // ── 도 단위 지역 섹션 ───────────────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Text(
                "도 단위 지역",
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
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
                childAspectRatio: 1.55,
              ),
              delegate: SliverChildListDelegate([
                ..._provinceGroups.map((g) => _RegionTileCard(
                      emoji: g.items.first.emoji,
                      title: g.label,
                      subtitle: g.subLabel,
                      hasDrill: true,
                      onTap: () => widget.onGroupTap(g),
                    )),
              ]),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ],
    );
  }
}

// ── 지역 선택 타일 카드 (이모지 + 지역명만) ─────────────────────
class _RegionTileCard extends StatelessWidget {
  const _RegionTileCard({
    required this.emoji,
    required this.title,
    required this.onTap,
    // subtitle·hasDrill 파라미터 유지 (호출부 변경 없이 무시)
    String subtitle = "",
    bool hasDrill = false,
  });

  final String emoji;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 40)),
            const SizedBox(height: 6),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: _textPrimary,
              ),
              textAlign: TextAlign.center,
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
                  errorBuilder: (_, __, ___) => _PlaceholderBg(dest: dest),
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
                      dest.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
                    if (dest.highlights.isNotEmpty)
                      Text(
                        dest.highlights.take(2).join(" · "),
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

// ── Netflix 스타일 이미지 카드 ──────────────────────────────────
class _DestCard extends StatelessWidget {
  const _DestCard({required this.dest, required this.onTap});
  final _Destination dest;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imgUrl = _getImageUrl(dest.slug);
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 110,
        height: 165,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 배경 이미지
              if (imgUrl != null)
                Image.network(
                  imgUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _PlaceholderBg(dest: dest),
                )
              else
                _PlaceholderBg(dest: dest),

              // 하단 그라디언트 오버레이
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0.4, 1.0],
                    colors: [Colors.transparent, Color(0xCC000000)],
                  ),
                ),
              ),

              // 텍스트
              Positioned(
                left: 8,
                right: 8,
                bottom: 7,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dest.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
                    if (dest.highlights.isNotEmpty)
                      Text(
                        dest.highlights.take(2).join(" · "),
                        style: const TextStyle(
                          color: Color(0xCCFFFFFF),
                          fontSize: 9,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),

              // 인기 배지
              if (dest.popular)
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.red.shade600,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: const Text(
                      "인기",
                      style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800),
                    ),
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
                    group.label,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: _textPrimary),
                  ),
                  Text(group.subLabel, style: const TextStyle(fontSize: 12, color: _textSecondary)),
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
              const Row(
                children: [
                  Icon(Icons.local_fire_department, color: Colors.orange, size: 18),
                  SizedBox(width: 4),
                  Text(
                    "인기 TOP 여행지",
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
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
                const Text(
                  "더 많은 여행지",
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(plannerControllerProvider);
    final ctrl = ref.read(plannerControllerProvider.notifier);

    return Column(
      children: [
        // 헤더
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              GestureDetector(
                onTap: onBack,
                child: Row(
                  children: [
                    const Icon(Icons.chevron_left, color: _primary),
                    Text(
                      "${dest.emoji} ${dest.name}",
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
              if (state.loading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _primary),
                ),
            ],
          ),
        ),
        if (state.loading) const LinearProgressIndicator(color: _primary, minHeight: 2),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // 상태 메시지
              if (state.statusMessage.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: _primaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    state.statusMessage,
                    style: const TextStyle(fontSize: 13, color: _primary),
                  ),
                ),

              // 루트 목록
              if (state.routes.isNotEmpty) ...[
                const Text(
                  "AI 추천 루트",
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 110,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: state.routes.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
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

              // 일정 타임라인
              if (state.schedule.isNotEmpty) ...[
                Row(
                  children: [
                    const Text(
                      "여행 일정",
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                    ),
                    const Spacer(),
                    Text(
                      "${state.schedule.length}개 항목",
                      style: const TextStyle(fontSize: 12, color: _textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...state.schedule.map((s) => _ScheduleCard(item: s)),
              ],

              if (state.routes.isEmpty && !state.loading)
                Center(
                  child: Column(
                    children: [
                      const SizedBox(height: 32),
                      Text(dest.emoji, style: const TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      Text(
                        "${dest.name} 여행을 AI로 계획해보세요",
                        style: const TextStyle(fontSize: 14, color: _textSecondary),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: ctrl.fetchRoutes,
                        icon: const Icon(Icons.auto_awesome),
                        label: const Text("루트 생성"),
                        style: FilledButton.styleFrom(backgroundColor: _primary),
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
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.route, required this.selected, required this.onTap});
  final PlanRoute route;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 160,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? _primary : Colors.white,
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(
      () => ref.read(userContentControllerProvider.notifier).loadFeed(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);

    ref.listen<int>(
      userContentControllerProvider.select((s) => s.saveSuccessCount),
      (prev, next) {
        if (prev != null && next > prev) {
          setState(() => _showUpload = false);
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
                      const Text(
                        "유저 루트 피드",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _textPrimary,
                        ),
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () => setState(() => _showUpload = true),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text("내 루트 공유"),
                        style: FilledButton.styleFrom(
                          backgroundColor: _primary,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (state.loading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: _primary),
                  ),
                )
              else if (state.feed.isEmpty)
                const SliverFillRemaining(
                  child: Center(
                    child: Text("아직 공유된 루트가 없습니다.", style: TextStyle(color: _textSecondary)),
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.7,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _UserRouteCard(
                        route: state.feed[i],
                        onTap: () => setState(() => _detailRoute = state.feed[i]),
                        onLike: () => ctrl.likeRoute(state.feed[i].id),
                      ),
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
                          child: Text(state.loadingMore ? "불러오는 중..." : "더 보기"),
                        ),
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          ),

          // 상세 바텀시트
          if (_detailRoute != null)
            _RouteDetailSheet(
              route: _detailRoute!,
              onClose: () => setState(() => _detailRoute = null),
            ),

          // 업로드 바텀시트
          if (_showUpload)
            _UploadSheet(
              onClose: () => setState(() => _showUpload = false),
            ),
        ],
      ),
    );
  }
}

class _UserRouteCard extends StatelessWidget {
  const _UserRouteCard({required this.route, required this.onTap, required this.onLike});
  final UserRoute route;
  final VoidCallback onTap;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 썸네일
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(14),
                topRight: Radius.circular(14),
              ),
              child: AspectRatio(
                aspectRatio: 3 / 2,
                child: route.imageUrl != null
                    ? Image.network(
                        route.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _gradientFallback(),
                      )
                    : _gradientFallback(),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 태그
                    if (route.tags.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 2,
                        children: route.tags
                            .take(2)
                            .map(
                              (t) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _primaryLight,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  "#$t",
                                  style: const TextStyle(fontSize: 10, color: _primary),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      route.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: _textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        const Icon(Icons.location_on, size: 12, color: _textSecondary),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            route.location,
                            style: const TextStyle(fontSize: 11, color: _textSecondary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        GestureDetector(
                          onTap: onLike,
                          child: Row(
                            children: [
                              const Icon(Icons.favorite_border, size: 14, color: Color(0xFFEC4899)),
                              const SizedBox(width: 2),
                              Text(
                                "${route.likes}",
                                style: const TextStyle(fontSize: 11, color: _textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _gradientFallback() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

class _RouteDetailSheet extends StatelessWidget {
  const _RouteDetailSheet({required this.route, required this.onClose});
  final UserRoute route;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black54,
        child: GestureDetector(
          onTap: () {},
          child: DraggableScrollableSheet(
            initialChildSize: 0.8,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            builder: (_, ctrl) => Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                children: [
                  // 핸들
                  Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 10),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      controller: ctrl,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        // 헤더
                        if (route.imageUrl != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              route.imageUrl!,
                              height: 180,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                            ),
                          ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 14, color: _primary),
                            const SizedBox(width: 4),
                            Text(route.location, style: const TextStyle(fontSize: 13, color: _primary)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          route.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          route.description,
                          style: const TextStyle(fontSize: 13, color: _textSecondary),
                        ),
                        if (route.tags.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            children: route.tags
                                .map(
                                  (t) => Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: _primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text("#$t", style: const TextStyle(fontSize: 12, color: _primary)),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                        const SizedBox(height: 16),
                        const Text(
                          "루트",
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _textPrimary),
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
                                    width: 24,
                                    height: 24,
                                    decoration: BoxDecoration(
                                      color: _primary,
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      "${idx + 1}",
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (idx < route.routeItems.length - 1)
                                    Container(width: 2, height: 32, color: Colors.grey.shade200),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.place,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: _textPrimary,
                                        ),
                                      ),
                                      if (item.description.isNotEmpty)
                                        Text(
                                          item.description,
                                          style: const TextStyle(fontSize: 12, color: _textSecondary),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          );
                        }),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── 업로드 바텀시트 (단계별 위저드) ───────────────────────────
class _UploadSheet extends ConsumerStatefulWidget {
  const _UploadSheet({required this.onClose});
  final VoidCallback onClose;

  @override
  ConsumerState<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends ConsumerState<_UploadSheet> {
  // step: 0=사진, 1=폼, 2=폴리시, 3=완료
  int _step = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(userContentControllerProvider);
    final ctrl = ref.read(userContentControllerProvider.notifier);

    return GestureDetector(
      onTap: widget.onClose,
      child: Container(
        color: Colors.black54,
        child: GestureDetector(
          onTap: () {},
          child: DraggableScrollableSheet(
            initialChildSize: 0.85,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            builder: (_, scrollCtrl) => Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                children: [
                  Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 10),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // 단계 인디케이터
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                    child: Row(
                      children: [
                        const Text(
                          "루트 공유하기",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          "${_step + 1}/4",
                          style: const TextStyle(fontSize: 13, color: _textSecondary),
                        ),
                      ],
                    ),
                  ),
                  LinearProgressIndicator(
                    value: (_step + 1) / 4,
                    color: _primary,
                    backgroundColor: _primaryLight,
                    minHeight: 3,
                  ),
                  Expanded(
                    child: ListView(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.all(20),
                      children: [
                        if (_step == 0) ...[
                          const Text(
                            "📸 대표 사진을 선택해 주세요",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            "선택 사항입니다. 없어도 공유할 수 있어요.",
                            style: TextStyle(fontSize: 12, color: _textSecondary),
                          ),
                          const SizedBox(height: 16),
                          if (state.selectedImagePath != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(
                                File(state.selectedImagePath!),
                                height: 180,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: ctrl.pickImage,
                            icon: const Icon(Icons.photo_library_outlined),
                            label: Text(state.selectedImagePath == null ? "갤러리에서 선택" : "다시 선택"),
                          ),
                          if (state.selectedImagePath != null && state.uploadedImageUrl == null) ...[
                            const SizedBox(height: 8),
                            FilledButton.icon(
                              onPressed: state.loading ? null : ctrl.validateAndUploadImage,
                              icon: const Icon(Icons.upload),
                              label: Text(state.loading ? "업로드 중..." : "사진 업로드"),
                              style: FilledButton.styleFrom(backgroundColor: _primary),
                            ),
                            if (state.uploadProgress != null) ...[
                              const SizedBox(height: 8),
                              LinearProgressIndicator(value: state.uploadProgress, color: _primary),
                            ],
                          ],
                          if (state.uploadedImageUrl != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD1FAE5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.check_circle, color: Color(0xFF059669), size: 16),
                                  SizedBox(width: 6),
                                  Text("사진 업로드 완료!", style: TextStyle(color: Color(0xFF059669), fontSize: 13)),
                                ],
                              ),
                            ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton(
                                  onPressed: () => setState(() => _step = 1),
                                  style: FilledButton.styleFrom(backgroundColor: _primary),
                                  child: const Text("다음"),
                                ),
                              ),
                            ],
                          ),
                        ] else if (_step == 1) ...[
                          const Text(
                            "✍️ 루트 정보를 입력해 주세요",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 16),
                          _InputField(
                            label: "제목",
                            initial: state.draftTitle,
                            onChanged: ctrl.setDraftTitle,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "여행지",
                            hint: "예: 부산, 제주",
                            initial: state.draftLocation,
                            onChanged: ctrl.setDraftLocation,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "한 줄 설명",
                            initial: state.draftDescription,
                            onChanged: ctrl.setDraftDescription,
                          ),
                          const SizedBox(height: 12),
                          _InputField(
                            label: "장소 목록 (한 줄당 장소 - 메모)",
                            hint: "해운대 - 오전 산책\n광안리 - 야경",
                            initial: state.draftRouteItemsText,
                            onChanged: ctrl.setDraftRouteItemsText,
                            maxLines: 5,
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => setState(() => _step = 0),
                                  child: const Text("이전"),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton(
                                  onPressed: () {
                                    setState(() => _step = 2);
                                    ctrl.polishDraft();
                                  },
                                  style: FilledButton.styleFrom(backgroundColor: _primary),
                                  child: const Text("AI 다듬기"),
                                ),
                              ),
                            ],
                          ),
                        ] else if (_step == 2) ...[
                          const Text(
                            "✨ AI 다듬기 결과",
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                          ),
                          const SizedBox(height: 12),
                          if (state.loading)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32),
                                child: CircularProgressIndicator(color: _primary),
                              ),
                            )
                          else if (state.polished != null) ...[
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: _primaryLight,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    state.polished!.title,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: _textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    state.polished!.description,
                                    style: const TextStyle(fontSize: 13, color: _textSecondary),
                                  ),
                                  if (state.polished!.tags.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 6,
                                      children: state.polished!.tags
                                          .map(
                                            (t) => Chip(
                                              label: Text("#$t", style: const TextStyle(fontSize: 11)),
                                              backgroundColor: Colors.white,
                                            ),
                                          )
                                          .toList(),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => setState(() => _step = 1),
                                    child: const Text("수정하기"),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: state.loading ? null : ctrl.savePolishedRoute,
                                    style: FilledButton.styleFrom(backgroundColor: _primary),
                                    child: const Text("공유하기"),
                                  ),
                                ),
                              ],
                            ),
                          ] else ...[
                            const Text("AI 다듬기 실패. 다시 시도해 주세요.", style: TextStyle(color: Colors.red)),
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () => setState(() => _step = 1),
                              child: const Text("돌아가기"),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  const _InputField({
    required this.label,
    required this.initial,
    required this.onChanged,
    this.hint,
    this.maxLines = 1,
  });
  final String label;
  final String initial;
  final void Function(String) onChanged;
  final String? hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: ValueKey(initial.hashCode),
      initialValue: initial,
      onChanged: onChanged,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// K-CONTENT TAB
// ═══════════════════════════════════════════════════════════════
// ── K-Content 데이터 ─────────────────────────────────────────
class _KItem {
  const _KItem(this.title, this.description, this.gradient);
  final String title;
  final String description;
  final List<Color> gradient;
}

const _kpopItems = [
  _KItem("HYBE Building", "HYBE Insight museum and label headquarters.", [Color(0xFFFF4D6D), Color(0xFFD63384)]),
  _KItem("SM Entertainment", "SM Town and SM Entertainment building.", [Color(0xFF7C3AED), Color(0xFF9333EA)]),
  _KItem("Hongdae K-Pop Street", "Street performances, K-Pop stores.", [Color(0xFFD63384), Color(0xFFE11D74)]),
  _KItem("K-Pop Store", "Official albums, merch, and photo cards.", [Color(0xFF4F46E5), Color(0xFF7C3AED)]),
];

const _kdramaItems = [
  _KItem("Goblin Filming Location", "Famous drama shooting spots.", [Color(0xFFF59E0B), Color(0xFFEA580C)]),
  _KItem("Itaewon Class Street", "DanBam and the streets of the drama.", [Color(0xFF10B981), Color(0xFF0D9488)]),
  _KItem("Namsan Tower", "Locks of love and panoramic Seoul.", [Color(0xFF0EA5E9), Color(0xFF3B82F6)]),
  _KItem("Bukchon Hanok Village", "Traditional hanok alleys.", [Color(0xFFD97706), Color(0xFFE11D48)]),
];

const _kfoodItems = [
  _KItem("Gwangjang Market", "Bindaetteok, mayak gimbap, street food.", [Color(0xFFF97316), Color(0xFFD97706)]),
  _KItem("Myeongdong Street Food", "Tteokbokki, odeng, and sweet treats.", [Color(0xFFEF4444), Color(0xFFF97316)]),
  _KItem("Korean BBQ", "Samgyeopsal and galbi grill experience.", [Color(0xFFDC2626), Color(0xFFBE185D)]),
  _KItem("Convenience Store Combo", "Triangle kimbap, ramyeon, soju.", [Color(0xFF84CC16), Color(0xFF22C55E)]),
];

const _kbeautyItems = [
  _KItem("Olive Young", "K-Beauty flagship. Skincare and makeup.", [Color(0xFFEC4899), Color(0xFFE11D48)]),
  _KItem("Myeongdong Beauty Street", "Density of beauty stores and brands.", [Color(0xFFD946EF), Color(0xFFEC4899)]),
  _KItem("K-Beauty Store", "Sheet masks, serums, cushion compacts.", [Color(0xFF7C3AED), Color(0xFF9333EA)]),
  _KItem("Skincare Experience Shop", "Facials and personalized skincare.", [Color(0xFFFB7185), Color(0xFFEC4899)]),
];

class _KContentTab extends ConsumerWidget {
  const _KContentTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        // ── 히어로 배너 ────────────────────────────────────────
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "K-Content Travel",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                "Explore Korea through K-Pop, Drama, Food and Beauty",
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF7C3AED),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  elevation: 0,
                ),
                child: const Text(
                  "Generate AI Route",
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        // ── 콘텐츠 행 ──────────────────────────────────────────
        _KContentRow(title: "KPOP TOUR", items: _kpopItems),
        _KContentRow(title: "KDRAMA TOUR", items: _kdramaItems),
        _KContentRow(title: "KFOOD TOUR", items: _kfoodItems),
        _KContentRow(title: "KBEAUTY TOUR", items: _kbeautyItems),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _KContentRow extends StatelessWidget {
  const _KContentRow({required this.title, required this.items});
  final String title;
  final List<_KItem> items;

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
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final item = items[i];
              return Container(
                width: 160,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: item.gradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
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
              );
            },
          ),
        ),
      ],
    );
  }
}
