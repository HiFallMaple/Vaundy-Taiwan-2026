import test from "node:test";
import assert from "node:assert/strict";
import { buildChantBlocks, chantSummary } from "../src/chant/summary.js";
import { validateChantEntry } from "../src/chant/validate.js";

const line = (chant = "none", actions = []) => ({ chant, actions });
test("partial chants count once and actions follow the selected version", () => {
  assert.deepEqual(chantSummary([line("partial", ["wave"]), line("full", ["clap"]), line()]),
    { chant: 2, clap: true, wave: true, jump: false, spin: false });
});
test("practice blocks retain lead, tail, merge threshold and final line fallback", () => {
  assert.deepEqual(buildChantBlocks([line("partial"), line(), line("full"), line(), line("full")], [0.5, 3, 5, 8, 20]), [
    { from: 0, to: 2, start: 0, end: 8.6 },
    { from: 4, to: 4, start: 18.8, end: 28.6 }
  ]);
  assert.deepEqual(buildChantBlocks([line(), line()], [0, 10]), []);
});
test("exact merge threshold keeps practice blocks separate", () => {
  const result = buildChantBlocks([line("full"), line(), line("full")], [0, 5, 9.3]);
  assert.equal(result.length, 2);
});
test("validation rejects duplicate times, inherited overrides and unknown sources", () => {
  const song = { id: "test", lyrics: [{ time: 1, jp: "test", chants: { jp: { chant: { kind: "full" } } } }] };
  const entry = { versions: { jp: { kind: "guide", sourceIds: [], notes: [] }, kr: { kind: "inherit", from: "jp" } } };
  validateChantEntry(song, entry, {});
  assert.throws(() => validateChantEntry({ ...song, lyrics: [...song.lyrics, song.lyrics[0]] }, entry, {}), /Duplicate lyric time/);
  const inherited = structuredClone(song);
  inherited.lyrics[0].chants.kr = { actions: [] };
  assert.throws(() => validateChantEntry(inherited, entry, {}), /Inherited/);
  const unknown = structuredClone(entry);
  unknown.versions.jp.sourceIds.push("unknown");
  assert.throws(() => validateChantEntry(song, unknown, {}), /Unknown source/);
  assert.throws(() => validateChantEntry({ ...song, lyrics: [{ time: 1, jp: "[wave]test" }] }, entry, {}), /action markers/);
});
