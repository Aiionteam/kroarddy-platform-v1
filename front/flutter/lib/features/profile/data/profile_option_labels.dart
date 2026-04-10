import "package:easy_localization/easy_localization.dart";

/// Maps stored API values (legacy Korean / mixed) to `options.*` keys from synced JSON.
String optionLabelGender(String stored) {
  const m = {
    "남성": "male",
    "여성": "female",
    "기타": "other",
    "무응답": "no_answer",
  };
  final k0 = m[stored] ?? stored;
  final k = "options.gender.$k0";
  final t = k.tr();
  if (t == k) return stored;
  return t;
}

String optionLabelAge(String stored) {
  const m = {
    "10대": "teens",
    "20대": "twenties",
    "30대": "thirties",
    "40대": "forties",
    "50대": "fifties",
    "60대이상": "sixties_plus",
  };
  final k0 = m[stored] ?? stored;
  final k = "options.age.$k0";
  final t = k.tr();
  if (t == k) return stored;
  return t;
}

String optionLabelDiet(String stored) {
  const m = {
    "일반": "normal",
    "채식": "vegetarian",
    "비건": "vegan",
    "할랄": "halal",
    "알레르기있음": "allergy",
  };
  final k0 = m[stored] ?? stored;
  final k = "options.diet.$k0";
  final t = k.tr();
  if (t == k) return stored;
  return t;
}

String optionLabelReligion(String stored) {
  const m = {
    "없음": "none",
    "기독교": "christian",
    "불교": "buddhist",
    "천주교": "catholic",
    "이슬람": "islam",
    "기타": "other",
  };
  final k0 = m[stored] ?? stored;
  final k = "options.religion.$k0";
  final t = k.tr();
  if (t == k) return stored;
  return t;
}

String optionLabelNationality(String stored) {
  const m = {
    "한국": "korea",
    "USA": "usa",
    "日本": "japan",
    "中国": "china",
    "United Kingdom": "united_kingdom",
    "France": "france",
    "Deutschland": "germany",
    "Canada": "canada",
    "Australia": "australia",
    "Việt Nam": "vietnam",
    "Thailand": "thailand",
    "Philippines": "philippines",
    "Indonesia": "indonesia",
    "Singapore": "singapore",
    "Malaysia": "malaysia",
    "India": "india",
    "Other": "other",
  };
  final k0 = m[stored] ?? stored;
  final k = "options.nationality.$k0";
  final t = k.tr();
  if (t == k) return stored;
  return t;
}
