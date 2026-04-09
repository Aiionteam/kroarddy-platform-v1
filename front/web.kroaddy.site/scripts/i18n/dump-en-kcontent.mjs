import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/lib/i18n/locales/en.json"), "utf8"));
fs.writeFileSync(path.join(__dirname, "planner-patches/_en-kcontent-ref.json"), JSON.stringify(en.planner.kcontent, null, 2) + "\n");
console.log("wrote _en-kcontent-ref.json");
