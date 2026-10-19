import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { karaokeApi, wordLyrics, plain } from "./helpers/karaoke.mjs";

test("display timings stay inside the line after romaji reference mapping", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const assign = source.slice(source.indexOf("function assignKaraokeLineTiming("), source.indexOf("function decorateKaraokeLines("));
  const unit = () => ({ el: { dataset: {} } });
  const reference = { textContent: "test", _karaokeUnits: [unit()] };
  const romaji = { textContent: "test", _karaokeUnits: [unit()] };
  const line = { dataset: {}, querySelectorAll: () => [reference, romaji] };
  const context = {
    window: { KARAOKE_SOURCES: {
      allocateUnitTimings: () => [{ start: 1, end: 1.01 }],
      mapUnitsToReferenceTimings: () => ({ timings: [{ start: 0, end: 2 }], complete: true })
    } },
    kanaReferenceForLine: () => reference,
    karaokeUnitSourceText: () => "test",
    karaokeUnitReadingText: () => "test"
  };
  vm.createContext(context);
  vm.runInContext(assign, context);
  context.assignKaraokeLineTiming(line, { start: 1, end: 1.01, granularity: "line" });
  for (const target of [reference, romaji]) {
    assert.equal(target._karaokeUnits[0].start, 1);
    assert.equal(target._karaokeUnits[0].end, 1.01);
  }
});

test("supplementary characters do not shift source word indices", () => {
  const { api } = karaokeApi();
  const words = [{ text: "𠮷", start: 1, end: 2 }, { text: "a", start: 2, end: 3 }];
  assert.deepEqual(plain(api.mapUnitsToWords(["𠮷", "a"], words).timings), [{ start: 1, end: 2 }, { start: 2, end: 3 }]);
});

test("a missing phrase cannot jump to a later chorus or send later matches backwards", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[10, "anchor-one"], [20, "anchor-two"], [30, "original-refrain"], [40, "anchor-three"], [90, "edited-refrain"], [100, "anchor-four"]]);
  const local = [[10, "anchor-one"], [20, "anchor-two"], [30, "edited-refrain"], [40, "anchor-three"], [100, "anchor-four"]].map(([time, jp]) => ({ time, jp }));
  const aligned = api.alignToLocalLyrics(source, local);
  assert(aligned);
  assert.equal(aligned.lines[2], null);
  assert.equal(aligned.diagnostics[2].reason, "time-mismatch");
  assert.equal(aligned.lines[3].sourceStart, 40);
});

test("a constant intro offset is learned from unique anchors", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[10, "unique-first"], [20, "unique-second"], [30, "unique-third"]]);
  const local = [[34, "unique-first"], [44, "unique-second"], [54, "unique-third"]].map(([time, jp]) => ({ time, jp }));
  const aligned = api.alignToLocalLyrics(source, local);
  assert.equal(aligned.offset, 24);
  assert.equal(aligned.matchedLines, 3);
  assert.equal(aligned.lines[0].words[0].start, 34);
});

test("splitting a coarse source line uses local boundaries and proportional timing", () => {
  const { api } = karaokeApi();
  const source = api.parseLrclibLyricsFile("- text: 'どんな夜も輝いて消えない'\n  start_ms: 50340\n  end_ms: 58450\n- text: 'next-anchor'\n  start_ms: 58450\n  end_ms: 62000");
  const local = [{ time: 50.34, jp: "どんな夜も" }, { time: 52.785, jp: "輝いて消えない" }, { time: 58.45, jp: "next-anchor" }];
  const aligned = api.alignToLocalLyrics(source, local);
  assert(aligned);
  assert.equal(aligned.lines[0].end, 52.785);
  assert.equal(aligned.lines[1].end, 58.45);
  assert.equal(aligned.lines[0].granularity, "line");
  assert.equal(aligned.lines[0].words[0].text, local[0].jp);
  const units = api.allocateUnitTimings(Array.from(local[0].jp), aligned.lines[0].start, aligned.lines[0].end);
  assert.equal(units.at(-1).end, 52.785);
  assert(units.every(unit => unit.start >= 50.34 && unit.end <= 52.785));
});

test("word rhythm is compressed into the local line window rather than clipped", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[10, "abcdef", 1], [14, "next-anchor"], [25, "last-anchor"]]);
  const local = [{ time: 10, jp: "abcdef" }, { time: 14, jp: "next-anchor" }, { time: 25, jp: "last-anchor" }];
  const aligned = api.alignToLocalLyrics(source, local);
  assert.equal(aligned.lines[0].end, 14);
  assert.equal(aligned.lines[0].words.at(-1).end, 14);
  assert(Math.abs(aligned.lines[0].words[0].end - (10 + 4 / 6)) < 1e-8);
  assert(aligned.lines[0].words.every(word => word.start >= 10 && word.end <= 14 && word.end > word.start));
});

test("partial words degrade to proportional timing without borrowing the whole word", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[20, "abcdef"], [30, "next-anchor"]]);
  source.lines[0].words = [{ text: "abcdef", start: 20, end: 26 }];
  source.lines[0].end = 26;
  const aligned = api.alignToLocalLyrics(source, [{ time: 20, jp: "abc" }, { time: 23, jp: "def" }, { time: 30, jp: "next-anchor" }]);
  assert.equal(aligned.lines[0].granularity, "line");
  assert.equal(aligned.lines[0].end, 23);
  assert.equal(aligned.lines[1].granularity, "line");
});

test("repeat shorthand selects the entire group from its first occurrence", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[178, "lead-in"], [180.09, "今チェンジ今チェンジ今チェンジ今チェンジ", 0.2], [185, "next-anchor"]]);
  const aligned = api.alignToLocalLyrics(source, [{ time: 178, jp: "lead-in" }, { time: 180.09, jp: "今 チェンジ x4" }, { time: 185, jp: "next-anchor" }]);
  assert(aligned);
  assert.equal(aligned.lines[1].sourceStart, 180.09);
  assert.equal(aligned.lines[1].granularity, "line");
  assert.equal(aligned.lines[1].end, 184.09);
});

test("action-only rows do not truncate singing and tiny allocations stay inside the window", () => {
  const { api } = karaokeApi();
  const source = wordLyrics([[10, "abcdef", 1], [20, "second-anchor"], [30, "third-anchor"]]);
  const aligned = api.alignToLocalLyrics(source, [{ time: 10, jp: "abcdef" }, { time: 11, jp: "[clap]" }, { time: 20, jp: "second-anchor" }, { time: 30, jp: "third-anchor" }]);
  assert.equal(aligned.lines[0].end, 16);
  const small = api.allocateUnitTimings(["a", "b", "c", "d"], 0, 0.04);
  assert(small.every(t => t.end <= 0.04));
});

test("display unit mapping never reuses a word from earlier in the sentence", () => {
  const { api } = karaokeApi();
  const result = api.mapUnitsToWords(["b", "a"], [{ text: "ab", start: 1, end: 2 }]);
  assert.deepEqual(plain(result.timings), [{ start: 1, end: 2 }, null]);
});
