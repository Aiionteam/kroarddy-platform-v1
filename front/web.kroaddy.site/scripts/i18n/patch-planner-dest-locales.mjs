import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const plannerDataPath = path.join(root, "app/planner/planner-data.ts");
const localesDir = path.join(root, "src/lib/i18n/locales");

const plannerData = fs.readFileSync(plannerDataPath, "utf8");
const re = /\{\s*name:\s*"([^"]+)"\s*,\s*slug:\s*"([^"]+)"/g;
const rows = [];
let m;
while ((m = re.exec(plannerData))) rows.push({ ko: m[1], slug: m[2] });
const slugs = Array.from(new Set(rows.map((r) => r.slug)));

const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), "utf8"));
const writeLocale = (lang, data) => fs.writeFileSync(path.join(localesDir, `${lang}.json`), `${JSON.stringify(data, null, 2)}\n`, "utf8");
const hasHangul = (s) => /[\uAC00-\uD7A3]/.test(String(s ?? ""));
const humanizeSlug = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const ensurePlannerDest = (j) => {
  if (!j.planner) j.planner = {};
  if (!j.planner.dest) j.planner.dest = {};
};

const en = readLocale("en");
const enName = (slug) => en?.planner?.dest?.[slug]?.name || humanizeSlug(slug);

const latinLocales = ["fr", "de", "vi", "th", "id", "hi"];
for (const lang of latinLocales) {
  const j = readLocale(lang);
  ensurePlannerDest(j);
  for (const slug of slugs) {
    const cur = j.planner.dest?.[slug]?.name;
    if (!cur || hasHangul(cur)) {
      if (!j.planner.dest[slug]) j.planner.dest[slug] = {};
      j.planner.dest[slug].name = enName(slug);
    }
  }
  writeLocale(lang, j);
  console.log(`patched ${lang}`);
}

const jaMap = {
  yeongju: "栄州",
  mungyeong: "聞慶",
  yeongdeok: "盈徳",
  uljin: "蔚珍",
  dokdo: "独島・鬱陵島",
  gumi: "亀尾",
  gimcheon: "金泉",
  yeongcheon: "永川",
  sangju: "尚州",
  gyeongsan: "慶山",
  namhae: "南海",
  "goseong-gn": "固城",
  hapcheon: "陜川",
  miryang: "密陽",
  hamyang: "咸陽",
  sancheong: "山清",
  hadong: "河東",
  geochang: "居昌",
  gimhae: "金海",
  yangsan: "梁山",
  changnyeong: "昌寧",
  uiryeong: "宜寧",
};

const zhMap = {
  yeongju: "荣州",
  mungyeong: "闻庆",
  yeongdeok: "盈德",
  uljin: "蔚珍",
  dokdo: "独岛·郁陵岛",
  gumi: "龟尾",
  gimcheon: "金泉",
  yeongcheon: "永川",
  sangju: "尚州",
  gyeongsan: "庆山",
  namhae: "南海",
  "goseong-gn": "固城",
  hapcheon: "陕川",
  miryang: "密阳",
  hamyang: "咸阳",
  sancheong: "山清",
  hadong: "河东",
  geochang: "居昌",
  gimhae: "金海",
  yangsan: "梁山",
  changnyeong: "昌宁",
  uiryeong: "宜宁",
};

for (const [lang, overrides] of Object.entries({ ja: jaMap, zh: zhMap })) {
  const j = readLocale(lang);
  ensurePlannerDest(j);
  for (const slug of slugs) {
    const cur = j.planner.dest?.[slug]?.name;
    if (!cur || hasHangul(cur)) {
      if (!j.planner.dest[slug]) j.planner.dest[slug] = {};
      j.planner.dest[slug].name = overrides[slug] || enName(slug);
    }
  }
  for (const [slug, name] of Object.entries(overrides)) {
    if (!j.planner.dest[slug]) j.planner.dest[slug] = {};
    j.planner.dest[slug].name = name;
  }
  writeLocale(lang, j);
  console.log(`patched ${lang}`);
}
