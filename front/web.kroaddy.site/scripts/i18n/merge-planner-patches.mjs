/**
 * Deep-merge scripts/i18n/planner-patches/{lang}.json into src/lib/i18n/locales/{lang}.json → planner
 * Run from repo root: node front/web.kroaddy.site/scripts/i18n/merge-planner-patches.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../src/lib/i18n/locales");
const patchDir = path.join(__dirname, "planner-patches");

function deepMerge(target, src) {
  if (!src || typeof src !== "object") return target;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const langs = ["ja", "zh", "de", "fr", "vi", "th", "id", "hi", "ko"];

for (const lang of langs) {
  const patchPath = path.join(patchDir, `${lang}.json`);
  const kcontentPath = path.join(patchDir, `${lang}-kcontent.json`);
  if (!fs.existsSync(patchPath) && !fs.existsSync(kcontentPath)) {
    console.warn("skip (no patch):", lang);
    continue;
  }
  const localePath = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(localePath, "utf8"));
  data.planner = data.planner || {};
  let patch = {};
  if (fs.existsSync(patchPath)) {
    patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  }
  if (fs.existsSync(kcontentPath)) {
    patch.kcontent = JSON.parse(fs.readFileSync(kcontentPath, "utf8"));
  }
  const { modes, kcontent, usercontent, standard, ...rest } = patch;
  if (modes) data.planner.modes = modes;
  if (kcontent) data.planner.kcontent = kcontent;
  if (usercontent) data.planner.usercontent = usercontent;
  if (standard) data.planner.standard = standard;
  deepMerge(data.planner, rest);
  fs.writeFileSync(localePath, JSON.stringify(data, null, 2) + "\n");
  console.log("merged planner patch:", lang);
}
