import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const localesDir = path.join(root, "src/lib/i18n/locales");

const slugs = [
  "asan","cheonan","nonsan","seosan","dangjin","iksan","gochang","jeongeup","gimje",
  "wando","gangjin","yeonggwang","haenam","goheung","yeongam","gwangyang","boseong","naju",
  "yeongju","mungyeong","yeongdeok","uljin","dokdo","gumi","gimcheon","yeongcheon","sangju","gyeongsan",
  "namhae","goseong-gn","hapcheon","miryang","hamyang","sancheong","hadong","geochang","gimhae","yangsan","changnyeong","uiryeong"
];

const hiMap = {
  asan: "आसन", cheonan: "चियोनान", nonsan: "नोनसान", seosan: "सिओसान", dangjin: "डांगजिन", iksan: "इकसान", gochang: "गोचांग", jeongeup: "जोंग्युप", gimje: "गिम्जे",
  wando: "वांडो", gangjin: "गांगजिन", yeonggwang: "योंगग्वांग", haenam: "हैनाम", goheung: "गोह्यूंग", yeongam: "योंगाम", gwangyang: "ग्वांगयांग", boseong: "बोसोंग", naju: "नाजू",
  yeongju: "योंगजू", mungyeong: "मुंग्योंग", yeongdeok: "योंगदोक", uljin: "उलजिन", dokdo: "दोक्दो / उल्लुंगदो", gumi: "गुमी", gimcheon: "गिमचोन", yeongcheon: "योंगचोन", sangju: "सांगजू", gyeongsan: "ग्योंगसान",
  namhae: "नमहे", "goseong-gn": "गोसोंग", hapcheon: "हापचॉन", miryang: "मिरयांग", hamyang: "हमयांग", sancheong: "सांचोंग", hadong: "हाडोंग", geochang: "ग्योचांग", gimhae: "गिम्हे", yangsan: "यांगसान", changnyeong: "चांगन्योंग", uiryeong: "उइर्योंग"
};

const thMap = {
  asan: "อาซัน", cheonan: "ชอนอัน", nonsan: "นนซาน", seosan: "ซอซาน", dangjin: "ดังจิน", iksan: "อิกซาน", gochang: "โกชาง", jeongeup: "จองอึบ", gimje: "กิมเจ",
  wando: "วานโด", gangjin: "คังจิน", yeonggwang: "ยองกวัง", haenam: "แฮนัม", goheung: "โกฮึง", yeongam: "ยองอัม", gwangyang: "กวังยาง", boseong: "โบซอง", naju: "นาจู",
  yeongju: "ยองจู", mungyeong: "มุนกย็อง", yeongdeok: "ยองด็อก", uljin: "อุลจิน", dokdo: "ดกโด / อุลลึงโด", gumi: "กูมี", gimcheon: "กิมชอน", yeongcheon: "ยองชอน", sangju: "ซังจู", gyeongsan: "คยองซาน",
  namhae: "นัมแฮ", "goseong-gn": "โกซอง", hapcheon: "ฮับชอน", miryang: "มิลยัง", hamyang: "ฮัมยัง", sancheong: "ซันช็อง", hadong: "ฮาดง", geochang: "กอชาง", gimhae: "กิมแฮ", yangsan: "ยางซาน", changnyeong: "ชังนย็อง", uiryeong: "อึยรยอง"
};

const langs = ["fr","de","vi","th","id","hi"];
for (const lang of langs) {
  const p = path.join(localesDir, `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.planner ??= {};
  j.planner.dest ??= {};
  for (const slug of slugs) {
    j.planner.dest[slug] ??= {};
    if (lang === "hi") j.planner.dest[slug].name = hiMap[slug] ?? j.planner.dest[slug].name ?? slug;
    else if (lang === "th") j.planner.dest[slug].name = thMap[slug] ?? j.planner.dest[slug].name ?? slug;
    else j.planner.dest[slug].name = j.planner.dest[slug].name ?? slug;
  }
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
  console.log(`patched ${lang}`);
}
