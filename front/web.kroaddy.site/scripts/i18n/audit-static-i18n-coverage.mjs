import fs from "fs";
import path from "path";

const root = process.cwd();
const srcDirs = [path.join(root, "app"), path.join(root, "src")];
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);

const files = [];
const walk = (d) => {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) {
      if (n.name === "node_modules" || n.name === ".next") continue;
      walk(p);
    } else if (exts.has(path.extname(n.name))) files.push(p);
  }
};
for (const d of srcDirs) if (fs.existsSync(d)) walk(d);

const keySet = new Set();
const re = /\bt\(\s*["'`]([^"'`$]+)["'`]/g;
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(s))) {
    const k = m[1];
    if (!k.includes("${") && !k.includes("`")) keySet.add(k);
  }
}

const get = (obj, key) => key.split(".").reduce((a, c) => (a && Object.prototype.hasOwnProperty.call(a, c) ? a[c] : undefined), obj);
const langs = ["en","ja","zh","fr","de","vi","th","id","hi"];
const locales = Object.fromEntries(langs.map((l)=>[l, JSON.parse(fs.readFileSync(path.join(root, "src/lib/i18n/locales", `${l}.json`), "utf8"))]));

const keys = Array.from(keySet).sort();
console.log(`static_t_keys=${keys.length}`);
for (const lang of langs) {
  const missing = [];
  for (const k of keys) {
    const v = get(locales[lang], k);
    if (v === undefined) missing.push(k);
  }
  console.log(`${lang}: missing ${missing.length}`);
  if (lang !== "en" && missing.length) console.log(`  sample: ${missing.slice(0,12).join(", ")}`);
}
