/// 웹 `src/lib/i18n/config.ts` 의 `NATIONALITY_TO_LANG` 와 동일한 키·값입니다.
const Map<String, String> nationalityToLanguageCode = {
  "한국": "ko",
  "Korea": "ko",
  "USA": "en",
  "United States": "en",
  "미국": "en",
  "United Kingdom": "en",
  "UK": "en",
  "영국": "en",
  "Australia": "en",
  "호주": "en",
  "Canada": "en",
  "캐나다": "en",
  "Singapore": "en",
  "싱가포르": "en",
  "India": "hi",
  "인도": "hi",
  "Malaysia": "en",
  "말레이시아": "en",
  "Philippines": "en",
  "필리핀": "en",
  "Indonesia": "id",
  "인도네시아": "id",
  "Thailand": "th",
  "태국": "th",
  "Other": "en",
  "日本": "ja",
  "일본": "ja",
  "Japan": "ja",
  "中国": "zh",
  "중국": "zh",
  "China": "zh",
  "Deutschland": "de",
  "독일": "de",
  "France": "fr",
  "프랑스": "fr",
  "Việt Nam": "vi",
  "베트남": "vi",
};

/// 빈 문자열이면 웹과 같이 `en` 입니다.
String languageCodeForNationality(String nationality) {
  final key = nationality.trim();
  if (key.isEmpty) return "en";
  return nationalityToLanguageCode[key] ?? "en";
}
