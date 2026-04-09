/**
 * Deep-merges patches/home-extra/{locale}.json into locale files (common + home).
 * Run: node scripts/i18n/apply-home-extra.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../src/lib/i18n/locales");
const patchDir = path.join(__dirname, "patches/home-extra");
const LOCALES = ["ko", "ja", "zh", "de", "fr", "vi", "th", "id", "hi"];

function mergeDeep(a, b) {
  if (b === null || b === undefined || typeof b !== "object" || Array.isArray(b)) return a;
  const base = a && typeof a === "object" && !Array.isArray(a) ? a : {};
  const out = { ...base };
  for (const k of Object.keys(b)) {
    const bv = b[k];
    const av = out[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && av && typeof av === "object" && !Array.isArray(av)) {
      out[k] = mergeDeep(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}

for (const loc of LOCALES) {
  const patchPath = path.join(patchDir, `${loc}.json`);
  if (!fs.existsSync(patchPath)) {
    console.warn("skip (no patch):", loc);
    continue;
  }
  const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  const mainPath = path.join(localesDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  if (patch.common) data.common = mergeDeep(data.common, patch.common);
  if (patch.home) data.home = mergeDeep(data.home, patch.home);
  fs.writeFileSync(mainPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("updated", loc);
}
