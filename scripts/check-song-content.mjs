import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { SONG_CONTENT } from "../src/song-content.js";
import { SONGS } from "../src/song-metadata.js";

export function checkLyricLayout(source){
  let quote = null, escaped = false, comment = null, depth = 0, line = 1, rowLine = null, rows = 0, inLyrics = false;
  for (let i = 0; i < source.length; i++){
    const char = source[i], next = source[i + 1];
    if (char === "\n") line++;
    if (comment){
      if (comment === "line" && char === "\n") comment = null;
      else if (comment === "block" && char === "*" && next === "/"){ comment = null; i++; }
      continue;
    }
    if (quote){
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/"){ comment = "line"; i++; continue; }
    if (char === "/" && next === "*"){ comment = "block"; i++; continue; }
    if (["\"", "'", "`"].includes(char)){ quote = char; continue; }
    if (!inLyrics){
      const match = source.slice(i).match(/^lyrics\s*:\s*\[/);
      if (match){ inLyrics = true; depth = 0; i += match[0].length - 1; }
      continue;
    }
    if (char === "{" || char === "["){
      if (depth === 0){
        if (char !== "{") throw new Error(`Expected lyric object at line ${line}`);
        rowLine = line;
      }
      depth++;
    } else if (char === "}" || char === "]"){
      if (depth === 0){ inLyrics = false; continue; }
      depth--;
      if (depth === 0){
        if (rowLine !== line) throw new Error(`Lyric object must occupy one physical line: ${rowLine}-${line}`);
        rows++;
      }
    }
  }
  if (inLyrics || quote || comment === "block") throw new Error("Incomplete song content source");
  return rows;
}

export function checkSongContent(){
  const rows = checkLyricLayout(fs.readFileSync(new URL("../src/song-content.js", import.meta.url), "utf8"));
  if (rows !== SONG_CONTENT.reduce((count, song) => count + song.lyrics.length, 0)) throw new Error("Lyric layout count differs");
  const ids = SONG_CONTENT.map(song => song.id);
  if (new Set(ids).size !== ids.length || JSON.stringify([...ids].sort()) !== JSON.stringify(SONGS.map(song => song.id).sort())) throw new Error("Song content/metadata IDs differ");
  for (const song of SONG_CONTENT){
    if (Object.keys(song).some(key => !["id", "lyrics"].includes(key))) throw new Error(`Duplicated metadata or unknown content field: ${song.id}`);
  }
  console.log(`Validated ${ids.length} songs / ${rows} single-line lyric objects.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) checkSongContent();
