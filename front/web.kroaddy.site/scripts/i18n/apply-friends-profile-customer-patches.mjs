/**
 * Applies full replacements for settings, chat.friends, chat.whisper,
 * and selected customer.* sections (non-English locales).
 * Run: node scripts/i18n/apply-friends-profile-customer-patches.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { patches } from "./patches/friends-profile-customer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../src/lib/i18n/locales");

for (const loc of Object.keys(patches)) {
  const filePath = path.join(localesDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const p = patches[loc];
  if (p.sidebar) Object.assign(data.sidebar, p.sidebar);
  if (p.settings) data.settings = p.settings;
  if (p.chat?.friends) data.chat.friends = p.chat.friends;
  if (p.chat?.whisper) data.chat.whisper = p.chat.whisper;
  if (p.customer) {
    for (const [k, v] of Object.entries(p.customer)) {
      data.customer[k] = v;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("patched", loc);
}
