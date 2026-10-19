import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { SONG_LYRICS } from "../src/song-lyrics.js";
import { SONGS } from "../src/song-metadata.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";
import { readings, furigana } from "../scripts/chant-data.mjs";
import { resolveSongChants } from "../src/chant/resolve.js";
import { chantSummary, buildChantBlocks } from "../src/chant/summary.js";

const strip = value => String(value ?? "").replace(/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu, "");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const baseline = JSON.parse(fs.readFileSync(new URL("./fixtures/song-content-baseline.json", import.meta.url)));

for (const song of SONG_LYRICS){
  test(`${song.id} preserves content, readings, guides and practice blocks`, () => {
    const { lyrics, ...metadata } = song;
    const content = lyrics.map(line => {
      const { jp, ...rest } = line;
      return { ...rest, jp: strip(jp), furigana: strip(furigana[jp] || jp), romaji: strip(readings[jp] || jp) };
    });
    const guides = Object.fromEntries(["jp", "kr"].map(version => {
      const lines = resolveSongChants(song, CHANT_GUIDES[song.id], version, readings);
      const { actions, versions } = CHANT_GUIDES[song.id];
      const { cues, actionOverrides, ...guide } = versions[version];
      return [version, { guide, summary: chantSummary(lines), blocks: buildChantBlocks(lines, lyrics.map(line => line.time)) }];
    }));
    assert.equal(hash({ metadata: { ...SONGS.find(item => item.id === song.id), ...metadata }, content, guides }), baseline[song.id]);
  });
}
