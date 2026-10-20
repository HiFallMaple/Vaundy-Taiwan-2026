import fs from "node:fs";
import vm from "node:vm";
import { SONG_LYRICS as SONGS } from "../src/song-lyrics.js";
import { ROMAJI_CORRECTIONS } from "../src/furigana-corrections.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";

const furiganaSource = fs.readFileSync(new URL("../furigana.js", import.meta.url), "utf8");
const generated = { window: {} };
vm.runInNewContext(furiganaSource, generated, { filename: "furigana.js" });

const romajiByLine = {
  ...(generated.window.JP_ROMAJI || {}),
  ...ROMAJI_CORRECTIONS,
};
const japaneseCharacters = /[ぁ-ゖ゠-ヿ一-鿿]/u;

const textOf = value => Array.isArray(value)
  ? value.map(part => typeof part === "string" ? part : part?.text || "").join("")
  : String(value ?? "");

const missing = [];
const missingChantSegments = [];
const leaking = [];
const seenMissing = new Set();

for (const song of SONGS) {
  for (const [index, line] of (song.lyrics || []).entries()) {
    const source = textOf(line.jp);
    if (!source || !japaneseCharacters.test(source)) continue;

    const romaji = romajiByLine[source];
    if (typeof romaji !== "string") {
      if (!seenMissing.has(source)) {
        seenMissing.add(source);
        missing.push({ song: song.id, index, time: line.time, source });
      }
      continue;
    }

    if (japaneseCharacters.test(romaji)) {
      leaking.push({ song: song.id, index, time: line.time, source, romaji });
    }


  }
}

for (const [song, entry] of Object.entries(CHANT_GUIDES)) {
  for (const [version, guide] of Object.entries(entry.versions)) {
    for (const cue of guide.cues || []) {
      for (const part of cue.chant.parts || []) {
        if (typeof part.romaji?.text !== "string" || japaneseCharacters.test(part.romaji.text)) {
          missingChantSegments.push({ song, version, time: cue.time, source: part.jp?.text });
        }
      }
    }
  }
}

const lyricCount = SONGS.reduce((count, song) => count + (song.lyrics || []).length, 0);
console.log(`Checked ${SONGS.length} songs / ${lyricCount} lyric lines.`);

if (missing.length || missingChantSegments.length || leaking.length) {
  if (missing.length) {
    console.error(`Missing romaji mappings (${missing.length} unique lines):`);
    missing.forEach(item => console.error(`- ${item.song}#${item.index} @ ${item.time}: ${item.source}`));
  }
  if (missingChantSegments.length) {
    console.error(`Missing romaji mappings (${missingChantSegments.length}) for Japanese chant segments:`);
    missingChantSegments.forEach(item => console.error(`- ${item.song}#${item.index} @ ${item.time}: ${item.source}`));
  }
  if (leaking.length) {
    console.error(`Romaji mappings containing Japanese (${leaking.length} lines):`);
    leaking.forEach(item => console.error(`- ${item.kind || "lyric"} ${item.song}#${item.index} @ ${item.time}: ${item.romaji}`));
  }
  process.exitCode = 1;
} else {
  console.log("All Japanese lyric lines and chant segments have romaji, with no Japanese characters in those readings.");
}
