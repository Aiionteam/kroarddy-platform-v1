import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refPath = path.join(__dirname, "planner-patches/_en-kcontent-ref.json");
const outDir = path.join(__dirname, "planner-patches");
const en = JSON.parse(fs.readFileSync(refPath, "utf8"));

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function buildKcontent(base, top, marketSrc, fallbackSrc) {
  const k = clone(base);
  for (const key of Object.keys(top)) k[key] = top[key];
  k.market = clone(marketSrc);
  k.fallback = clone(fallbackSrc);
  return k;
}

for (const lang of ["vi", "th", "id", "hi", "de", "fr"]) {
  const p = path.join(outDir, `${lang}-parts.json`);
  if (!fs.existsSync(p)) {
    console.warn("skip", lang);
    continue;
  }
  const { top, market, fallback } = JSON.parse(fs.readFileSync(p, "utf8"));
  const k = buildKcontent(en, top, market, fallback);
  fs.writeFileSync(path.join(outDir, `${lang}-kcontent.json`), JSON.stringify(k, null, 2) + "\n");
  console.log("wrote", lang + "-kcontent.json");
}
