/**
 * Merges customer.subscription, customer.emergency, and customer.notices (overlay)
 * from patches/customer-extra/{locale}.json into locale files.
 * Run: node scripts/i18n/apply-customer-extra.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../src/lib/i18n/locales");
const patchDir = path.join(__dirname, "patches/customer-extra");
const LOCALES = ["ja", "zh", "de", "fr", "vi", "th", "id", "hi"];

for (const loc of LOCALES) {
  const patchPath = path.join(patchDir, `${loc}.json`);
  if (!fs.existsSync(patchPath)) {
    console.warn("skip (no patch):", loc);
    continue;
  }
  const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  const mainPath = path.join(localesDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  if (patch.subscription) data.customer.subscription = patch.subscription;
  if (patch.emergency) data.customer.emergency = patch.emergency;
  if (patch.notices) Object.assign(data.customer.notices, patch.notices);
  fs.writeFileSync(mainPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("updated", loc);
}
