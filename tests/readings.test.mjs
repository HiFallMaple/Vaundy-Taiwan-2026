import test from "node:test";
import assert from "node:assert/strict";
import { buildReadingLookup, getReading } from "../src/readings/lookup.js";
import { readings, furigana } from "../scripts/chant-data.mjs";

test("manual readings override exact keys while preserving whitespace and ruby", () => {
  const ruby = "<ruby>愛<rt>あい</rt></ruby>で";
  const lookup = buildReadingLookup(
    { romaji: { "愛で": "wrong", " 愛で ": " ai de " }, furigana: { "愛で": ruby } },
    { romaji: { "愛で": "ai de", "新しい行": "atarashii gyō" } }
  );
  assert.equal(getReading(lookup.romaji, "愛で"), "ai de");
  assert.equal(getReading(lookup.romaji, " 愛で "), " ai de ");
  assert.equal(getReading(lookup.romaji, "新しい行"), "atarashii gyō");
  assert.equal(getReading(lookup.furigana, "愛で"), ruby);
  assert.equal(getReading(lookup.romaji, "[wave]愛で"), undefined);
  assert.equal(getReading(lookup.romaji, "missing"), undefined);
  assert.equal(getReading(lookup.romaji, "toString"), undefined);
  assert.throws(() => { lookup.romaji["愛で"] = "changed"; }, TypeError);
});

test("both source tables reject action markers even when corrections hide base values", () => {
  for (const mode of ["furigana", "romaji"]){
    for (const marker of ["[wave]", "(CLAP)", "[mic]", "[chant]", "[jump]", "[spin]", "[turn]"]){
      assert.throws(() => buildReadingLookup({ [mode]: { [`愛${marker}`]: "ai" } }), /Action markers/);
      assert.throws(() => buildReadingLookup({ [mode]: { "愛": `${marker}ai` } }, { [mode]: { "愛": "ai" } }), /Action markers/);
      assert.throws(() => buildReadingLookup({}, { [mode]: { [`${marker}愛`]: "ai" } }), /Action markers/);
      assert.throws(() => buildReadingLookup({}, { [mode]: { "愛": `a${marker}i` } }), /Action markers/);
    }
  }
});

test("empty keys and invalid readings fail instead of silently disappearing", () => {
  for (const table of [{ " ": "ai" }, { "愛": "" }, { "愛": " " }, { "愛": null }, { "愛": 1 }]){
    assert.throws(() => buildReadingLookup({ romaji: table }), /Invalid/);
    assert.throws(() => buildReadingLookup({}, { furigana: table }), /Invalid/);
  }
});

test("shipped reading tables load as immutable plain-text dictionaries", () => {
  assert.ok(Object.keys(furigana).length > 0);
  assert.ok(Object.keys(readings).length > 0);
  assert.equal(Object.getPrototypeOf(furigana), null);
  assert.equal(Object.getPrototypeOf(readings), null);
  assert.ok(Object.isFrozen(furigana));
  assert.ok(Object.isFrozen(readings));
});
