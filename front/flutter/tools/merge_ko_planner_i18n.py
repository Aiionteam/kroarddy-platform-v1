# -*- coding: utf-8 -*-
"""Merge planner_dest + planner_region Korean strings into ko.json from en.json structure."""
import json
import copy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EN = ROOT / "assets/translations/en.json"
KO = ROOT / "assets/translations/ko.json"

# slug -> (name_ko, [h1, h2, h3, ...] optional; if shorter, rest from EN or omitted)
KO_DEST: dict[str, tuple[str, list[str] | None]] = {
    "seoul": ("서울", ["경복궁", "홍대", "한강공원"]),
    "busan": ("부산", ["해운대", "감천문화마을", "자갈치시장"]),
    "daegu": ("대구", ["동성로", "김광석 거리", "수성못"]),
    "incheon": ("인천", ["송도", "강화도", "차이나타운"]),
    "gwangju": ("광주", ["아시아문화센터", "양림동"]),
    "daejeon": ("대전", ["성심당", "엑스포", "유성온천"]),
    "ulsan": ("울산", ["간절곶", "대왕암", "태화강"]),
    "sejong": ("세종", ["세종호수공원", "국립수목원"]),
    "jongno": ("종로·광화문", ["경복궁", "청와대", "인사동"]),
    "myeongdong": ("명동·을지로", ["명동성당", "을지로 골목"]),
    "yongsan": ("용산·이태원", ["국립중앙박물관", "이태원"]),
    "gangnam": ("강남·서초", ["코엑스", "압구정 로데오", "도산공원"]),
    "jamsil": ("잠실·송파", ["롯데월드", "올림픽공원", "석촌호수"]),
    "seongsu": ("성수·한남", ["성수 카페거리", "한남동 갤러리"]),
    "hongdae": ("홍대·마포", ["홍대 클럽", "연남동", "경의선숲길"]),
    "bukchon": ("북촌·삼청", ["북촌한옥마을", "삼청동 카페"]),
    "nowon": ("노원·도봉", ["수락산", "도봉산", "불암산"]),
    "haeundae": ("해운대", ["해운대 해수욕장", "동백섬", "달맞이길"]),
    "gwangalli": ("광안·수영", ["광안대교", "광안리 해수욕장"]),
    "gijang": ("기장", ["죽성드림성당", "대변항"]),
    "songjeong": ("송정·청사포", ["송정 해수욕장", "청사포 전망대"]),
    "nampo": ("남포·중구", ["자갈치시장", "BIFF 광장", "보수동 책방골목"]),
    "seomyeon": ("서면·부전", ["서면 거리", "전포카페거리", "부전시장"]),
    "gamcheon": ("감천문화마을", ["감천문화마을", "스카이로드"]),
    "yeongdo": ("영도", ["태종대", "흰여울문화마을", "봉래산"]),
    "geumjeong": ("금정·온천장", ["금정산성", "범어사", "온천장"]),
    "gangseo-bs": ("강서·갑이도", ["을숙도", "갑이도 갯벌"]),
    "dadaepo": ("사하·다대포", ["다대포 해수욕장", "낙동강 하구"]),
    "dongseongno": ("동성로·중구", ["동성로", "서문시장", "약전시장"]),
    "gimgwangseok": ("김광석 거리", ["김광석 거리", "방천시장"]),
    "suseongmot": ("수성못·범어", ["수성못", "수성리조트"]),
    "palgongsan": ("팔공산", ["동화사", "갓바위", "팔공 스카이라인"]),
    "dalseong": ("비슬산·달성", ["비슬산 벚꽃", "달성 습지"]),
    "gunwi": ("군위", ["삼국유사 테마파크", "화산성"]),
    "ganjeolgot": ("간절곶", ["간절곶 등대", "해돋이"]),
    "daewangam": ("대왕암", ["대왕암공원", "일산 해수욕장"]),
    "taehwagang": ("태화강", ["태화강 국가정원", "십리대숲"]),
    "bangudae": ("반구대", ["반구대 암각화", "집청정"]),
    "jeju": ("제주시", ["한라산", "성산일출봉", "협재 해수욕장"]),
    "gyeongju": ("경주", ["황리단길", "첨성대", "불국사"]),
    "gangneung": ("강릉", ["경포 해수욕장", "안목 커피거리", "오죽헌"]),
    "jeonju": ("전주", ["한옥마을", "막걸리 골목"]),
    "goyang": ("고양", None),
    "paju": ("파주", ["헤이리 예술마을", "임진각"]),
    "gimpo": ("김포", None),
    "uijeongbu": ("의정부", None),
    "namyangju": ("남양주", ["두물경", "다산길"]),
    "guri": ("구리", None),
    "gapyeong": ("가평", ["남이섬", "자라섬"]),
    "yangpyeong": ("양평", ["두물경", "용문산"]),
    "pocheon": ("포천", ["산정호수", "허브아일랜드"]),
    "yangju": ("양주", None),
    "dongducheon": ("동두천", None),
    "suwon": ("수원", ["화성행궁", "행궁단길"]),
    "hwaseong": ("화성", None),
    "ansan": ("안산", None),
    "siheung": ("시흥", None),
    "anyang": ("안양", None),
    "gunpo": ("군포", None),
    "pyeongtaek": ("평택", None),
    "yongin": ("용인", ["에버랜드", "한국민속촌"]),
    "seongnam": ("성남", None),
    "hanam": ("하남", None),
    "icheon": ("이천", ["도자기마을", "이천쌀"]),
    "yeoju": ("여주", None),
    "anseong": ("안성", None),
    "osan": ("오산", None),
    "uiwang": ("의왕", None),
    "gwacheon": ("과천", None),
    "bucheon": ("부천", None),
    "gwangmyeong": ("광명", None),
    "chuncheon": ("춘천", ["남이섬", "닭갈비 골목"]),
    "wonju": ("원주", ["뮤지엄산", "소금산 출렁다리"]),
    "pyeongchang": ("평창", ["대관령 양떼목장", "오대산"]),
    "yeongwol": ("영월", None),
    "hoengseong": ("횡성", None),
    "jeongseon": ("정선", None),
    "inje": ("인제", None),
    "taebaek": ("태백", None),
    "sokcho": ("속초", ["설악산", "중앙시장"]),
    "yangyang": ("양양", ["서피비치", "낙산사"]),
    "donghae": ("동해", None),
    "samcheok": ("삼척", None),
    "goseong-gw": ("고성(강원)", None),
    "cheongju": ("청주", None),
    "chungju": ("충주", None),
    "jecheon": ("제천", ["청풍호", "의림지"]),
    "danyang": ("단양", ["단양 팔경", "도담삼봉"]),
    "gongju": ("공주", ["공산성", "무령왕릉"]),
    "buyeo": ("부여", ["부소산성", "백제문화단지"]),
    "asan": ("아산", None),
    "cheonan": ("천안", None),
    "nonsan": ("논산", None),
    "boryeong": ("보령", ["머드축제", "대천 해수욕장"]),
    "taean": ("태안", ["안면도", "꽃지 해수욕장"]),
    "seosan": ("서산", None),
    "dangjin": ("당진", None),
    "gunsan": ("군산", ["근대역사거리", "이성당"]),
    "iksan": ("익산", None),
    "gochang": ("고창", None),
    "jeongeup": ("정읍", None),
    "namwon": ("남원", None),
    "gimje": ("김제", None),
    "yeosu": ("여수", ["해상케이블카", "오동도"]),
    "suncheon": ("순천", ["순천만 국가정원", "낙안읍성"]),
    "mokpo": ("목포", ["해상케이블카", "유달산"]),
    "wando": ("완도", None),
    "gangjin": ("강진", None),
    "yeonggwang": ("영광", None),
    "haenam": ("해남", None),
    "goheung": ("고흥", None),
    "yeongam": ("영암", None),
    "damyang": ("담양", ["죽녹원", "메타세쿼이아길"]),
    "gwangyang": ("광양", None),
    "boseong": ("보성", ["녹차밭", "율포 해수욕장"]),
    "naju": ("나주", None),
    "andong": ("안동", ["하회마을", "도산서원"]),
    "yeongju": ("영주", None),
    "mungyeong": ("문경", None),
    "pohang": ("포항", ["호미곶", "스페이스워크"]),
    "yeongdeok": ("영덕", None),
    "uljin": ("울진", None),
    "dokdo": ("독도·울릉도", ["독도", "울릉도"]),
    "gumi": ("구미", None),
    "gimcheon": ("김천", None),
    "yeongcheon": ("영천", None),
    "sangju": ("상주", None),
    "gyeongsan": ("경산", None),
    "tongyeong": ("통영", ["루지", "동피랑 마을"]),
    "geoje": ("거제", ["바람의 언덕", "외도"]),
    "namhae": ("남해", ["독일마을", "다랭이 마을"]),
    "goseong-gn": ("고성(경남)", None),
    "jinju": ("진주", ["진주 유등축제", "진주성"]),
    "changwon": ("창원", None),
    "hapcheon": ("합천", None),
    "miryang": ("밀양", None),
    "hamyang": ("함양", None),
    "sancheong": ("산청", None),
    "hadong": ("하동", ["화개장터", "쌍계사"]),
    "geochang": ("거창", None),
    "gimhae": ("김해", None),
    "yangsan": ("양산", None),
    "changnyeong": ("창녕", None),
    "uiryeong": ("의령", None),
    "seogwipo": ("서귀포", ["천지연 폭포", "올레길"]),
}

KO_REGION = {
    "seoul_areas": ("서울", "구별 핵심 여행지"),
    "gyeonggi_north": ("경기 북부", "고양·파주·의정부·남양주 등"),
    "gyeonggi_south": ("경기 남부", "수원·용인·성남·평택 등"),
    "gangwon": ("강원특별자치도", "강원 지역"),
    "chungbuk": ("충청북도", "청주·충주·제천·단양"),
    "chungnam": ("충청남도", "공주·부여·보령·태안 등"),
    "jeonbuk": ("전북특별자치도", "전북 지역"),
    "jeonnam": ("전라남도", "여수·순천·목포·담양 등"),
    "busan": ("부산", "부산광역시"),
    "daegu": ("대구", "대구광역시"),
    "ulsan": ("울산", "울산광역시"),
    "gyeongbuk": ("경상북도", "경주·포항·안동 등"),
    "gyeongnam": ("경상남도", "통영·거제·진주·창원 등"),
    "jeju": ("제주특별자치도", "제주 지역"),
}


def build_planner_dest(en_block: dict) -> dict:
    out = {}
    for slug, en_entry in en_block.items():
        entry = copy.deepcopy(en_entry)
        ko = KO_DEST.get(slug)
        if ko:
            name_ko, highs = ko
            entry["name"] = name_ko
            if highs:
                for i, h in enumerate(highs, start=1):
                    entry[f"highlight{i}"] = h
                # remove extra highlights not in list
                for i in range(len(highs) + 1, 6):
                    k = f"highlight{i}"
                    if k in entry:
                        del entry[k]
        else:
            # keep English name as fallback (should not happen if KO_DEST complete)
            pass
        out[slug] = entry
    return out


def build_planner_region(en_block: dict) -> dict:
    out = {}
    for key, en_entry in en_block.items():
        entry = copy.deepcopy(en_entry)
        if key in KO_REGION:
            entry["label"], entry["subLabel"] = KO_REGION[key]
        out[key] = entry
    return out


def main() -> None:
    en = json.loads(EN.read_text(encoding="utf-8"))
    ko = json.loads(KO.read_text(encoding="utf-8"))

    missing = set(en["planner_dest"].keys()) - set(KO_DEST.keys())
    if missing:
        raise SystemExit(f"KO_DEST missing slugs: {sorted(missing)}")

    ko["planner_dest"] = build_planner_dest(en["planner_dest"])
    ko["planner_region"] = build_planner_region(en["planner_region"])

    KO.write_text(json.dumps(ko, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Wrote", KO)


if __name__ == "__main__":
    main()
