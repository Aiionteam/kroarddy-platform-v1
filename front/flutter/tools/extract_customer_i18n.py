"""Extract sidebar + customer i18n from web.kroaddy.site locales for Flutter easy_localization."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT.parent / "web.kroaddy.site" / "src" / "lib" / "i18n" / "locales"
OUT = ROOT / "assets" / "translations"


def main() -> None:
    ko = json.loads((WEB / "ko.json").read_text(encoding="utf-8"))
    en = json.loads((WEB / "en.json").read_text(encoding="utf-8"))

    def faq_extra() -> tuple[dict, dict]:
        fk = {
            "items": {
                "login_help": {
                    "category": "로그인/계정",
                    "question": "로그인이 안 되거나 계정 오류가 나요.",
                    "answer": "앱을 최신 버전으로 업데이트하고, 캐시 삭제 후 다시 시도해 주세요. 지속되면 문의하기로 남겨주세요.",
                },
                "first_steps": {
                    "category": "시작하기",
                    "question": "처음 왔는데 어디부터 보면 되나요?",
                    "answer": "홈 바로가기에서 여행플래너·일정관리·장소 추천 순으로 둘러보세요. 이용가이드에도 단계별 안내가 있습니다.",
                },
                "update_notes": {
                    "category": "업데이트",
                    "question": "새 기능·공지는 어디서 보나요?",
                    "answer": "고객센터 공지사항에서 배포·점검 안내를 확인할 수 있어요.",
                },
                "refund_flow": {
                    "category": "결제/환불",
                    "question": "환불은 어떻게 진행되나요?",
                    "answer": "결제 및 서비스 이용 화면의 안내를 확인해 주세요. 개별 건은 영수증을 준비해 문의해 주세요.",
                },
                "emergency_help": {
                    "category": "긴급",
                    "question": "여행 중 긴급 상황이에요.",
                    "answer": "긴급 도움 및 여행 팁에서 카테고리별 안내를 확인하세요. 필요 시 112·119를 이용하세요.",
                },
            }
        }
        fe = {
            "items": {
                "login_help": {
                    "category": "Login/Account",
                    "question": "I can't log in or I see an account error.",
                    "answer": "Update the app, clear cache, and try again. If it persists, use Inquiry.",
                },
                "first_steps": {
                    "category": "Getting started",
                    "question": "Where should I start?",
                    "answer": "Try Trip Planner, Schedule, and Discover from home. See the user guide for steps.",
                },
                "update_notes": {
                    "category": "Updates",
                    "question": "Where are release notes?",
                    "answer": "Open Customer Center > Notices.",
                },
                "refund_flow": {
                    "category": "Billing",
                    "question": "How do refunds work?",
                    "answer": "See Subscription & billing. Contact us with receipt details for specific orders.",
                },
                "emergency_help": {
                    "category": "Emergency",
                    "question": "I need urgent help while traveling.",
                    "answer": "Open Emergency help for guides. Use 112/119 when needed.",
                },
            }
        }
        return fk, fe

    fk, fe = faq_extra()

    ko_customer = deepcopy(ko["customer"])
    en_customer = deepcopy(en["customer"])
    ko_customer["faq"] = {
        **ko_customer.get("faq", {}),
        **fk,
        "count": "총 {count}건",
    }
    en_customer["faq"] = {
        **en_customer.get("faq", {}),
        **fe,
        "count": "{count} items",
    }

    ko_customer["notices"] = {
        **ko_customer.get("notices", {}),
        "new_button_alert": "새 공지 작성 기능은 준비 중입니다.",
        "seed": {
            "author": {"ops": "운영팀"},
            "3": {
                "title": "v1.0.2 배포 안내 (문의하기 UX 개선)",
                "content": "문의하기/문의 내역 UI 탭 전환이 추가되었습니다.\n보다 편리하게 내 문의를 확인할 수 있습니다.",
            },
            "4": {
                "title": "점검사항: 일부 이미지 업로드 지연 해결",
                "content": "특정 환경에서 이미지 업로드가 지연되던 이슈를 수정했습니다.\n재시도 후에도 문제가 있으면 문의해 주세요.",
            },
            "5": {
                "title": "공지사항 필터 기능 업데이트 안내",
                "content": "공지사항 화면에서 유형/검색 필터가 적용됩니다.\n보다 빠르게 필요한 공지를 찾을 수 있어요.",
            },
            "6": {
                "title": "서버 정기 점검 안내 (예정)",
                "content": "정기 점검으로 인해 일부 기능이 일시 중단될 수 있습니다.\n점검 시간 및 영향 범위는 공지 하단을 확인해 주세요.",
            },
            "7": {
                "title": "v1.0.3 배포 안내 (성능 개선 및 버그 수정)",
                "content": "이번 배포에서는 화면 로딩 속도 개선과 일부 오류 수정이 포함되어 있습니다.\n업데이트 후에도 문제가 지속되면 고객센터로 문의해 주세요.",
            },
        },
    }

    ko_inq = dict(ko_customer["inquiry"])
    ko_form = dict(ko_inq.get("form") or {})
    ko_form.setdefault("validation", "제목·내용을 입력하고 개인정보 동의에 체크해 주세요.")
    ko_form.setdefault("add_files", "이미지 추가")
    ko_inq["form"] = ko_form
    ko_customer["inquiry"] = {
        **ko_inq,
        "seed": {
            "10001": {
                "title": "로그인이 되지 않을 때",
                "content": "로그인 버튼을 눌러도 페이지가 로딩만 되고 로그인이 안 됩니다.\n브라우저 캐시를 지워도 동일해요.",
            },
            "10002": {
                "title": "공지사항 확인 경로 문의",
                "content": "공지 및 업데이트 내용을 어디에서 확인할 수 있나요?",
                "answer": "고객센터의 ‘공지사항’ 카테고리에서 최신 변경사항을 확인할 수 있어요.",
            },
        },
    }

    # Korean subscription copy (web en.json structure, localized labels)
    sub_ko = {
        "title_mobile": "구독",
        "title": "결제 및 서비스 이용",
        "subtitle": "무료 체험 후 원하는 플랜을 선택하세요.",
        "safety": "안전 결제 · 언제든 해지 가능",
        "free": {
            "kicker": "지금 무료로 시작",
            "note": "7일 무료 후 선택한 플랜으로 자동 전환됩니다.",
        },
        "plan_monthly": {
            "title": "월간 플랜",
            "badge": "베이직",
            "price": "월 5,900원",
            "note": "매월 결제",
            "features": {
                "1": "전문가형 추천 요약",
                "2": "문의/가이드 우선 답변",
                "3": "최신 기능 업데이트 포함",
            },
        },
        "plan_yearly": {
            "title": "연간 플랜",
            "badge": "추천",
            "price": "연 46,800원",
            "note": "연 단위 결제",
            "oldPrice": "월 약 7,000원 수준",
            "features": {
                "1": "월간 혜택 전부 포함",
                "2": "연간 할인 적용",
                "3": "우선 지원 및 안정성",
            },
        },
        "cta_monthly": "월간 구독 시작",
        "cta_yearly": "연간 구독 시작",
        "selected": {"title": "선택한 플랜", "compare": "비교 ", "includes": "포함 혜택"},
        "agree": {
            "service_title": "서비스 이용 동의",
            "service_desc": "구독 결제 및 이용에 필요합니다.",
            "billing_title": "결제 안내 동의",
            "billing_desc": "자동 전환 및 과금 주기 안내에 동의합니다.",
        },
        "demo_alert": "(데모) 실제 결제 API는 추후 연동 예정입니다.",
        "demo_note": "데모 화면입니다. 운영 환경에서 실제 결제/자동 전환이 적용됩니다.",
    }
    ko_customer["subscription"] = sub_ko

    # Korean emergency: shallow titles matching en keys used in UI
    em_en = en_customer.get("emergency", {})
    em_ko = deepcopy(em_en) if em_en else {}
    if em_ko:
        em_ko["title_mobile"] = "긴급 도움"
        em_ko["title"] = "긴급 도움 및 여행 팁"
        em_ko["subtitle"] = "한국 여행 중 외국인이 겪을 수 있는 긴급 상황별 안내입니다."
        em_ko["share_button"] = "긴급 상황 공유"
        cons = em_ko.get("consulate", {})
        cons["title"] = "대사관/영사관"
        cons["nationality"] = "국적"
        cons["find_contact"] = "영사관 연락처 찾기"
        cons["callcenter"] = "영사콜센터 24시간 02-3210-0404"
        cons["unknown_nationality"] = "미선택"
        em_ko["consulate"] = cons
        cats = em_ko.get("categories", {})
        cats["title"] = "긴급 유형"
        cats["selected"] = "선택됨"
        cats["view"] = "보기"
        items = cats.get("items", {})
        titles = {
            "passport": ("여권·비자·체류 지원", "여권 분실·비자/체류 관련 도움이 필요할 때"),
            "lost": ("분실·도난 신고", "지갑·휴대폰 등을 잃었을 때"),
            "safety": ("범죄·폭력·안전 위협", "사기·폭행·위협 등 위험 상황"),
            "medical": ("응급 의료·사고 부상", "갑작스런 질병이나 부상"),
            "disaster": ("화재·재난·대피", "화재·폭우·정전 등"),
            "immigration": ("출입국·강제출국 이슈", "체류 초과 등 행정 문제"),
            "interpreter": ("영사관·통역 요청", "언어 장벽으로 도움 요청이 어려울 때"),
        }
        for key, (title, short) in titles.items():
            if key in items:
                items[key]["title"] = title
                items[key]["short"] = short
        cats["items"] = items
        em_ko["categories"] = cats
        det = em_ko.get("detail", {})
        det["badge"] = "대응 가이드"
        det["call_police"] = "112 경찰"
        det["call_119"] = "119 구급"
        det["call_1339"] = "1339 질병관리청"
        det["call_consulate"] = "영사관 연락"
        em_ko["detail"] = det
    ko_customer["emergency"] = em_ko

    en_inq = dict(en_customer.get("inquiry") or {})
    en_form = dict(en_inq.get("form") or {})
    en_form.setdefault(
        "validation",
        "Please enter title and details, and agree to privacy terms.",
    )
    en_form.setdefault("add_files", "Add images")
    en_inq["form"] = en_form
    if "seed" not in en_inq:
        en_inq["seed"] = {
            "10001": {
                "title": "Cannot log in",
                "content": "The login button keeps loading.\nClearing cache did not help.",
            },
            "10002": {
                "title": "Where to read notices",
                "content": "Where can I find updates?",
                "answer": "Open Customer Center > Notices for the latest changes.",
            },
        }
    en_customer["inquiry"] = en_inq

    sidebar_ko = dict(ko["sidebar"])
    sidebar_ko.setdefault("section_category", "카테고리")
    sidebar_ko.setdefault("settings_short", "설정")
    sidebar_en = dict(en["sidebar"])
    sidebar_en.setdefault("section_category", "Categories")
    sidebar_en.setdefault("settings_short", "Settings")

    out_ko = {
        "app": ko.get("app", {"name": "Kroaddy"}),
        "common": {
            **ko.get("common", {}),
            "close": "닫기",
            "language": "언어",
            "search": "검색",
        },
        "sidebar": sidebar_ko,
        "customer": ko_customer,
    }
    out_en = {
        "app": en.get("app", {"name": "Kroaddy"}),
        "common": {
            **en.get("common", {}),
            "close": "Close",
            "language": "Language",
            "search": "Search",
        },
        "sidebar": sidebar_en,
        "customer": en_customer,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ko.json").write_text(
        json.dumps(out_ko, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT / "en.json").write_text(
        json.dumps(out_en, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("Wrote", OUT / "ko.json", OUT / "en.json")


if __name__ == "__main__":
    main()
