import fs from "node:fs";
import vm from "node:vm";
import { FURIGANA_CORRECTIONS, ROMAJI_CORRECTIONS } from "../src/furigana-corrections.js";

import { buildReadingLookup } from "../src/readings/lookup.js";

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../furigana.js", import.meta.url), "utf8"), context);
const lookup = buildReadingLookup(
  { furigana: context.window.JP_FURIGANA, romaji: context.window.JP_ROMAJI },
  { furigana: FURIGANA_CORRECTIONS, romaji: ROMAJI_CORRECTIONS }
);
export const readings = lookup.romaji;
export const furigana = lookup.furigana;
