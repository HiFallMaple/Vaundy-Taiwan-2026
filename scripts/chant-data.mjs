import fs from "node:fs";
import vm from "node:vm";
import { FURIGANA_CORRECTIONS, ROMAJI_CORRECTIONS } from "../src/furigana-corrections.js";

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../furigana.js", import.meta.url), "utf8"), context);
export const readings = { ...context.window.JP_ROMAJI, ...ROMAJI_CORRECTIONS };
export const furigana = { ...context.window.JP_FURIGANA, ...FURIGANA_CORRECTIONS };
