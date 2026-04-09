import { bundle as ja } from "./ja.bundle.mjs";
import { bundle as zh } from "./zh.bundle.mjs";
import { bundle as de } from "./de.bundle.mjs";
import { bundle as fr } from "./fr.bundle.mjs";
import { bundle as vi } from "./vi.bundle.mjs";
import { bundle as th } from "./th.bundle.mjs";
import { bundle as id } from "./id.bundle.mjs";
import { bundle as hi } from "./hi.bundle.mjs";

function p(b) {
  return {
    sidebar: b.sidebar,
    settings: b.settings,
    chat: b.chat,
    customer: b.customer,
  };
}

export const patches = {
  ja: p(ja),
  zh: p(zh),
  de: p(de),
  fr: p(fr),
  vi: p(vi),
  th: p(th),
  id: p(id),
  hi: p(hi),
};
