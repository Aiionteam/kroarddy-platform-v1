"""행사 서비스 클라이언트 – 여행 기간·지역에 해당하는 축제 목록 조회."""
import logging
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# 지역 슬러그 → 주소/개최장소 매칭 키워드
_LOCATION_KEYWORDS: dict[str, list[str]] = {
    # 특별시·광역시
    "seoul":         ["서울"],
    "busan":         ["부산"],
    "daegu":         ["대구"],
    "incheon":       ["인천"],
    "gwangju":       ["광주광역시", "광주 광역", "광주시"],
    "daejeon":       ["대전"],
    "ulsan":         ["울산"],
    "sejong":        ["세종"],
    # 수도권 (경기)
    "suwon":         ["수원"],
    "yongin":        ["용인"],
    "goyang":        ["고양"],
    "hwaseong":      ["화성"],
    "seongnam":      ["성남"],
    "bucheon":       ["부천"],
    "namyangju":     ["남양주"],
    "ansan":         ["안산"],
    "pyeongtaek":    ["평택"],
    "anyang":        ["안양"],
    "siheung":       ["시흥"],
    "paju":          ["파주"],
    "gimpo":         ["김포"],
    "uijeongbu":     ["의정부"],
    "gwangju-g":     ["경기 광주", "광주시 경기"],
    "hanam":         ["하남"],
    "gwangmyeong":   ["광명"],
    "gunpo":         ["군포"],
    "osan":          ["오산"],
    "yangju":        ["양주"],
    "icheon":        ["이천"],
    "guri":          ["구리"],
    "anseong":       ["안성"],
    "uiwang":        ["의왕"],
    "pocheon":       ["포천"],
    "yeoju":         ["여주"],
    "dongducheon":   ["동두천"],
    "gwacheon":      ["과천"],
    "gapyeong":      ["가평"],
    "yangpyeong":    ["양평"],
    # 강원
    "chuncheon":     ["춘천"],
    "wonju":         ["원주"],
    "gangneung":     ["강릉"],
    "donghae":       ["동해"],
    "taebaek":       ["태백"],
    "sokcho":        ["속초"],
    "samcheok":      ["삼척"],
    "yangyang":      ["양양"],
    "pyeongchang":   ["평창"],
    "jeongseon":     ["정선"],
    "inje":          ["인제"],
    "goseong-gw":    ["고성"],
    # 충청
    "cheongju":      ["청주"],
    "chungju":       ["충주"],
    "jecheon":       ["제천"],
    "danyang":       ["단양"],
    "cheonan":       ["천안"],
    "gongju":        ["공주"],
    "boryeong":      ["보령"],
    "asan":          ["아산"],
    "seosan":        ["서산"],
    "nonsan":        ["논산"],
    "dangjin":       ["당진"],
    "taean":         ["태안"],
    "buyeo":         ["부여"],
    # 전라
    "jeonju":        ["전주"],
    "gunsan":        ["군산"],
    "iksan":         ["익산"],
    "jeongeup":      ["정읍"],
    "namwon":        ["남원"],
    "gimje":         ["김제"],
    "mokpo":         ["목포"],
    "yeosu":         ["여수"],
    "suncheon":      ["순천"],
    "naju":          ["나주"],
    "gwangyang":     ["광양"],
    "damyang":       ["담양"],
    "boseong":       ["보성"],
    "wando":         ["완도"],
    # 경상
    "pohang":        ["포항"],
    "gyeongju":      ["경주"],
    "gimcheon":      ["김천"],
    "andong":        ["안동"],
    "gumi":          ["구미"],
    "yeongju":       ["영주"],
    "yeongcheon":    ["영천"],
    "sangju":        ["상주"],
    "mungyeong":     ["문경"],
    "gyeongsan":     ["경산"],
    "changwon":      ["창원"],
    "jinju":         ["진주"],
    "tongyeong":     ["통영"],
    "sacheon":       ["사천"],
    "gimhae":        ["김해"],
    "miryang":       ["밀양"],
    "geoje":         ["거제"],
    "yangsan":       ["양산"],
    "namhae":        ["남해"],
    "hapcheon":      ["합천"],
    # 제주
    "jeju":          ["제주"],
    "seogwipo":      ["서귀포"],
}


async def fetch_festivals_for_period(
    location: str,
    location_name: str,
    start_date: Optional[str],
    end_date: Optional[str],
) -> list[dict]:
    """여행 기간 및 지역에 해당하는 행사 목록 반환.

    festival 서비스의 /api/v1/festivals?year=&month= 를 호출하고
    지역 키워드로 필터링한다. 실패 시 빈 리스트를 반환해 플랜 생성을 계속 진행한다.
    """
    festival_url = getattr(settings, "festival_service_url", "")
    if not festival_url or not start_date or not end_date:
        return []

    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return []

    # 여행 기간에 걸쳐 있는 월 수집
    months: set[tuple[int, int]] = set()
    cur = start_dt.replace(day=1)
    while cur <= end_dt:
        months.add((cur.year, cur.month))
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)

    # 지역 키워드 (슬러그 매핑 우선, 없으면 한글 지명)
    keywords = _LOCATION_KEYWORDS.get(location, [location_name])

    all_items: list[dict] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=8.0) as client:
        for year, month in sorted(months):
            try:
                resp = await client.get(
                    f"{festival_url}/api/v1/festivals",
                    params={"year": year, "month": month},
                )
                if resp.status_code != 200:
                    logger.warning("행사 API 응답 오류: status=%d (year=%d month=%d)", resp.status_code, year, month)
                    continue

                data = resp.json()
                items = data.get("items", [])

                for item in items:
                    # 지역 키워드 필터
                    addr_text = (
                        item.get("opar", "")
                        + item.get("rdnmadr", "")
                        + item.get("lnmadr", "")
                    )
                    if not any(kw in addr_text for kw in keywords):
                        continue

                    # 중복 제거 (축제명 + 시작일 기준)
                    dedup_key = item.get("fstvlNm", "") + item.get("fstvlStartDate", "")
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    all_items.append(item)

            except Exception as e:
                logger.warning("행사 데이터 조회 실패 (year=%d month=%d): %s", year, month, e)

    logger.info(
        "행사 필터 결과: location=%s, 기간=%s~%s, 건수=%d",
        location_name, start_date, end_date, len(all_items),
    )
    return all_items
