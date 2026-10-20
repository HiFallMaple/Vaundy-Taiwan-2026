import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SONG_LYRICS } from "../src/song-lyrics.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";
import { resolveSongChants } from "../src/chant/resolve.js";
import { readings } from "../scripts/chant-data.mjs";

const baseline = JSON.parse(fs.readFileSync(new URL("./fixtures/chant-baseline.json", import.meta.url)));
for (const song of SONG_LYRICS){
  for (const version of ["jp", "kr"]){
    test(`${song.id} ${version} retains migrated chant ranges and actions`, () => {
      const result = resolveSongChants(song, CHANT_GUIDES[song.id], version, readings)
        .filter(l => l.chant !== "none" || l.actions.length)
        .map(({ time, chant, ranges, actions }) => [time, chant, ranges.jp, ranges.romaji, ranges.zh, actions]);
      assert.deepEqual(result, baseline[song.id][version]);
    });
  }
}
