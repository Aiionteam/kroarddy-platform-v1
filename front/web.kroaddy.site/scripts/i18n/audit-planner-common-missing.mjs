import fs from "fs";
import path from "path";

const root = process.cwd();
const locDir = path.join(root, "src/lib/i18n/locales");
const langs = ["fr","de","vi","th","id"];
const en = JSON.parse(fs.readFileSync(path.join(locDir, "en.json"), "utf8"));
const locales = Object.fromEntries(langs.map((l)=>[l, JSON.parse(fs.readFileSync(path.join(locDir, `${l}.json`), "utf8"))]));

const keys = [
  "seoul","busan","daegu","incheon","gwangju","daejeon","ulsan","sejong",
  "jongno","myeongdong","yongsan","gangnam","jamsil","seongsu","hongdae","bukchon","nowon"
];

for (const l of langs) {
  const out = [];
  for (const k of keys) {
    const a = locales[l]?.planner?.dest?.[k]?.name ?? "";
    const b = en?.planner?.dest?.[k]?.name ?? "";
    if (!a || a === b) out.push(k);
  }
  console.log(`${l} metro-name missingOrSameEn: ${out.length} -> ${out.join(", ")}`);
}

for (const l of langs) {
  const entries = Object.entries(locales[l]?.planner?.dest ?? {});
  let sameName=0, total=0;
  for (const [k,v] of entries) {
    const a = v?.name ?? "";
    const b = en?.planner?.dest?.[k]?.name ?? "";
    if (!a) continue;
    total++;
    if (a === b) sameName++;
  }
  console.log(`${l} overall name same-as-en: ${sameName}/${total}`);
}
