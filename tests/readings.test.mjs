import test from "node:test";
import assert from "node:assert/strict";
import { buildReadingLookup, getReading, stripActionMarkers } from "../src/readings/lookup.js";

test("corrections apply before marker removal and preserve spaces", () => {
  const lookup = buildReadingLookup({ romaji: { "[wave]愛で": "[wave]bad", " 愛で ": " ai de " } }, { romaji: { "[wave]愛で": "[wave]ai de" } });
  assert.equal(getReading(lookup.romaji, "[clap]愛で"), "ai de");
  assert.equal(getReading(lookup.romaji, " 愛で "), " ai de ");
  assert.equal(getReading(lookup.romaji, "missing"), undefined);
});

test("identical readings merge but conflicting values never overwrite", () => {
  assert.equal(buildReadingLookup({ romaji: { "[wave]愛": "ai", "[clap]愛": "ai" } }).romaji["愛"], "ai");
  assert.throws(() => buildReadingLookup({ romaji: { "[wave]愛": "ai", "[clap]愛": "love" } }), /Conflicting.*wave.*clap/);
});

test("ruby is preserved, empty action keys omitted and legacy syntax supported", () => {
  const lookup = buildReadingLookup({ furigana: { "(WAVE)愛": "(WAVE)<ruby>愛<rt>あい</rt></ruby>", "[clap]": "[clap]" } });
  assert.equal(lookup.furigana["愛"], "<ruby>愛<rt>あい</rt></ruby>");
  assert.equal(Object.hasOwn(lookup.furigana, ""), false);
  assert.equal(stripActionMarkers(" a[spin] (jump)b "), " a b ");
});
