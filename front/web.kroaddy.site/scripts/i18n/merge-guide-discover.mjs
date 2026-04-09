/**
 * Deep-merge scripts/i18n/guide-discover-patch.json into each locale's root `guide` object.
 * Run from repo: node front/web.kroaddy.site/scripts/i18n/merge-guide-discover.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../src/lib/i18n/locales");
const patchPath = path.join(__dirname, "guide-discover-patch.json");
const patchPart2Path = path.join(__dirname, "guide-discover-patch.part2.json");

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(a, b) {
  if (!isPlainObject(a)) return { ...b };
  const out = { ...a };
  for (const k of Object.keys(b)) {
    const bv = b[k];
    const av = out[k];
    if (isPlainObject(bv) && isPlainObject(av)) {
      out[k] = deepMerge(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}

const patch = {
  ...JSON.parse(fs.readFileSync(patchPath, "utf8")),
  ...(fs.existsSync(patchPart2Path)
    ? JSON.parse(fs.readFileSync(patchPart2Path, "utf8"))
    : {}),
};
const langs = ["en", "ko", "ja", "zh", "de", "fr", "vi", "th", "id", "hi"];

for (const lang of langs) {
  const file = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const slice = patch[lang];
  if (!slice) {
    console.error(`Missing patch for ${lang}`);
    process.exit(1);
  }
  data.guide = deepMerge(data.guide || {}, slice);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`merged guide discover → ${lang}.json`);
}
