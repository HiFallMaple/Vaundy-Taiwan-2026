import { getReading } from "../src/readings/lookup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { markChantRanges } from "../src/chant/render.js";
import { SONG_CONTENT } from "../src/song-content.js";
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
test("action-only markup is removed without reintroducing an icon", () => {
  assert.equal(markChantRanges('<span class="ico">拍手</span>', [], false, document), "");
});
test("all song versions render kana, romaji and translation without losing visible text", () => {
  for (const song of SONG_CONTENT){
    for (const version of ["jp", "kr"]){
      const resolved = resolveSongChants(song, CHANT_GUIDES[song.id], version, readings);
      song.lyrics.forEach((line, index) => {
        for (const [mode, source] of Object.entries({ jp: getReading(furigana, line.jp) || line.jp, romaji: getReading(readings, line.jp) || line.jp, zh: line.tr || "" })){
          const markup = source.replace(/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu, "");
          const full = resolved[index].chant === "full" && mode !== "zh";
          let result;
          try { result = parse(markChantRanges(markup, resolved[index].ranges[mode], full, document)); }
          catch (error){ throw new Error(`${song.id} ${version} @${line.time} ${mode}: ${error.message}`); }
          assert.equal(compact(visible(result)), compact(visible(parse(markup))), `${song.id} ${version} @${line.time} ${mode}`);
          const expected = full ? compact(visible(parse(markup))) : resolved[index].ranges[mode]
            .slice().sort((a, b) => a.start - b.start)
            .map(r => Array.from(compact(visible(parse(markup)))).slice(r.start, r.end).join("")).join("");
          const marked = [...result.querySelectorAll(".chant-range")].map(el => compact(visible(el))).join("");
          assert.equal(marked, expected, `Chant text: ${song.id} ${version} @${line.time} ${mode}`);
        }
      });
    }
  }
});
