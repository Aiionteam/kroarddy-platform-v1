# -*- coding: utf-8 -*-
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EN_PATH = ROOT / "src" / "lib" / "i18n" / "locales" / "en.json"
HI_PATH = ROOT / "src" / "lib" / "i18n" / "locales" / "hi.json"


def merge(base, override):
    if isinstance(base, dict) and isinstance(override, dict):
        out = {}
        for k, v in base.items():
            out[k] = merge(v, override.get(k))
        for k, v in override.items():
            if k not in out:
                out[k] = v
        return out
    return override if override is not None else base


def walk_keys(d, p=""):
    if isinstance(d, dict):
        for k, v in d.items():
            yield from walk_keys(v, p + ("." if p else "") + k)
    else:
        yield p


def main():
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    try:
        hi_cur = json.loads(HI_PATH.read_text(encoding="utf-8"))
    except Exception:
        hi_cur = {}

    # Always sync full key coverage from en (preserve existing overrides)
    hi = merge(en, hi_cur)

    # High-frequency namespaces (phase 1)
    hi["common"] = {
        "save": "सहेजें",
        "cancel": "रद्द करें",
        "next": "अगला",
        "skip": "छोड़ें",
        "done": "पूर्ण",
        "loading": "लोड हो रहा है...",
        "saving": "सहेजा जा रहा है...",
        "processing": "प्रोसेस हो रहा है...",
        "error": "कुछ गलत हो गया",
        "logout": "लॉग आउट",
        "menu_open": "मेनू खोलें",
        "search": "खोजें",
        "show_all": "सभी दिखाएँ",
        "back": "वापस",
        "close": "बंद करें",
        "retry": "फिर से कोशिश करें",
        "view_all": "सब देखें",
        "more": "और",
        "delete": "हटाएँ",
        "deleting": "हटाया जा रहा है...",
        "edit": "संपादित करें",
        "submit": "जमा करें",
        "share": "साझा करें",
        "go_back": "वापस जाएँ",
        "confirm": "पुष्टि करें",
        "coming_soon": "जल्द आ रहा है",
        "accept": "स्वीकार करें",
        "login_needed": "लॉगिन आवश्यक है।",
        "login_required": "लॉगिन आवश्यक है",
        "not_found": {
            "message": "आपके द्वारा माँगा गया पेज नहीं मिला।",
            "back_home": "होम पर वापस जाएँ",
        },
    }

    hi["onboarding"] = {
        "title": "यात्रा प्राथमिकताएँ",
        "subtitle": "AI यात्रा सुझावों को आपके लिए व्यक्तिगत बनाने में मदद करें",
        "later": "बाद में",
        "saving": "सहेजा जा रहा है...",
        "nationality": {
            "title": "देश / राष्ट्रीयता",
            "hint": "ऐप आपकी पसंदीदा भाषा में बदल जाएगा",
        },
        "gender": {"title": "लिंग"},
        "age": {"title": "आयु समूह"},
        "diet": {"title": "आहार प्राथमिकताएँ"},
        "religion": {"title": "धर्म"},
    }

    home = dict(hi.get("home", {}))
    home.update(
        {
            "subtitle": "AI के साथ अपनी परफेक्ट यात्रा बनाएँ",
            "planner": {
                "label": "ट्रिप प्लानर",
                "desc": "AI द्वारा सुझाए गए रूट और यात्रा कार्यक्रम",
            },
            "schedule": {"label": "मेरी योजनाएँ", "desc": "सहेजी गई यात्रा योजनाएँ देखें"},
            "guide": {"label": "खोजें", "desc": "रेस्टोरेंट और इवेंट्स एक ही जगह"},
            "kcontent": {
                "label": "K-Content प्लानर",
                "desc": "K-content से प्रेरित यात्राएँ प्लान करें",
                "title": "K-content थीम यात्राएँ",
            },
            "news": {
                "prev": "पिछला",
                "next": "अगला",
                "page_n": "पेज {{page}}",
                "nationwide": "देशभर",
                "analyzing": "AI विश्लेषण जारी है।",
                "error": "समाचार लोड नहीं हो सके।",
            },
            "banner": {
                "title": "बेहतर AI सुझावों के लिए अपनी प्राथमिकताएँ सेट करें!",
                "sub": "पर्सनलाइज्ड रूट के लिए लिंग, उम्र, आहार और धर्म जोड़ें।",
                "setup": "सेट करें",
                "close": "बंद करें",
            },
            "popular": {"title": "लोकप्रिय गंतव्य"},
            "shortcuts": {
                "planner": "ट्रिप प्लानर",
                "kcontent": "K-content",
                "schedule": "शेड्यूल",
                "standard": "स्थानों को खोजें",
                "user": "यूज़र रूट",
                "group": "ग्रुप चैट",
            },
        }
    )
    hi["home"] = home

    hi["sidebar"] = {
        "tourstar": "TourStar",
        "planner": "ट्रिप प्लानर",
        "schedule": "मेरी योजनाएँ",
        "guide": "खोजें",
        "groupchat": "ग्रुप चैट",
        "friends": "दोस्त",
        "whisper": "Whisper",
        "profile": "मेरा प्रोफ़ाइल",
        "customer": "कस्टमर सेंटर",
        "logout": "लॉग आउट",
    }

    hi["settings"] = {
        "title": "सेटिंग्स",
        "account": {
            "title": "अकाउंट",
            "email": "ईमेल",
            "nickname": "उपनाम",
            "default": "(डिफ़ॉल्ट)",
            "nickname_placeholder": "खाली होने पर आपका नाम दिखेगा",
            "nickname_hint": "खाली होने पर आपका नाम दिखेगा।",
            "honor": "सम्मान",
            "point": "पॉइंट्स",
            "provider": "प्रोवाइडर",
        },
        "withdraw": {
            "title": "अकाउंट हटाएँ",
            "desc": "अकाउंट हटाने से आपका डेटा मिट जाएगा और इसे वापस नहीं किया जा सकता।",
            "button": "अकाउंट हटाएँ",
            "confirm_desc": "क्या आप सुनिश्चित हैं? आगे बढ़ने के लिए नीचे Delete account टाइप करें।",
            "placeholder": "Delete account",
            "submit": "हटाएँ",
        },
        "profile": {
            "title": "ट्रैवल प्रोफ़ाइल",
            "subtitle": "AI पर्सनलाइज्ड सुझावों के लिए उपयोग",
            "save": "ट्रैवल प्रोफ़ाइल सहेजें",
        },
    }

    hi["options"] = {
        "gender": {
            "male": "पुरुष",
            "female": "महिला",
            "other": "अन्य",
            "no_answer": "कहना नहीं चाहते",
        },
        "age": {
            "teens": "किशोर",
            "twenties": "20s",
            "thirties": "30s",
            "forties": "40s",
            "fifties": "50s",
            "sixties_plus": "60+",
        },
        "diet": {
            "normal": "सामान्य",
            "vegetarian": "शाकाहारी",
            "vegan": "वीगन",
            "halal": "हलाल",
            "allergy": "एलर्जी",
        },
        "religion": {
            "none": "कोई नहीं",
            "christian": "ईसाई",
            "buddhist": "बौद्ध",
            "catholic": "कैथोलिक",
            "islam": "मुस्लिम",
            "other": "अन्य",
        },
        "nationality": {
            "korea": "कोरिया",
            "japan": "जापान",
            "china": "चीन",
            "usa": "USA",
            "united_kingdom": "यूनाइटेड किंगडम",
            "france": "फ्रांस",
            "germany": "जर्मनी",
            "canada": "कनाडा",
            "australia": "ऑस्ट्रेलिया",
            "vietnam": "वियतनाम",
            "thailand": "थाईलैंड",
            "philippines": "फिलीपींस",
            "indonesia": "इंडोनेशिया",
            "singapore": "सिंगापुर",
            "malaysia": "मलेशिया",
            "india": "भारत",
            "other": "अन्य",
        },
    }

    ps = dict(hi.get("planner.standard", {}))
    ps.update(
        {
            "title": "गंतव्य चुनें",
            "subtitle": "एक जगह चुनें और AI आपके लिए उपयुक्त रूट सुझाएगा",
            "mode_label": "स्टैंडर्ड",
            "date": "तारीख",
            "mode_car": "🚗 कार",
            "mode_transit": "🚇 पब्लिक ट्रांज़िट",
            "mode_walk": "🚶 पैदल",
            "generating_loading": "सटीक जानकारी खोजी जा रही है...",
            "generate_route": "✨ रूट बनाएं",
            "ai_recommended_routes": "AI सुझाए गए रूट",
            "set_date_and_generate": "तारीख सेट करें और\nरूट बनाएं",
            "start_generate": "✨ रूट बनाना शुरू करें",
            "pick_route": "कृपया एक रूट चुनें",
            "range_hint": "AI {{start}} ~ {{end}} के लिए यात्रा कार्यक्रम बनाएगा",
            "select_date_then_generate": "तारीख चुनें फिर रूट बनाएं",
            "generate_hint": "ऊपर बाएँ ✨ रूट बनाएं बटन पर क्लिक करें",
            "making_schedule": "AI <b>{{name}}</b> के लिए यात्रा कार्यक्रम बना रहा है...",
            "recommended_schedule_title": "{{name}} — सुझाया गया यात्रा कार्यक्रम",
            "saved_goto_schedule": "✅ सहेजा गया · शेड्यूल मैनेजर खोलें",
            "save_plan": "💾 सहेजें",
            "total_cost": "अनुमानित कुल लागत",
            "cost_per_day": "दिन{{day}} {{total}}",
            "search_placeholder": "शहर/स्थान खोजें (जैसे Gangneung, Hanok Village)",
            "search_result": "“{{query}}” के परिणाम {{count}} आइटम",
            "no_results": "कोई परिणाम नहीं",
            "reset": "रीसेट",
            "metro_quick": "त्वरित पहुँच (मेट्रो शहर)",
            "metro_quick_sub": "लोकप्रिय मेट्रो शहरों पर जाएँ; नीचे विस्तृत क्षेत्रों को ब्राउज़ करें।",
            "metro_detail": "मेट्रो शहर क्षेत्र",
            "metro_detail_sub": "Seoul/Busan/Daegu/Ulsan जैसी शहर-आधारित यात्राओं के लिए सूक्ष्म क्षेत्र देखें।",
            "province": "प्रांत",
            "province_sub": "Gyeonggi, Chungcheong, Jeolla, Gyeongsang, Gangwon, Jeju जैसे क्षेत्रों की तुलना करें।",
            "image_pending": "चित्र जल्द उपलब्ध होगा",
            "route_load_fail": "रूट लोड नहीं हो सका।",
            "schedule_load_fail": "शेड्यूल लोड नहीं हो सका।",
            "save_fail": "सहेजना विफल रहा।",
            "subtotal": "उप-योग {{total}}",
        }
    )
    ps_theme = dict(ps.get("theme", {}))
    ps_theme.update(
        {
            "event": "इवेंट",
            "food": "भोजन",
            "spot": "आकर्षण",
            "luxury": "लक्ज़री",
            "value": "किफ़ायती",
            "family": "परिवार",
            "couple": "जोड़ा",
        }
    )
    ps["theme"] = ps_theme
    hi["planner.standard"] = ps

    # planner.schedule (phase 2)
    planner = dict(hi.get("planner", {}))
    sch = dict(planner.get("schedule", {}))
    sch.update(
        {
            "title": "मेरी योजनाएँ",
            "subtitle_with_count": "{{count}} सहेजी गई योजनाएँ · किसी दिन को देखने के लिए तारीख पर क्लिक करें",
            "new_route": "+ नया रूट",
            "prev_month": "पिछला महीना",
            "next_month": "अगला महीना",
            "legend": "योजना संकेत",
            "reroll_fail": "दोबारा बनाना विफल रहा।",
            "modify_fail": "संशोधित करना विफल रहा।",
            "view_all_route": "सभी स्टॉप्स के लिए रूट देखें",
            "all_route": "🗺️ पूरा रूट",
            "in_trip_period": "यात्रा अवधि के भीतर",
            "rerolled": "🔄 दोबारा बनाया गया",
            "generating": "बनाया जा रहा है…",
            "reroll_this_item": "इस आइटम को दोबारा बनाएं",
            "view_on_map": "मैप पर देखें",
            "ask_ai_modify": "AI से यात्रा कार्यक्रम बदलने के लिए कहें",
            "modify_placeholder": 'उदा. "Changdeokgung Secret Garden tour को किसी और जगह से बदलें"',
            "ai_modifying": "AI संशोधित कर रहा है…",
            "item_regenerating": "आइटम दोबारा बनाया जा रहा है…",
            "modify_login_needed": "संशोधन फीचर के लिए लॉगिन आवश्यक है",
            "item_count": "{{count}} आइटम",
            "no_items_on_day": "इस दिन के लिए कोई आइटम तय नहीं है",
            "delete_confirm": "क्या इस योजना को हटाएँ?",
            "saved_at": "{{date}} को सहेजा गया",
            "weather_forecast": "🌤 मौसम पूर्वानुमान",
            "within_5days": "· 5 दिनों के भीतर",
            "view_schedule": "यात्रा कार्यक्रम देखें",
            "view_day_route": "दिन {{day}} का रूट देखें",
            "route": "🗺️ रूट",
            "ai_modified": "✨ AI द्वारा संशोधित",
            "load_fail": "योजनाएँ लोड नहीं हो सकीं।",
            "delete_fail": "हटाना विफल रहा।",
            "login_note": "SNS लॉगिन के बाद यात्रा योजनाएँ अपने आप सहेजी जाती हैं",
            "login_needed": "लॉगिन आवश्यक है",
            "empty_title": "कोई सहेजी हुई योजना नहीं",
            "empty_desc": "Trip Planner में कोई रूट चुनें\nऔर AI योजनाएँ अपने आप सहेज देगा",
            "go_planner": "Trip Planner खोलें",
            "list_hint": "सभी योजनाएँ · किसी दिन को देखने के लिए तारीख पर क्लिक करें",
        }
    )
    planner["schedule"] = sch

    # planner.kcontent (phase 3)
    kc = dict(planner.get("kcontent", {}))
    kc.update(
        {
            "subtitle": "K-Pop, ड्रामा, भोजन और ब्यूटी के साथ कोरिया को एक्सप्लोर करें",
            "hero_subtitle": "K-Pop, ड्रामा, भोजन और ब्यूटी के साथ कोरिया को एक्सप्लोर करें",
            "hero_cta": "AI रूट बनाएं",
            "back": "Planner पर वापस",
            "sample_itinerary": "उदाहरण यात्रा कार्यक्रम",
            "search_bar": "खोजें",
            "quick_selection": "त्वरित चयन",
            "vibe_grid": "वाइब चयन",
            "date": "तारीख",
            "generating": "बनाया जा रहा है…",
            "generate": "✨ शेड्यूल बनाएं",
            "ai_recommended": "AI सुझाया शेड्यूल",
            "region_select": "क्षेत्र चुनें",
            "traditional_market": "पारंपरिक बाज़ार",
            "market_generate": "इस बाज़ार का फूड यात्रा कार्यक्रम बनाएं",
            "cafe_question": "आज आपके दिन के लिए कौन-सा वाइब सही है?",
            "cafe_hint": "AI कोर्स बनाने के लिए वाइब चुनें या कैफे का नाम लिखें।",
            "cafe_placeholder": "सीधे कैफे का नाम लिखें (जैसे Seongsu Tongue Planet)",
            "cafe_generate": "AI यात्रा कार्यक्रम बनाएं",
            "trending_items": "अभी ट्रेंडिंग आइटम",
            "my_recipe": "मेरा कॉम्बो रेसिपी",
            "convenience_q": "अभी कन्वीनियंस स्टोर में सबसे मुश्किल से क्या मिलता है?",
            "trending_placeholder": "जैसे Yonsei Milk Cream Bread",
            "recipe_q": "आप कौन-सा फ्लेवर कॉम्बो आज़माना चाहते हैं?",
            "extra_keywords": "अतिरिक्त कीवर्ड",
            "recipe_placeholder": "जैसे स्पाइसी चैलेंज, स्वीट-सॉल्टी डेज़र्ट",
            "recipe_generate": "AI कॉम्बो रेसिपी बनाएं",
            "set_date_and_generate": "तारीख सेट करें और यात्रा कार्यक्रम बनाएं",
            "start_generate": "✨ यात्रा कार्यक्रम बनाना शुरू करें",
            "making_schedule": "AI <b>{{title}}</b> के लिए यात्रा कार्यक्रम बना रहा है…",
            "recommended_schedule_title": "{{title}} — सुझाया गया यात्रा कार्यक्रम",
            "save_plan": "💾 यात्रा कार्यक्रम सहेजें",
            "total_cost": "अनुमानित कुल लागत",
            "cost_per_day": "दिन {{day}} {{total}}",
            "no_schedule": "यात्रा कार्यक्रम नहीं बन सका। कृपया फिर से प्रयास करें।",
            "saved_goto_schedule": "सहेजा गया · शेड्यूल पर जाएँ",
            "find_nearby_store": "इसके पास बेचने वाली जगहें खोजें",
            "description_fallback": "{{place}} में आनंद लेने के लिए एक सुझाया गया स्थान।",
            "challenge_location": "चैलेंज स्थान",
            "challenge_location_desc": "AI द्वारा चुना गया सबसे अच्छा चैलेंज स्पॉट (100km के भीतर) — Seoul Forest, Seongsu के सामने बेंच ज़ोन",
            "subtotal": "उप-योग {{total}}",
            "schedule_item_default": "शेड्यूल",
            "schedule_load_fail": "शेड्यूल लोड नहीं हो सका।",
            "save_fail": "सहेजना विफल रहा।",
            "cafe_place_hint": "कैफे/स्थान संकेत",
            "convenience_trending": "कन्वीनियंस ट्रेंडिंग आइटम",
        }
    )
    planner["kcontent"] = kc
    hi["planner"] = planner

    # customer center main (phase 1)
    customer = dict(hi.get("customer", {}))
    customer["center"] = {
        "title": "कस्टमर सेंटर",
        "subtitle": "आपको जो मदद चाहिए, उसे जल्दी खोजें।",
    }
    customer["search"] = {
        "label": "हम आपकी कैसे मदद कर सकते हैं?",
        "placeholder": "खोज कीवर्ड दर्ज करें",
    }
    customer["categories"] = {
        "title": "श्रेणियाँ",
        "items": {
            "inquiry": {
                "title": "प्रश्न",
                "desc": "अकाउंट, फीचर्स और त्रुटियों से जुड़े सामान्य प्रश्न",
            },
            "guide": {
                "title": "यूज़र गाइड",
                "desc": "सेवा का उपयोग कैसे करें और शुरुआत कैसे करें",
            },
            "notices": {
                "title": "सूचनाएँ",
                "desc": "मेंटेनेंस, रिलीज़ और बदलाव अपडेट",
            },
            "payment": {
                "title": "भुगतान और सेवा",
                "desc": "भुगतान, रिफंड और सब्सक्रिप्शन 안내",
            },
            "emergency": {
                "title": "आपातकालीन सहायता और यात्रा टिप्स",
                "desc": "आपातकालीन प्रतिक्रिया और यात्रा सुरक्षा टिप्स",
            },
        },
    }
    customer.setdefault("faq", {}).update(
        {
            "title": "अक्सर पूछे जाने वाले प्रश्न",
            "no_results": "कोई परिणाम नहीं मिला।",
        }
    )

    # customer.guide page (phase 2)
    customer["guide"] = {
        "title": "यूज़र गाइड",
        "subtitle": "Home से शुरू की जा सकने वाली 5 मुख्य सुविधाओं का त्वरित सारांश।",
        "hero": {
            "kicker": "अपनी पहली यात्रा ऐसे शुरू करें",
            "title": "रूट बनाएं -> शेड्यूल व्यवस्थित करें -> ज़रूरत हो तो शेयर/चैट करें",
            "steps": {
                "planner": "ट्रिप प्लानर",
                "schedule": "शेड्यूल",
                "guide": "खोजें",
                "social": "Tourstar / ग्रुप चैट",
            },
            "cta_planner": "ट्रिप प्लानर शुरू करें",
            "cta_groupchat": "ग्रुप चैट देखें",
        },
        "cards": {
            "tourstar": {
                "title": "Tourstar",
                "subtitle": "यात्रा पोस्ट और रिव्यू एक ही जगह बनाएं और शेयर करें।",
                "cta": "Tourstar पर जाएँ",
                "items": {
                    "1": {
                        "title": "1) फोटो/यात्रा नोट्स तैयार करें",
                        "body": "फोटो अपलोड करें—AI शीर्षक/सारांश में मदद करता है ताकि लिखना तेज़ हो।",
                    },
                    "2": {
                        "title": "2) विज़िबिलिटी चुनें",
                        "body": "ज़रूरत के अनुसार पब्लिक/प्राइवेट में पोस्ट करें।",
                    },
                    "3": {
                        "title": "3) रिएक्शन पाएं",
                        "body": "लाइक/कमेंट से टिप्स साझा करें और दोस्तों से कनेक्ट करें।",
                    },
                },
                "tip": {
                    "title": "टिप",
                    "body": "शीर्षक छोटा रखें और क्रम में लिखें: कब/कहाँ/क्या अच्छा लगा।",
                },
            },
            "planner": {
                "title": "ट्रिप प्लानर",
                "subtitle": "AI आपके ट्रैवल स्टाइल के अनुसार रूट और शेड्यूल सुझाता है।",
                "cta": "ट्रिप प्लानर पर जाएँ",
                "items": {
                    "1": {
                        "label": "Standard / K-content / User content",
                        "body": "शुरू करने के लिए एक चुनें।",
                    },
                    "2": {
                        "label": "गंतव्य (या थीम) चुनें",
                        "body": ": रूट संदर्भ स्पष्ट होने पर AI सुझाव अधिक सटीक होते हैं।",
                    },
                    "3": {"body": "सुझाए गए शेड्यूल ऑटो-सेव होते हैं और शेड्यूल में सुधारे जा सकते हैं।"},
                },
            },
            "schedule": {
                "title": "शेड्यूल",
                "subtitle": "कैलेंडर में सेव प्लान देखें और AI से reroll/modify करें।",
                "cta": "शेड्यूल खोलें",
                "items": {
                    "1": {
                        "title": "1) कैलेंडर में तारीख चुनें",
                        "body": "किसी तारीख पर क्लिक करके उस दिन का प्लान देखें।",
                    },
                    "2": {
                        "title": "2) दूसरे वर्ज़न के लिए reroll",
                        "body": "जो भाग पसंद नहीं, सिर्फ उसे दोबारा बनाएं।",
                    },
                    "3": {
                        "title": "3) AI से बदलाव करवाएँ",
                        "body": "प्रॉम्प्ट से अपना शेड्यूल एडजस्ट करें।",
                    },
                },
                "tip": {
                    "title": "मैप / मौसम",
                    "body": "शेड्यूल कार्ड में ही मैप व्यू और मौसम सारांश देखें।",
                },
            },
            "discover": {
                "title": "खोजें",
                "subtitle": "रेस्टोरेंट और इवेंट जैसे स्थानीय सुझाव एक ही स्क्रीन पर देखें।",
                "cta": "खोजें पर जाएँ",
                "items": {
                    "1": {"title": "1) गाइड चुनें", "body": ": रेस्टोरेंट या इवेंट 추천 टैब चुनें।"},
                    "2": {
                        "title": "2) कार्ड/लिस्ट देखें",
                        "body": ": रुचि वाले स्थान खोलकर विवरण देखें।",
                    },
                    "3": {
                        "body": "प्लान में जोड़ना हो तो Planner/Schedule में अपने रूट के हिसाब से ट्यून करें।"
                    },
                },
            },
            "groupchat": {
                "title": "ग्रुप चैट",
                "subtitle": "हॉनर लेवल के अनुसार रूम जॉइन करें और यात्रा कहानियाँ साझा करें।",
                "cta": "ग्रुप चैट पर जाएँ",
                "items": {
                    "1": {
                        "title": "1) रूम लिस्ट से प्रवेश",
                        "body": ": प्रवेश उपलब्धता हॉनर लेवल पर निर्भर हो सकती है।",
                    },
                    "2": {
                        "title": "2) संदेश भेजें",
                        "body": ": चैट इनपुट में लिखें और रियल-टाइम में भेजें।",
                    },
                    "3": {
                        "title": "3) फ्रेंड/whisper/हॉनर एक्शन",
                        "body": ": संदेश मेनू से whisper, friend add, और honor actions करें।",
                    },
                },
            },
        },
    }
    hi["customer"] = customer

    # customer.emergency + share (phase 3)
    emergency = dict(customer.get("emergency", {}))
    emergency.update(
        {
            "title_mobile": "आपात सहायता",
            "title": "आपात सहायता और यात्रा टिप्स",
            "subtitle": "कोरिया में विदेशियों के सामने आने वाली आपात स्थितियों के लिए श्रेणी-आधारित मार्गदर्शन।",
            "share_button": "आपात साझा करें",
        }
    )

    # merge consulate (preserve any extra fields)
    consulate = dict(emergency.get("consulate", {}))
    consulate.update(
        {
            "title": "दूतावास/कांसुलेट",
            "nationality": "राष्ट्रीयता",
            "find_contact": "कांसुलेट संपर्क खोजें",
            "callcenter": "24h Consular Call Center 02-3210-0404",
            "unknown_nationality": "अज्ञात",
        }
    )
    emergency["consulate"] = consulate

    # merge categories but KEEP categories.items.*
    categories = dict(emergency.get("categories", {}))
    categories.update({"title": "आपात श्रेणियाँ", "selected": "चयनित", "view": "देखें"})
    emergency["categories"] = categories

    # merge detail (preserve any extra fields)
    detail = dict(emergency.get("detail", {}))
    detail.update(
        {
            "badge": "प्रतिक्रिया गाइड",
            "call_police": "112 पुलिस",
            "call_119": "119 आपात",
            "call_1339": "1339 KCDC (चिकित्सा सहायता)",
            "call_consulate": "कांसुलेट संपर्क",
        }
    )
    emergency["detail"] = detail

    # merge share (preserve any extra fields)
    share = dict(emergency.get("share", {}))
    share.update(
        {
            "title_mobile": "आपात साझा करें",
            "title": "सार्वजनिक आपात साझा",
            "type_title": "आपात प्रकार",
            "type_subtitle": "प्रकार चुनें और फोटो/ऑडियो जोड़कर तुरंत साझा करें।",
            "attach_title": "संलग्नक",
            "attach_subtitle": "फोटो या ऑडियो जोड़ने से साझा करना तेज़ होता है।",
            "photo_section": "फोटो जोड़ें",
            "photo_pick": "फोटो चुनें",
            "photo_empty": "कृपया फोटो चुनें।",
            "audio_section": "ऑडियो रिकॉर्डिंग",
            "recording": "रिकॉर्डिंग: {{s}}s",
            "record_ready": "तैयार",
            "optional": "वैकल्पिक",
            "audio_start": "रिकॉर्डिंग शुरू करें",
            "audio_stop": "रोकें",
            "audio_delete": "ऑडियो हटाएँ",
            "audio_perm": "रिकॉर्डिंग अनुमति आवश्यक हो सकती है।",
            "now_title": "अभी साझा करें",
            "now_subtitle": "डेमो UI: यह वास्तविक भेजने के बजाय पुष्टि दिखाता है।",
            "call_emergency": "आपात कॉल",
            "start_button": "आपात साझा शुरू करें",
        }
    )
    aria = dict(share.get("aria", {}))
    aria.update({"select_reason": "{{id}} चुनें"})
    share["aria"] = aria

    share["reason"] = {
        "location": {
            "label": "लोकेशन/सेफ्टी सहायता चाहिए",
            "desc": "अपने वर्तमान स्थान के आधार पर सहायता का अनुरोध करें।",
        },
        "medical": {
            "label": "चिकित्सा सहायता चाहिए",
            "desc": "बीमारी या चोट के कारण आपात चिकित्सा सहायता चाहिए।",
        },
        "danger": {
            "label": "तत्काल खतरे की स्थिति",
            "desc": "हिंसा/धोखाधड़ी/धमकी के कारण तुरंत सुरक्षा सहायता चाहिए।",
        },
    }
    share["alert"] = {
        "audio_permission": "कृपया ऑडियो रिकॉर्डिंग अनुमति जांचें।",
        "select_reason": "कम से कम एक आपात प्रकार चुनें।",
        "attach_required": "कृपया फोटो या ऑडियो संलग्न करें।",
        "start_demo": "आपात साझा शुरू हो रहा है। (डेमो)\nचयनित: {{selected}}",
    }
    emergency["share"] = share

    customer["emergency"] = emergency

    # customer notices / inquiry / inquiries (phase 4)
    notices = dict(customer.get("notices", {}))
    notices.update(
        {
            "title": "सूचनाएँ",
            "subtitle": "नवीनतम सूचनाएँ देखें।",
            "new_button": "नई सूचना लिखें",
            "new_button_alert": "नई सूचना बनाना जल्द उपलब्ध होगा।",
            "search_placeholder": "सूचना खोजें (शीर्षक/सामग्री)",
            "search_button": "खोजें",
            "count": "{{count}} आइटम",
            "no_results": "कोई परिणाम नहीं मिला।",
        }
    )
    notices["table"] = {
        "no": "क्रम",
        "title": "शीर्षक",
        "author": "लेखक",
        "date": "तारीख",
        "views": "दृश्य",
    }
    notices["aria"] = {"select_all": "सभी चुनें", "select_row": "सूचना {{id}} चुनें"}
    notices["modal"] = {"meta": "{{author}} द्वारा · {{date}}", "close": "बंद करें"}
    customer["notices"] = notices

    inquiry = dict(customer.get("inquiry", {}))
    inquiry.update(
        {"title": "हमसे संपर्क करें", "submit_done": "आपकी पूछताछ जमा कर दी गई है।"}
    )
    inquiry["tabs"] = {"write": "1:1 पूछताछ", "list": "मेरी पूछताछ"}
    inquiry["form"] = {
        "subject": "विषय",
        "subject_placeholder": "विषय दर्ज करें",
        "content": "संदेश",
        "content_placeholder": "कृपया विवरण लिखें",
        "attachments": "संलग्नक",
        "attachment_help": "इमेज (GIF, PNG, JPG) प्रति फ़ाइल अधिकतम 10MB, अधिकतम 3 फ़ाइलें",
        "privacy_agree": "व्यक्तिगत जानकारी के संग्रह और उपयोग के लिए सहमति",
        "sending": "भेजा जा रहा है...",
        "submit": "जमा करें",
    }
    inquiry["list"] = {
        "search_label": "खोजें",
        "search_placeholder": "शीर्षक/सामग्री/स्थिति से खोजें",
        "no_results": "कोई परिणाम नहीं मिला।",
    }
    inquiry["status"] = {"answered": "उत्तर दिया गया", "pending": "प्रक्रिया में"}
    customer["inquiry"] = inquiry

    customer["inquiries"] = {
        "title": "मेरी पूछताछ",
        "mobile_title": "पूछताछ इतिहास",
        "subtitle": "अपनी जमा की गई पूछताछ और उत्तर देखें।",
        "my_list": "मेरी पूछताछ सूची",
        "write": "पूछताछ लिखें",
        "search_placeholder": "शीर्षक/सामग्री/स्थिति से खोजें",
        "no_results": "कोई परिणाम नहीं मिला।",
        "status": {"answered": "उत्तर दिया गया", "pending": "प्रक्रिया में"},
        "seed": {
            "10001": {
                "title": "प्रोफाइल इमेज अपलोड नहीं हो रही",
                "content": "मैंने कई बार कोशिश की, लेकिन इमेज चुनने के बाद अपलोड विफल हो जाता है।",
            },
            "10002": {
                "title": "अपना शेड्यूल कैसे बदलूँ?",
                "content": "मैं अपने सेव किए गए itinerary में सिर्फ एक दिन बदलना चाहता/चाहती हूँ।",
                "answer": "शेड्यूल खोलें, तारीख चुनें, फिर reroll या AI modify का उपयोग करके विशेष आइटम समायोजित करें।",
            },
        },
        "detail": {
            "title": "पूछताछ विवरण",
            "mobile_title": "पूछताछ विवरण",
            "back_to_list": "सूची पर वापस",
            "received_at": "प्राप्त समय",
            "content": "सामग्री",
            "attachments": "संलग्नक",
            "no_attachments": "कोई संलग्नक नहीं",
            "answer": "उत्तर",
            "answer_pending": "उत्तर की प्रतीक्षा",
            "not_found": "पूछताछ नहीं मिली",
        },
    }

    # customer.subscription (phase 5)
    customer["subscription"] = {
        "title_mobile": "सब्सक्रिप्शन",
        "title": "सब्सक्रिप्शन",
        "subtitle": "फ्री ट्रायल के बाद अपना प्लान चुनें।",
        "safety": "सुरक्षित भुगतान · कभी भी रद्द करें",
        "free": {
            "kicker": "आज ही मुफ्त शुरू करें",
            "note": "7 दिन के फ्री ट्रायल के बाद चुना गया प्लान अपने आप लागू हो जाएगा।",
        },
        "plan_monthly": {
            "title": "मासिक प्लान",
            "badge": "बेसिक",
            "price": "₩5,900 / month",
            "note": "मासिक बिलिंग",
            "features": {
                "1": "विशेषज्ञ सुझावों के सारांश",
                "2": "पूछताछ/गाइड के लिए प्राथमिकता उत्तर",
                "3": "नवीनतम फीचर अपडेट शामिल",
            },
        },
        "plan_yearly": {
            "title": "वार्षिक प्लान",
            "badge": "अनुशंसित",
            "price": "₩46,800 / year",
            "note": "वार्षिक बिलिंग",
            "oldPrice": "लगभग ₩7,000/माह के बराबर",
            "features": {
                "1": "सभी मासिक लाभ शामिल",
                "2": "वार्षिक छूट लागू",
                "3": "प्राथमिकता सपोर्ट और स्थिरता",
            },
        },
        "cta_monthly": "मासिक सब्सक्रिप्शन शुरू करें",
        "cta_yearly": "वार्षिक सब्सक्रिप्शन शुरू करें",
        "selected": {
            "title": "चुना गया प्लान",
            "compare": "तुलना करें",
            "includes": "शामिल लाभ",
        },
        "agree": {
            "service_title": "सेवा उपयोग की सहमति",
            "service_desc": "सब्सक्रिप्शन भुगतान और उपयोग के लिए आवश्यक।",
            "billing_title": "बिलिंग सूचना की सहमति",
            "billing_desc": "ऑटो स्विच और बिलिंग चक्र के बारे में सूचना।",
        },
        "demo_alert": "(डेमो UI) वास्तविक भुगतान API अगली बार जोड़ी जाएगी।",
        "demo_note": "यह एक डेमो स्क्रीन है। वास्तविक भुगतान/ऑटो-स्विच प्रोडक्शन में काम करता है।",
    }
    hi["customer"] = customer

    HI_PATH.write_text(
        json.dumps(hi, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    missing = set(walk_keys(en)) - set(walk_keys(hi))
    print("missing_in_hi", len(missing))


if __name__ == "__main__":
    main()
