"""
공공데이터포털 전국문화축제표준데이터 Open API 연동.
명세: pageNo, numOfRows, type, fstvlNm, opar, fstvlStartDate, fstvlEndDate 등
응답: fstvlNm, opar, fstvlStartDate, fstvlEndDate, fstvlCo, mnnstNm, ...
환경변수: DATA_GO_KR_SERVICE_KEY
"""
import os
import re
from typing import Any

import httpx

FESTIVAL_BASE = "http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api"


class FestivalUnavailableError(Exception):
    """공공 API 일시 불가 (서비스 안내 페이지, JS 챌린지 실패 등). 캐시 fallback 사용."""


def get_service_key() -> str:
    return os.getenv("DATA_GO_KR_SERVICE_KEY", "").strip()


def fetch_festivals(
    page_no: int = 1,
    num_of_rows: int = 100,
    type_: str = "json",
    fstvl_nm: str = "",
    opar: str = "",
    fstvl_start_date: str = "",
    fstvl_end_date: str = "",
) -> dict[str, Any]:
    """
    전국문화축제표준데이터 목록 조회.
    요청변수: pageNo, numOfRows, type, fstvlNm, opar, fstvlStartDate, fstvlEndDate 등
    """
    key = get_service_key()
    if not key:
        return {
            "response": {
                "header": {"resultCode": "99", "resultMsg": "API 키가 설정되지 않았습니다."},
                "body": {},
            }
        }

    # 필수 파라미터만 전송 - 빈 문자열 파라미터를 보내면 API가 NODATA 반환
    params: dict[str, str | int] = {
        "serviceKey": key,
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "type": type_,
    }
    if fstvl_nm:
        params["fstvlNm"] = fstvl_nm
    if opar:
        params["opar"] = opar
    if fstvl_start_date:
        params["fstvlStartDate"] = fstvl_start_date
    if fstvl_end_date:
        params["fstvlEndDate"] = fstvl_end_date

    import logging as _log
    _logger = _log.getLogger(__name__)

    # 브라우저처럼 보이게 헤더 설정 → DDoS 방어 우회
    browser_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.data.go.kr/",
    }

    # 쿠키 세션을 유지하면서 최대 4번까지 챌린지 통과 시도
    with httpx.Client(
        timeout=30.0, follow_redirects=True, max_redirects=10,
        verify=False, headers=browser_headers,
    ) as client:
        r = client.get(FESTIVAL_BASE, params=params)

        for attempt in range(4):
            body_text = r.text
            if not body_text.lstrip().startswith("<"):
                break  # JSON 응답 획득

            # 서비스 점검/안내 페이지 감지 (JS 챌린지 아님 → 일시적 unavailable)
            if "서비스 안내" in body_text or "서비스 점검" in body_text:
                raise FestivalUnavailableError("공공데이터포털 서비스 안내 페이지 반환 (일시적 unavailable)")

            # JS 챌린지 파싱 후 재요청
            redirect_url = _extract_js_redirect(body_text, str(r.url))
            if not redirect_url:
                _logger.debug("JS 챌린지 파싱 실패 (attempt=%d): %s", attempt, body_text[:200])
                raise FestivalUnavailableError(f"JS 챌린지 파싱 실패 (attempt={attempt})")
            _logger.info("JS 챌린지(%d) → %s", attempt + 1, redirect_url)
            r = client.get(redirect_url)
        else:
            raise FestivalUnavailableError(f"JS 챌린지 반복 초과: {r.text[:100]!r}")

        r.raise_for_status()
        try:
            return r.json()
        except Exception as json_err:
            raise ValueError(f"JSON 파싱 실패: {r.text[:300]!r}") from json_err


def _extract_js_redirect(html: str, base_url: str) -> str | None:
    """공공데이터 포털 DDoS 방어 JS 챌린지에서 실제 API URL 추출.

    알려진 패턴:
      1) var x={o:'TAIL',t:'HEAD/',h:'MIDDLE'}; rsu()=t+h+o
      2) var x={o:'FULL_PATH',c:N}; o에 /Token/openapi/... 포함
      3) location.assign('...')
    """
    from urllib.parse import urljoin

    # 패턴 1: {o:'AAA',t:'BBB',h:'CCC'}
    m = re.search(r"var\s+x\s*=\s*\{o:'([^']*)',t:'([^']*)',h:'([^']*)'\}", html)
    if m:
        o_part, t_part, h_part = m.group(1), m.group(2), m.group(3)
        return urljoin(base_url, t_part + h_part + o_part)

    # 패턴 2: {o:'FULL_PATH', c:N} → o가 전체 경로
    m2 = re.search(r"var\s+x\s*=\s*\{o:'([^']+)'[^}]*\}", html)
    if m2:
        o_val = m2.group(1)
        if "/openapi/" in o_val:
            return urljoin(base_url, o_val)

    # 패턴 3: location.assign('...')
    m3 = re.search(r"location\.assign\(['\"]([^'\"]+)['\"]", html)
    if m3:
        return urljoin(base_url, m3.group(1))

    return None


def _date_to_int(s: str) -> int | None:
    """날짜 문자열을 YYYYMMDD 정수로. 없으면 None."""
    if not s:
        return None
    digits = re.sub(r"\D", "", str(s))[:8]
    if len(digits) != 8:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def filter_by_year_month(items: list[dict], year: int, month: int) -> list[dict]:
    """해당 연·월과 기간이 겹치는 행사만 (시작일만이 아니라 해당 달에 열리는 행사 포함)."""
    try:
        from calendar import monthrange
        first_day = year * 10000 + month * 100 + 1
        _, last = monthrange(year, month)
        last_day = year * 10000 + month * 100 + last
    except Exception:
        first_day = year * 10000 + month * 100 + 1
        last_day = year * 10000 + month * 100 + 31

    result = []
    for item in items:
        start_s = (
            item.get("fstvlStartDate")
            or item.get("축제시작일자")
            or item.get("fstvlStartDt")
            or ""
        )
        end_s = (
            item.get("fstvlEndDate")
            or item.get("축제종료일자")
            or item.get("fstvlEndDt")
            or ""
        )
        start_d = _date_to_int(start_s)
        end_d = _date_to_int(end_s) or start_d or 99991231
        if start_d is None:
            continue
        # 해당 달과 하루라도 겹치면 포함
        if start_d <= last_day and end_d >= first_day:
            result.append(item)
    return result


def _normalize_date(s: str) -> str:
    """날짜 문자열을 YYYYMMDD 8자리(숫자만)로 반환. 파싱 불가 시 빈 문자열."""
    if not s:
        return ""
    digits = re.sub(r"\D", "", str(s))[:8]
    return digits if len(digits) == 8 else ""


def normalize_item(item: dict) -> dict:
    """출력결과(Response Element) 명세 기준으로 정규화. 날짜는 YYYYMMDD 형식."""
    return {
        "fstvlNm": item.get("fstvlNm") or item.get("축제명") or "",
        "opar": item.get("opar") or item.get("개최장소") or "",
        "fstvlStartDate": _normalize_date(item.get("fstvlStartDate") or item.get("축제시작일자") or ""),
        "fstvlEndDate": _normalize_date(item.get("fstvlEndDate") or item.get("축제종료일자") or ""),
        "fstvlCo": item.get("fstvlCo") or item.get("축제내용") or "",
        "mnnstNm": item.get("mnnstNm") or item.get("주관기관명") or "",
        "auspcInsttNm": item.get("auspcInsttNm") or item.get("주최기관명") or "",
        "suprtInsttNm": item.get("suprtInsttNm") or item.get("후원기관명") or "",
        "phoneNumber": item.get("phoneNumber") or item.get("전화번호") or "",
        "homepageUrl": item.get("homepageUrl") or item.get("홈페이지주소") or "",
        "relateInfo": item.get("relateInfo") or item.get("관련정보") or "",
        "rdnmadr": item.get("rdnmadr") or item.get("소재지도로명주소") or "",
        "lnmadr": item.get("lnmadr") or item.get("소재지지번주소") or "",
        "latitude": item.get("latitude") or item.get("위도") or "",
        "longitude": item.get("longitude") or item.get("경도") or "",
        "referenceDate": item.get("referenceDate") or item.get("데이터기준일자") or "",
    }


def parse_response_items(data: dict) -> list[dict]:
    """공공데이터 응답에서 items 추출. response.body.items.item / body.items 등 다양한 구조 지원."""
    # 1) response.body.items.item (표준)
    resp = data.get("response") or {}
    body = data.get("body") or resp.get("body") or {}
    items_node = body.get("items")
    if items_node is not None:
        if isinstance(items_node, list):
            return items_node
        if isinstance(items_node, dict):
            raw = items_node.get("item")
            if raw is not None:
                return raw if isinstance(raw, list) else [raw]
    # 2) 최상위 body.item
    raw = body.get("item")
    if raw is not None:
        return raw if isinstance(raw, list) else [raw]
    # 3) 최상위 items
    top_items = data.get("items")
    if isinstance(top_items, list):
        return top_items
    if isinstance(top_items, dict) and top_items.get("item") is not None:
        r = top_items["item"]
        return r if isinstance(r, list) else [r]
    return []
