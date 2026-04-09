import fs from "fs";
import path from "path";

const root = process.cwd();
const locDir = path.join(root, "src/lib/i18n/locales");
const langs = ["fr", "de", "vi", "id"];
const hasHangul = (s) => /[\uAC00-\uD7A3]/.test(String(s ?? ""));
const hasHan = (s) => /[\u4E00-\u9FFF]/.test(String(s ?? ""));

for (const lang of langs) {
  const p = path.join(locDir, `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.planner ??= {};
  j.planner.dest ??= {};
  j.planner.region ??= {};

  const badNames = [];
  for (const [slug, obj] of Object.entries(j.planner.dest)) {
    const name = obj?.name;
    if (!name || !String(name).trim()) {
      badNames.push(`${slug}:empty`);
      continue;
    }
    if (hasHangul(name) || hasHan(name)) {
      badNames.push(`${slug}:${name}`);
    }
    // Keep visual consistency in this screen labels.
    if (typeof name === "string") {
      obj.name = name.replace(/\s*\/\s*/g, " · ").replace(/\s*&\s*/g, " · ");
    }
  }

  const badRegions = [];
  for (const [id, obj] of Object.entries(j.planner.region)) {
    const label = obj?.label;
    const sub = obj?.subLabel;
    if (label && (hasHangul(label) || hasHan(label))) badRegions.push(`${id}.label:${label}`);
    if (sub && (hasHangul(sub) || hasHan(sub))) badRegions.push(`${id}.subLabel:${sub}`);
  }

  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
  console.log(`${lang}: badNames=${badNames.length}, badRegions=${badRegions.length}`);
  if (badNames.length) console.log(`  names -> ${badNames.slice(0, 12).join(", ")}`);
  if (badRegions.length) console.log(`  regions -> ${badRegions.slice(0, 12).join(", ")}`);
}
