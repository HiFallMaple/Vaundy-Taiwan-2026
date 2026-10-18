import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { markChantRanges } from "../src/chant/render.js";
import { SONG_LYRICS } from "../src/song-lyrics.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";
import { resolveSongChants, compact } from "../src/chant/resolve.js";
import { readings, furigana } from "../scripts/chant-data.mjs";

const { document } = parseHTML("<!doctype html><html><body></body></html>");
const parse = markup => {
  const el = document.createElement("div");
  el.innerHTML = markup;
  return el;
};
const visible = el => {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("rt,rp").forEach(n => n.remove());
  return clone.textContent;
};
test("ruby and supplementary Unicode characters retain exact text", () => {
  const source = "😀<ruby>今<rt>いま</rt></ruby> チェンジ";
  const result = parse(markChantRanges(source, [{ start: 1, end: 2 }], false, document));
  assert.equal(visible(result), "😀今 チェンジ");
  assert.equal(result.querySelector(".chant-range ruby rt").textContent, "いま");
});
test("ruby boundaries are rejected instead of expanding the chant", () => {
  assert.throws(() => markChantRanges("<ruby>未来<rt>みらい</rt></ruby>", [{ start: 0, end: 1 }], false, document), /splits ruby/);
});
test("all song versions render kana, romaji and translation without losing visible text", () => {
  for (const song of SONG_LYRICS){
    for (const version of ["jp", "kr"]){
      const resolved = resolveSongChants(song, CHANT_GUIDES[song.id], version, readings);
      song.lyrics.forEach((line, index) => {
        for (const [mode, source] of Object.entries({ jp: furigana[line.jp] || line.jp, romaji: readings[line.jp] || line.jp, zh: line.tr || "" })){
          const markup = source.replace(/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu, "");
          const full = resolved[index].chant === "full" && mode !== "zh";
          let result;
          try { result = parse(markChantRanges(markup, resolved[index].ranges[mode], full, document)); }
          catch (error){ throw new Error(`${song.id} ${version} @${line.time} ${mode}: ${error.message}`); }
          assert.equal(compact(visible(result)), compact(visible(parse(markup))), `${song.id} ${version} @${line.time} ${mode}`);
        }
      });
    }
  }
});
