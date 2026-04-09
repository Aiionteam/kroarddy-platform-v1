import fs from "fs";
import path from "path";

const root = process.cwd();
const plannerData = fs.readFileSync(path.join(root, "app/planner/planner-data.ts"), "utf8");
const re = /\{\s*name:\s*"([^"]+)"\s*,\s*slug:\s*"([^"]+)"/g;
const slugs = [];
let m;
while ((m = re.exec(plannerData))) slugs.push(m[2]);
const uniq = Array.from(new Set(slugs));
const langs = ["fr", "de", "vi", "id", "th", "hi", "ja", "zh"];
const hasHangul = (s) => /[\uAC00-\uD7A3]/.test(String(s ?? ""));
for (const lang of langs) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "src/lib/i18n/locales", `${lang}.json`), "utf8"));
  const d = j?.planner?.dest ?? {};
  const missing = [];
  const ko = [];
  for (const slug of uniq) {
    const name = d?.[slug]?.name;
    if (!name) missing.push(slug);
    else if (hasHangul(name)) ko.push(slug);
  }
  console.log(`${lang}: missing=${missing.length}, hangul=${ko.length}`);
  if (missing.length) console.log(`  missing sample: ${missing.slice(0, 10).join(", ")}`);
  if (ko.length) console.log(`  hangul sample: ${ko.slice(0, 10).join(", ")}`);
}
