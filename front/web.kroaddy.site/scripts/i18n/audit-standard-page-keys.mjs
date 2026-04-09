import fs from "fs";
import path from "path";

const langs = ["en","ja","zh","fr","de","vi","th","id","hi"];
const loc = Object.fromEntries(
  langs.map((l) => [l, JSON.parse(fs.readFileSync(path.join("src/lib/i18n/locales", `${l}.json`), "utf8"))]),
);
const get = (o, k) => k.split(".").reduce((a, c) => (a && Object.prototype.hasOwnProperty.call(a, c) ? a[c] : undefined), o);

const app = fs.readFileSync("app/planner/standard/page.tsx", "utf8");
const re = /\bt\(\s*["'`]([^"'`$]+)["'`]/g;
const keys = [];
let m;
while ((m = re.exec(app))) keys.push(m[1]);
const uniq = Array.from(new Set(keys)).filter((k) => k.startsWith("planner."));
console.log(`planner keys in standard page: ${uniq.length}`);
for (const l of langs) {
  const missing = uniq.filter((k) => get(loc[l], k) === undefined);
  console.log(`${l}: missing=${missing.length}${missing.length ? ` -> ${missing.join(", ")}` : ""}`);
}
