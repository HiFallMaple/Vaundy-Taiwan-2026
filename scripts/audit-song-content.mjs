import fs from "node:fs";
import vm from "node:vm";
import { SONG_CONTENT } from "../src/song-content.js";
import { SONGS } from "../src/song-metadata.js";
import { FURIGANA_CORRECTIONS, ROMAJI_CORRECTIONS } from "../src/furigana-corrections.js";

const strip = value => value.replace(/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu, "");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../furigana.js", import.meta.url), "utf8"), context);
const report = { metadataDifferences: [], readingConflicts: [], inlineMarkers: [], actionOnly: 0, repeatedMarkers: 0 };
for (const [mode, table] of Object.entries({ furigana: { ...context.window.JP_FURIGANA, ...FURIGANA_CORRECTIONS }, romaji: { ...context.window.JP_ROMAJI, ...ROMAJI_CORRECTIONS } })){
  const normalized = new Map();
  for (const [key, value] of Object.entries(table)){
    const text = strip(key), reading = strip(value);
    if (normalized.has(text) && normalized.get(text) !== reading) report.readingConflicts.push({ mode, text });
    normalized.set(text, reading);
  }
}
for (const song of SONG_CONTENT){
  const metadata = SONGS.find(item => item.id === song.id);
  for (const key of Object.keys(song).filter(key => key !== "lyrics")){
    if (song[key] !== metadata?.[key]) report.metadataDifferences.push({ song: song.id, key, content: song[key], metadata: metadata?.[key] });
  }
  for (const line of song.lyrics){
    const matches = [...line.jp.matchAll(/[\[(](wave|clap|mic|chant|jump|spin|turn)[\])]/giu)];
    if (matches.length && !strip(line.jp).trim()) report.actionOnly++;
    if (matches.length > 1) report.repeatedMarkers++;
    for (const match of matches){
      if (strip(line.jp.slice(0, match.index)).trim()) report.inlineMarkers.push({ song: song.id, time: line.time, marker: match[0], before: strip(line.jp.slice(0, match.index)), after: strip(line.jp.slice(match.index + match[0].length)) });
    }
  }
}
console.log(JSON.stringify(report, null, 2));
if (report.metadataDifferences.length || report.readingConflicts.length) process.exitCode = 1;
