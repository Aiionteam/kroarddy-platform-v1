#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sync Flutter assets/translations/*.json from web.kroaddy.site locales:
- dedupe first `home` block
- sidebar, guide_explore, home overlay (as before)
- settings (deep-merge), options (travel profile chips)
- chat tier + group list copy
- tourstar feed strings
- planner.standard → screens.planner
- common.language
- fix screens.chat.min_honor_required {{min}} → {min} for easy_localization namedArgs
- screens.profile field labels (short)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
FRONT = HERE.parents[2]
WEB = FRONT / "web.kroaddy.site" / "src" / "lib" / "i18n" / "locales"
FLUTTER_TR = FRONT / "flutter" / "assets" / "translations"

LANGS = ("en", "ko", "th", "ja", "zh", "vi", "id", "de", "fr", "hi")

COMMON_LANGUAGE = {
    "en": "Language",
    "ko": "언어",
    "th": "ภาษา",
    "ja": "言語",
    "zh": "语言",
    "vi": "Ngôn ngữ",
    "id": "Bahasa",
    "de": "Sprache",
    "fr": "Langue",
    "hi": "भाषा",
}

PROFILE_FIELD_LABELS = {
    "gender": {
        "en": "Gender",
        "ko": "성별",
        "th": "เพศ",
        "ja": "性別",
        "zh": "性别",
        "vi": "Giới tính",
        "id": "Jenis kelamin",
        "de": "Geschlecht",
        "fr": "Genre",
        "hi": "लिंग",
    },
    "age": {
        "en": "Age group",
        "ko": "나이대",
        "th": "ช่วงอายุ",
        "ja": "年齢層",
        "zh": "年龄段",
        "vi": "Độ tuổi",
        "id": "Kelompok usia",
        "de": "Altersgruppe",
        "fr": "Tranche d’âge",
        "hi": "आयु समूह",
    },
    "diet": {
        "en": "Dietary preferences",
        "ko": "식습관",
        "th": "อาหารที่ทาน",
        "ja": "食事の好み",
        "zh": "饮食习惯",
        "vi": "Chế độ ăn",
        "id": "Preferensi makanan",
        "de": "Ernährung",
        "fr": "Régime alimentaire",
        "hi": "खान-पान",
    },
    "religion": {
        "en": "Religion",
        "ko": "종교",
        "th": "ศาสนา",
        "ja": "宗教",
        "zh": "宗教",
        "vi": "Tôn giáo",
        "id": "Agama",
        "de": "Religion",
        "fr": "Religion",
        "hi": "धर्म",
    },
    "nationality": {
        "en": "Nationality / region",
        "ko": "국적",
        "th": "สัญชาติ",
        "ja": "国・地域",
        "zh": "国籍/地区",
        "vi": "Quốc tịch",
        "id": "Kewarganegaraan",
        "de": "Nationalität",
        "fr": "Nationalité",
        "hi": "राष्ट्रीयता",
    },
    "account_mgmt": {
        "en": "Account management",
        "ko": "계정 관리",
        "th": "จัดการบัญชี",
        "ja": "アカウント管理",
        "zh": "账户管理",
        "vi": "Quản lý tài khoản",
        "id": "Kelola akun",
        "de": "Kontoverwaltung",
        "fr": "Gestion du compte",
        "hi": "खाता प्रबंधन",
    },
}

PLANNER_CTRL = {
    "en": {
        "msg_generating_routes": "Generating recommended routes...",
        "msg_no_routes": "Could not get recommended routes.",
        "msg_routes_received": "Received {count} recommended routes.",
        "msg_route_failed": "Route fetch failed: {error}",
        "msg_schedule_generating": "Building schedule for selected route...",
        "msg_no_schedule": "Could not get a schedule.",
        "msg_schedule_done": "Schedule ready ({count} items)",
        "msg_schedule_failed": "Schedule fetch failed: {error}",
        "msg_nothing_to_save": "No schedule to save.",
        "msg_saving_plan": "Saving schedule...",
        "msg_saved_plan": "Saved (plan id: {id})",
        "msg_save_failed": "Save failed: {error}",
    },
    "ko": {
        "msg_generating_routes": "추천 루트를 생성하는 중...",
        "msg_no_routes": "추천 루트를 받지 못했습니다.",
        "msg_routes_received": "추천 루트 {count}개를 받았습니다.",
        "msg_route_failed": "루트 조회 실패: {error}",
        "msg_schedule_generating": "선택 루트 일정 생성 중...",
        "msg_no_schedule": "일정을 받지 못했습니다.",
        "msg_schedule_done": "일정 {count}개 항목 생성 완료",
        "msg_schedule_failed": "일정 조회 실패: {error}",
        "msg_nothing_to_save": "저장할 일정이 없습니다.",
        "msg_saving_plan": "일정 저장 중...",
        "msg_saved_plan": "저장 완료 (plan_id: {id})",
        "msg_save_failed": "저장 실패: {error}",
    },
    "th": {
        "msg_generating_routes": "กำลังสร้างเส้นทางแนะนำ...",
        "msg_no_routes": "ไม่สามารถรับเส้นทางแนะนำได้",
        "msg_routes_received": "ได้รับเส้นทางแนะนำ {count} เส้นทาง",
        "msg_route_failed": "โหลดเส้นทางไม่สำเร็จ: {error}",
        "msg_schedule_generating": "กำลังสร้างตารางสำหรับเส้นทางที่เลือก...",
        "msg_no_schedule": "ไม่สามารถรับตารางได้",
        "msg_schedule_done": "ตารางพร้อมแล้ว ({count} รายการ)",
        "msg_schedule_failed": "โหลดตารางไม่สำเร็จ: {error}",
        "msg_nothing_to_save": "ไม่มีตารางให้บันทึก",
        "msg_saving_plan": "กำลังบันทึกตาราง...",
        "msg_saved_plan": "บันทึกแล้ว (plan id: {id})",
        "msg_save_failed": "บันทึกไม่สำเร็จ: {error}",
    },
    "ja": {
        "msg_generating_routes": "おすすめルートを生成しています...",
        "msg_no_routes": "おすすめルートを取得できませんでした。",
        "msg_routes_received": "おすすめルート {count} 件を取得しました。",
        "msg_route_failed": "ルート取得に失敗: {error}",
        "msg_schedule_generating": "選択したルートのスケジュールを作成中...",
        "msg_no_schedule": "スケジュールを取得できませんでした。",
        "msg_schedule_done": "スケジュール準備完了（{count} 件）",
        "msg_schedule_failed": "スケジュール取得に失敗: {error}",
        "msg_nothing_to_save": "保存するスケジュールがありません。",
        "msg_saving_plan": "スケジュールを保存中...",
        "msg_saved_plan": "保存しました（plan id: {id}）",
        "msg_save_failed": "保存に失敗: {error}",
    },
    "zh": {
        "msg_generating_routes": "正在生成推荐路线...",
        "msg_no_routes": "无法获取推荐路线。",
        "msg_routes_received": "已收到 {count} 条推荐路线。",
        "msg_route_failed": "获取路线失败：{error}",
        "msg_schedule_generating": "正在为所选路线生成行程...",
        "msg_no_schedule": "无法获取行程。",
        "msg_schedule_done": "行程已就绪（{count} 项）",
        "msg_schedule_failed": "获取行程失败：{error}",
        "msg_nothing_to_save": "没有可保存的行程。",
        "msg_saving_plan": "正在保存行程...",
        "msg_saved_plan": "已保存（plan id: {id}）",
        "msg_save_failed": "保存失败：{error}",
    },
    "vi": {
        "msg_generating_routes": "Đang tạo lộ trình gợi ý...",
        "msg_no_routes": "Không lấy được lộ trình gợi ý.",
        "msg_routes_received": "Đã nhận {count} lộ trình gợi ý.",
        "msg_route_failed": "Lấy lộ trình thất bại: {error}",
        "msg_schedule_generating": "Đang tạo lịch cho lộ trình đã chọn...",
        "msg_no_schedule": "Không lấy được lịch trình.",
        "msg_schedule_done": "Lịch trình sẵn sàng ({count} mục)",
        "msg_schedule_failed": "Lấy lịch thất bại: {error}",
        "msg_nothing_to_save": "Không có lịch để lưu.",
        "msg_saving_plan": "Đang lưu lịch trình...",
        "msg_saved_plan": "Đã lưu (plan id: {id})",
        "msg_save_failed": "Lưu thất bại: {error}",
    },
    "id": {
        "msg_generating_routes": "Membuat rute rekomendasi...",
        "msg_no_routes": "Tidak bisa mendapatkan rute rekomendasi.",
        "msg_routes_received": "Menerima {count} rute rekomendasi.",
        "msg_route_failed": "Gagal mengambil rute: {error}",
        "msg_schedule_generating": "Membuat jadwal untuk rute terpilih...",
        "msg_no_schedule": "Tidak bisa mendapatkan jadwal.",
        "msg_schedule_done": "Jadwal siap ({count} item)",
        "msg_schedule_failed": "Gagal mengambil jadwal: {error}",
        "msg_nothing_to_save": "Tidak ada jadwal untuk disimpan.",
        "msg_saving_plan": "Menyimpan jadwal...",
        "msg_saved_plan": "Tersimpan (plan id: {id})",
        "msg_save_failed": "Gagal menyimpan: {error}",
    },
    "de": {
        "msg_generating_routes": "Empfohlene Routen werden erstellt...",
        "msg_no_routes": "Empfohlene Routen konnten nicht geladen werden.",
        "msg_routes_received": "{count} empfohlene Routen erhalten.",
        "msg_route_failed": "Routenabruf fehlgeschlagen: {error}",
        "msg_schedule_generating": "Zeitplan für ausgewählte Route wird erstellt...",
        "msg_no_schedule": "Kein Zeitplan verfügbar.",
        "msg_schedule_done": "Zeitplan fertig ({count} Einträge)",
        "msg_schedule_failed": "Zeitplan-Abruf fehlgeschlagen: {error}",
        "msg_nothing_to_save": "Kein Zeitplan zum Speichern.",
        "msg_saving_plan": "Zeitplan wird gespeichert...",
        "msg_saved_plan": "Gespeichert (Plan-ID: {id})",
        "msg_save_failed": "Speichern fehlgeschlagen: {error}",
    },
    "fr": {
        "msg_generating_routes": "Génération des itinéraires recommandés...",
        "msg_no_routes": "Impossible d’obtenir d’itinéraires recommandés.",
        "msg_routes_received": "{count} itinéraires recommandés reçus.",
        "msg_route_failed": "Échec du chargement d’itinéraire : {error}",
        "msg_schedule_generating": "Création du programme pour l’itinéraire sélectionné...",
        "msg_no_schedule": "Impossible d’obtenir un programme.",
        "msg_schedule_done": "Programme prêt ({count} éléments)",
        "msg_schedule_failed": "Échec du chargement du programme : {error}",
        "msg_nothing_to_save": "Aucun programme à enregistrer.",
        "msg_saving_plan": "Enregistrement du programme...",
        "msg_saved_plan": "Enregistré (plan id : {id})",
        "msg_save_failed": "Échec de l’enregistrement : {error}",
    },
    "hi": {
        "msg_generating_routes": "अनुशंसित मार्ग बनाए जा रहे हैं...",
        "msg_no_routes": "अनुशंसित मार्ग नहीं मिल सके।",
        "msg_routes_received": "{count} अनुशंसित मार्ग मिले।",
        "msg_route_failed": "मार्ग लोड विफल: {error}",
        "msg_schedule_generating": "चयनित मार्ग के लिए कार्यक्रम बनाया जा रहा है...",
        "msg_no_schedule": "कार्यक्रम नहीं मिल सका।",
        "msg_schedule_done": "कार्यक्रम तैयार ({count} आइटम)",
        "msg_schedule_failed": "कार्यक्रम लोड विफल: {error}",
        "msg_nothing_to_save": "सहेजने के लिए कोई कार्यक्रम नहीं।",
        "msg_saving_plan": "कार्यक्रम सहेजा जा रहा है...",
        "msg_saved_plan": "सहेजा गया (plan id: {id})",
        "msg_save_failed": "सहेजना विफल: {error}",
    },
}


def find_matching_brace(s: str, open_idx: int) -> int:
    depth = 0
    i = open_idx
    while i < len(s):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        elif c == '"':
            i += 1
            while i < len(s):
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == '"':
                    break
                i += 1
        i += 1
    raise ValueError("unbalanced braces")


def remove_first_home_block(text: str) -> str:
    key = '  "home": {'
    pos = text.find(key)
    if pos == -1:
        return text
    if text.find(key, pos + 10) == -1:
        return text
    open_brace = text.find("{", pos)
    close_brace = find_matching_brace(text, open_brace)
    end = close_brace + 1
    while end < len(text) and text[end] in " \t\r\n":
        end += 1
    if end < len(text) and text[end] == ",":
        end += 1
    while end < len(text) and text[end] in " \t\r\n":
        end += 1
    return text[:pos] + text[end:]


def merge_sidebar(web: dict, flutter: dict) -> dict:
    wsb = dict(web.get("sidebar") or {})
    fsb = flutter.get("sidebar") or {}
    for k in ("section_category", "settings_short"):
        if k in fsb and k not in wsb:
            wsb[k] = fsb[k]
    return wsb


def deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def merge_guide_explore(web: dict, screens: dict) -> None:
    g = web.get("guide") or {}
    cat = g.get("category") or {}
    pr = g.get("prompt") or {}
    ch = g.get("chat") or {}
    screens.setdefault("guide_explore", {})
    ge = dict(screens["guide_explore"])
    pairs = [
        ("cat_all", "all"),
        ("cat_festival", "festival"),
        ("cat_activity", "activity"),
        ("cat_historic", "historic"),
        ("cat_culture", "culture"),
        ("cat_nature", "nature"),
        ("cat_restaurant", "restaurant"),
        ("cat_cafe", "cafe"),
    ]
    for fk, wk in pairs:
        v = cat.get(wk)
        if v:
            ge[fk] = v
    for key in ("activity", "historic", "culture", "nature", "restaurant", "cafe"):
        v = pr.get(key)
        if v:
            ge[f"prompt_{key}"] = v
    if g.get("gemini_notice"):
        ge["gemini_notice"] = g["gemini_notice"]
    if g.get("places_none"):
        ge["places_none"] = g["places_none"]
    if g.get("places_extra"):
        ge["places_extra"] = g["places_extra"]
    if ch.get("placeholder"):
        ge["input_hint"] = ch["placeholder"]
    if g.get("nearby_category_fallback"):
        ge["food_category_fallback"] = g["nearby_category_fallback"]
    if g.get("info_none"):
        ge["info_none"] = g["info_none"]
    screens["guide_explore"] = ge


def overlay_home(web: dict, home: dict) -> dict:
    wh = web.get("home") or {}
    news = wh.get("news") or {}
    rebate = wh.get("rebate") or {}
    kc = wh.get("kcontent") or {}
    out = dict(home)
    if news.get("analyzing"):
        out["news_pending"] = news["analyzing"]
    if rebate.get("period"):
        out["rebate_period"] = rebate["period"]
    if rebate.get("title"):
        out["rebate_title"] = rebate["title"]
    if rebate.get("visit_korea"):
        vk = rebate["visit_korea"]
        out["visit_korea"] = vk if ("↗" in vk or "http" in vk.lower()) else f"{vk} ↗"
    if rebate.get("expand"):
        out["rebate_expand"] = rebate["expand"]
    if rebate.get("fold"):
        out["rebate_collapse"] = rebate["fold"]
    if rebate.get("notice"):
        out["rebate_notice"] = rebate["notice"]
    if rebate.get("targets"):
        out["rebate_regions"] = rebate["targets"]
    if kc.get("title"):
        out["k_content_title"] = kc["title"]
    return out


def _strip_html_b(s: str) -> str:
    return re.sub(r"</?b>", "", s or "")


def _icu_to_easy(s: str) -> str:
    """Web uses {{name}}; easy_localization namedArgs use {name}."""
    return re.sub(r"\{\{(\w+)\}\}", r"{\1}", s or "")


def merge_planner_screens(web: dict, screens: dict, lang: str) -> None:
    std = (web.get("planner") or {}).get("standard") or {}
    pl = screens.setdefault("planner", {})
    if std.get("search_placeholder"):
        pl["search_hint"] = std["search_placeholder"]
    if std.get("search_result"):
        pl["search_result"] = _icu_to_easy(std["search_result"])
    if std.get("metro_quick"):
        pl["section_metro"] = std["metro_quick"]
    if std.get("province"):
        pl["section_province"] = std["province"]
    pop = std.get("popular") or "Popular"
    pl["top_spots_row"] = f"{pop} TOP"
    if lang == "ko":
        pl["top_spots_row"] = "인기 TOP 여행지"
        pl["more_destinations"] = "더 많은 여행지"
    elif lang == "ja":
        pl["more_destinations"] = "その他のスポット"
    elif lang == "th":
        pl["more_destinations"] = "จุดหมายเพิ่มเติม"
    else:
        pl["more_destinations"] = "More destinations"

    start_end = {
        "en": ("Start {date}", "End {date}"),
        "ko": ("시작일 {date}", "종료일 {date}"),
        "ja": ("開始 {date}", "終了 {date}"),
        "zh": ("开始 {date}", "结束 {date}"),
        "th": ("เริ่ม {date}", "สิ้นสุด {date}"),
        "vi": ("Bắt đầu {date}", "Kết thúc {date}"),
        "id": ("Mulai {date}", "Selesai {date}"),
        "de": ("Start {date}", "Ende {date}"),
        "fr": ("Début {date}", "Fin {date}"),
        "hi": ("शुरू {date}", "समाप्त {date}"),
    }
    sp, ep = start_end.get(lang, start_end["en"])
    pl["start_date"] = sp
    pl["end_date"] = ep

    if std.get("mode_car"):
        pl["transport_car"] = std["mode_car"]
    if std.get("mode_transit"):
        pl["transport_transit"] = std["mode_transit"]
    if std.get("mode_walk"):
        pl["transport_walk"] = std["mode_walk"]
    if std.get("generate_route"):
        pl["generate_route"] = std["generate_route"]
    if std.get("generating_loading"):
        pl["generating"] = std["generating_loading"]
    if std.get("set_date_and_generate"):
        pl["hint_set_date"] = std["set_date_and_generate"].replace("\\n", "\n")
    if std.get("ai_recommended_routes"):
        pl["ai_routes_title"] = std["ai_recommended_routes"]
    ms = std.get("making_schedule")
    if ms:
        pl["making_schedule_progress"] = _icu_to_easy(_strip_html_b(ms))
    boost = {
        "en": "Boost recommendations with web search",
        "ko": "웹 검색 기반 추천 강화",
        "ja": "Web検索でおすすめを強化",
        "zh": "使用网页搜索增强推荐",
        "th": "เพิ่มคำแนะนำด้วยการค้นเว็บ",
        "vi": "Tăng cường gợi ý bằng tìm kiếm web",
        "id": "Perkuat rekomendasi dengan pencarian web",
        "de": "Empfehlungen per Websuche verbessern",
        "fr": "Enrichir les recommandations via la recherche web",
        "hi": "वेब खोज से सुझाव बेहतर करें",
    }
    pl["boost_web_search"] = boost.get(lang, boost["en"])
    trip = {
        "en": "Trip schedule",
        "ko": "여행 일정",
        "ja": "旅行スケジュール",
        "zh": "行程",
        "th": "ตารางทริป",
        "vi": "Lịch trình",
        "id": "Jadwal perjalanan",
        "de": "Reiseplan",
        "fr": "Programme du voyage",
        "hi": "यात्रा कार्यक्रम",
    }
    pl["schedule_title"] = trip.get(lang, trip["en"])
    st = {
        "en": "Enter a region code for route suggestions (e.g. seoul, busan).",
        "ko": "지역 코드를 입력하고 루트 추천을 받아보세요. (예: seoul, busan)",
        "ja": "地域コードを入力してルート提案を取得（例: seoul, busan）",
        "zh": "输入地区代码获取路线推荐（如 seoul, busan）",
        "th": "ใส่รหัสพื้นที่เพื่อรับเส้นทางแนะนำ (เช่น seoul, busan)",
        "vi": "Nhập mã khu vực để nhận gợi ý lộ trình (vd: seoul, busan)",
        "id": "Masukkan kode wilayah untuk saran rute (mis. seoul, busan)",
        "de": "Geben Sie einen Regionscode ein (z. B. seoul, busan).",
        "fr": "Saisissez un code région (ex. seoul, busan).",
        "hi": "रूट सुझावों के लिए क्षेत्र कोड दर्ज करें (जैसे seoul, busan)",
    }
    pl["status_enter_region"] = st.get(lang, st["en"])
    sr = {
        "en": "Please enter a region code.",
        "ko": "지역 코드를 입력해 주세요.",
        "ja": "地域コードを入力してください。",
        "zh": "请输入地区代码。",
        "th": "กรุณาใส่รหัสพื้นที่",
        "vi": "Vui lòng nhập mã khu vực.",
        "id": "Masukkan kode wilayah.",
        "de": "Bitte Regionscode eingeben.",
        "fr": "Veuillez saisir un code région.",
        "hi": "कृपया क्षेत्र कोड दर्ज करें।",
    }
    pl["status_region_required"] = sr.get(lang, sr["en"])
    pr = {
        "en": "Please select a region and route first.",
        "ko": "지역과 루트를 먼저 선택해 주세요.",
        "ja": "先に地域とルートを選んでください。",
        "zh": "请先选择地区和路线。",
        "th": "โปรดเลือกพื้นที่และเส้นทางก่อน",
        "vi": "Hãy chọn khu vực và lộ trình trước.",
        "id": "Pilih wilayah dan rute terlebih dahulu.",
        "de": "Bitte zuerst Region und Route wählen.",
        "fr": "Choisissez d’abord la région et l’itinéraire.",
        "hi": "पहले क्षेत्र और मार्ग चुनें।",
    }
    pl["status_pick_route"] = pr.get(lang, pr["en"])
    if std.get("save_plan"):
        pl["save_plan"] = std["save_plan"]
    if std.get("saved_goto_schedule"):
        pl["saved_goto_schedule"] = _icu_to_easy(std["saved_goto_schedule"])
    if std.get("pick_route"):
        pl["schedule_pick_route_hint"] = _icu_to_easy(std["pick_route"])
    sched = (web.get("planner") or {}).get("schedule") or {}
    if sched.get("item_count"):
        pl["schedule_item_count"] = _icu_to_easy(sched["item_count"])
    rnf = {
        "en": "selected route",
        "ko": "선택한 루트",
        "th": "เส้นทางที่เลือก",
        "ja": "選択したルート",
        "zh": "所选路线",
        "vi": "lộ trình đã chọn",
        "id": "rute terpilih",
        "de": "ausgewählte Route",
        "fr": "itinéraire sélectionné",
        "hi": "चयनित मार्ग",
    }
    pl["route_name_fallback"] = rnf.get(lang, rnf["en"])
    gh = {
        "en": ("Metropolitan cities", "Provincial regions"),
        "ko": ("광역시·특별시", "도 단위 지역"),
        "th": ("เมืองหลวงและนครใหญ่", "ภูมิภาคระดับจังหวัด"),
        "ja": ("広域市・特別市", "道レベルの地域"),
        "zh": ("广域市与特别市", "省级地区"),
        "vi": ("Đô thị trực thuộc", "Khu vực cấp tỉnh"),
        "id": ("Kota metropolitan", "Wilayah provinsi"),
        "de": ("Metropolregionen", "Provinzen"),
        "fr": ("Métropoles", "Régions provinciales"),
        "hi": ("महानगरीय क्षेत्र", "प्रांतीय क्षेत्र"),
    }
    gm, gp = gh.get(lang, gh["en"])
    pl["grid_header_metro"] = gm
    pl["grid_header_province"] = gp
    se = {
        "en": "No results found.",
        "ko": "검색 결과가 없습니다.",
        "th": "ไม่พบผลลัพธ์",
        "ja": "該当する結果がありません",
        "zh": "未找到结果",
        "vi": "Không có kết quả",
        "id": "Tidak ada hasil",
        "de": "Keine Treffer",
        "fr": "Aucun résultat",
        "hi": "कोई परिणाम नहीं",
    }
    pl["search_empty"] = se.get(lang, se["en"])
    dest_cta = {
        "en": "Plan your {name} trip with AI",
        "ko": "{name} 여행을 AI로 계획해보세요",
        "th": "วางแผนทริป {name} ด้วย AI",
        "ja": "{name}の旅をAIで計画しましょう",
        "zh": "用 AI 规划您的{name}之旅",
        "vi": "Lên kế hoạch chuyến đi {name} với AI",
        "id": "Rencanakan perjalanan {name} dengan AI",
        "de": "Planen Sie Ihre {name}-Reise mit KI",
        "fr": "Planifiez votre voyage à {name} avec l’IA",
        "hi": "{name} की यात्रा AI से योजना बनाएँ",
    }
    pl["dest_plan_cta"] = dest_cta.get(lang, dest_cta["en"])
    ctrl = PLANNER_CTRL.get(lang, PLANNER_CTRL["en"])
    for k, v in ctrl.items():
        pl[k] = v


DELETE_POST = {
    "en": ("Delete post?", "Are you sure you want to delete this post?"),
    "ko": ("게시물 삭제", "정말로 삭제하시겠습니까?"),
    "ja": ("投稿を削除？", "この投稿を削除しますか？"),
    "zh": ("删除帖子？", "确定要删除这条帖子吗？"),
    "th": ("ลบโพสต์?", "ต้องการลบโพสต์นี้หรือไม่?"),
    "vi": ("Xóa bài?", "Bạn có chắc muốn xóa bài này?"),
    "id": ("Hapus posting?", "Yakin ingin menghapus posting ini?"),
    "de": ("Beitrag löschen?", "Diesen Beitrag wirklich löschen?"),
    "fr": ("Supprimer la publication ?", "Voulez-vous vraiment supprimer cette publication ?"),
    "hi": ("पोस्ट हटाएँ?", "क्या आप वाकई इस पोस्ट को हटाना चाहते हैं?"),
}
DELETE_FAIL = {
    "en": "Could not delete the post.",
    "ko": "게시글 삭제에 실패했습니다.",
    "ja": "投稿を削除できませんでした。",
    "zh": "无法删除帖子。",
    "th": "ลบโพสต์ไม่สำเร็จ",
    "vi": "Không thể xóa bài.",
    "id": "Gagal menghapus posting.",
    "de": "Beitrag konnte nicht gelöscht werden.",
    "fr": "Impossible de supprimer la publication.",
    "hi": "पोस्ट हटाई नहीं जा सकी।",
}


def merge_tourstar_screens(web: dict, screens: dict, lang: str) -> None:
    ts = web.get("tourstar") or {}
    st = screens.setdefault("tourstar", {})
    if ts.get("subtitle"):
        st["subtitle"] = ts["subtitle"]
    sea = ts.get("search") or {}
    if sea.get("placeholder"):
        st["search_placeholder"] = sea["placeholder"]
    tabs = ts.get("tabs") or {}
    if tabs.get("all"):
        st["tab_all"] = tabs["all"]
    if tabs.get("mine"):
        st["tab_mine_n"] = _icu_to_easy(tabs["mine"]) + " ({count})"
    if tabs.get("friends"):
        st["tab_friends_n"] = _icu_to_easy(tabs["friends"]) + " ({count})"
    if tabs.get("bookmarked"):
        st["tab_bookmarked_n"] = _icu_to_easy(tabs["bookmarked"]) + " ({count})"
    sort = ts.get("sort") or {}
    if sort.get("latest"):
        st["sort_latest"] = sort["latest"]
    if sort.get("likes"):
        st["sort_honor"] = sort["likes"]
    if sort.get("comments"):
        st["sort_comments"] = sort["comments"]
    if ts.get("new_post"):
        st["fab_new_post"] = ts["new_post"]
    auth = ts.get("author") or {}
    if auth.get("self_caption"):
        st["author_caption_self"] = auth["self_caption"]
    if auth.get("other_caption"):
        st["author_caption_other"] = auth["other_caption"]
    stats = ts.get("stats") or {}
    if stats.get("posts"):
        st["stat_posts"] = stats["posts"]
    if stats.get("scraps"):
        st["stat_scraps"] = stats["scraps"]
    if stats.get("friends"):
        st["stat_friends"] = stats["friends"]
    if ts.get("friend_badge"):
        st["friend_badge"] = ts["friend_badge"]
    emp = ts.get("empty") or {}
    if emp.get("none"):
        st["empty_title"] = emp["none"]
    if emp.get("help_new"):
        st["empty_hint"] = emp["help_new"]
    if emp.get("cta"):
        st["empty_cta"] = emp["cta"]
    ab = ts.get("ai_banner") or {}
    if ab.get("title"):
        st["ai_banner_title"] = ab["title"]
    if ab.get("body"):
        st["ai_banner_body"] = ab["body"]
    if ts.get("back_to_feed_title"):
        st["back_short"] = ts["back_to_feed_title"]
    dt, dc = DELETE_POST.get(lang, DELETE_POST["en"])
    st["delete_post_title"] = dt
    st["delete_post_confirm"] = dc
    st["delete_post_failed"] = DELETE_FAIL.get(lang, DELETE_FAIL["en"])


def merge_chat_screens(web: dict, screens: dict) -> None:
    wch = web.get("chat") or {}
    tier = wch.get("tier") or {}
    grp = wch.get("group") or {}
    ch = screens.setdefault("chat", {})
    if tier.get("silver"):
        ch["tier_silver"] = tier["silver"]
    if tier.get("gold"):
        ch["tier_gold"] = tier["gold"]
    if tier.get("platinum"):
        ch["tier_platinum"] = tier["platinum"]
    if tier.get("diamond"):
        ch["tier_diamond"] = tier["diamond"]
    if grp.get("title_list"):
        ch["room_list_header"] = grp["title_list"]
    if grp.get("rooms_hint"):
        ch["honor_rooms_note"] = grp["rooms_hint"]


def merge_planner_geo(web: dict, data: dict) -> None:
    """Copy planner.dest / planner.region into flat JSON for Flutter (id-based labels)."""
    pln = web.get("planner") or {}
    dest = pln.get("dest")
    region = pln.get("region")
    std = pln.get("standard") or {}
    if not isinstance(dest, dict):
        dest = std.get("dest")
    if not isinstance(region, dict):
        region = std.get("region")
    if isinstance(dest, dict):
        data["planner_dest"] = dest
    if isinstance(region, dict):
        reg_out: dict = {}
        for k, v in region.items():
            if not isinstance(v, dict):
                continue
            nk = str(k).replace("-", "_")
            reg_out[nk] = v
        data["planner_region"] = reg_out


def merge_profile_labels(data: dict, lang: str) -> None:
    prof = data.setdefault("screens", {}).setdefault("profile", {})
    for key, langmap in PROFILE_FIELD_LABELS.items():
        prof[f"label_{key}"] = langmap.get(lang, langmap["en"])


def fix_min_honor_placeholder(data: dict) -> None:
    ch = data.get("screens", {}).get("chat") or {}
    k = "min_honor_required"
    if k in ch and isinstance(ch[k], str):
        ch[k] = ch[k].replace("{{min}}", "{min}")


def process_lang(lang: str) -> None:
    web_path = WEB / f"{lang}.json"
    fl_path = FLUTTER_TR / f"{lang}.json"
    if not web_path.is_file():
        print(f"skip {lang}: missing {web_path}", file=sys.stderr)
        return

    raw = fl_path.read_text(encoding="utf-8")
    cleaned = remove_first_home_block(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"FAIL {lang}: {e}", file=sys.stderr)
        sys.exit(1)

    web = json.loads(web_path.read_text(encoding="utf-8"))

    data["sidebar"] = merge_sidebar(web, data)
    data.setdefault("common", {})["language"] = COMMON_LANGUAGE.get(lang, "Language")

    wopts = web.get("options")
    if isinstance(wopts, dict):
        data["options"] = wopts

    wset = web.get("settings")
    if isinstance(wset, dict):
        data["settings"] = deep_merge(data.get("settings") or {}, wset)

    data.setdefault("screens", {})
    ts = (web.get("tourstar") or {}).get("subtitle")
    if ts:
        data["screens"].setdefault("tourstar", {})
        data["screens"]["tourstar"]["subtitle"] = ts
    merge_guide_explore(web, data["screens"])
    merge_tourstar_screens(web, data["screens"], lang)
    merge_planner_screens(web, data["screens"], lang)
    merge_planner_geo(web, data)
    merge_chat_screens(web, data["screens"])
    merge_profile_labels(data, lang)
    fix_min_honor_placeholder(data)

    if "home" in data:
        data["home"] = overlay_home(web, data["home"])

    fl_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"ok {lang}")


def main() -> None:
    for lang in LANGS:
        process_lang(lang)


if __name__ == "__main__":
    main()
