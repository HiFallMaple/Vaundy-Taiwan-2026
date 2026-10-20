import { getReading } from "../src/readings/lookup.js";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { SONG_CONTENT } from "../src/song-content.js";
import { CHANT_GUIDES, CHANT_SOURCES } from "../src/chant/version-data.js";
import { resolveSongChants } from "../src/chant/resolve.js";
import { validateChantEntry } from "../src/chant/validate.js";
import { markChantRanges, insertActionIcons } from "../src/chant/render.js";
import { chantSummary } from "../src/chant/summary.js";
import { INLINE_ICONS } from "../src/ui/icons.js";
import { readings, furigana } from "./chant-data.mjs";

const { document } = parseHTML("<html></html>");
const result = {};
if (Object.keys(CHANT_GUIDES).length !== SONG_CONTENT.length) throw new Error("Song guide count differs");
for (const song of SONG_CONTENT){
  try {
    const entry = CHANT_GUIDES[song.id];
    validateChantEntry(song, entry, CHANT_SOURCES, readings);
    result[song.id] = {};
    for (const version of ["jp", "kr"]){
      const lines = resolveSongChants(song, entry, version, readings);
      lines.forEach((line, index) => {
        const lyric = song.lyrics[index];
        const markup = getReading(furigana, lyric.jp) || lyric.jp;
        for (const [mode, source] of Object.entries({ jp: markup, romaji: getReading(readings, lyric.jp) || lyric.jp })){
          const marked = markChantRanges(source, line.ranges[mode], line.chant === "full", document);
          try { insertActionIcons(marked, line.actionPlacements, mode, INLINE_ICONS, document); }
          catch (error){ throw new Error(`${version} @${lyric.time} ${mode}: ${error.message}`); }
        }
      });
      result[song.id][version] = chantSummary(lines);
    }
  } catch (error){ throw new Error(`${song.id}: ${error.message}`); }
}
const output = `export const SONG_MARKS = {\n${Object.entries(result).map(([id, value]) => `  ${JSON.stringify(id)}: ${JSON.stringify(value)}`).join(",\n")}\n};\n`;
const path = new URL("../src/song-mark-metadata.js", import.meta.url);
if (process.argv.includes("--write")) fs.writeFileSync(path, output);
else if (fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== output) throw new Error("Stale chant metadata; run npm run generate:chant-metadata");
console.log(`Validated ${SONG_CONTENT.length} songs / 72 versions, inline cues, readings, action/ruby boundaries and metadata.`);
