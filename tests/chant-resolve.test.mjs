import test from "node:test";
import assert from "node:assert/strict";
import { findRange, resolveLineChant, selectGuide } from "../src/chant/resolve.js";

const line = { time: 1.5, jp: "[wave]今 チェンジ", tr: "此刻 Change" };
const cue = { time: 1.5, expectedText: line.jp, chant: { kind: "partial", parts: [{ jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }] } };
const entry = { actions: [{ time: 1.5, expectedText: line.jp, values: ["wave"] }], versions: { jp: { kind: "guide", cues: [cue] }, kr: { kind: "inherit", from: "jp" } } };

test("partial chants resolve through inheritance with explicit actions", () => {
  const resolved = resolveLineChant(line, entry, "kr", { romaji: "ima chenji" });
  assert.equal(resolved.resolvedVersion, "jp");
  assert.deepEqual(resolved.ranges.jp, [{ start: 1, end: 5 }]);
  assert.deepEqual(resolved.actions, ["wave"]);
});
test("repeated targets select their explicit occurrence using Unicode positions", () => {
  assert.deepEqual(findRange("😀ないぜ (ないぜ)", { text: "ないぜ", occurrence: 2 }), { start: 5, end: 8 });
});
test("empty guides do not inherit and explicit overrides can remove actions", () => {
  const changed = structuredClone(entry);
  changed.versions.kr = { kind: "guide", cues: [], actionOverrides: [{ time: 1.5, expectedText: line.jp, values: [] }] };
  const result = resolveLineChant(line, changed, "kr");
  assert.equal(result.chant, "none");
  assert.deepEqual(result.actions, []);
});
test("stale text, missing targets, overlapping ranges and cycles fail", () => {
  assert.throws(() => resolveLineChant({ ...line, jp: "changed" }, entry, "jp"), /Stale/);
  assert.throws(() => findRange("abc", { text: "z", occurrence: 1 }), /not found/);
  const changed = structuredClone(entry);
  changed.versions.jp.cues[0].chant.parts.push(cue.chant.parts[0]);
  assert.throws(() => resolveLineChant(line, changed, "jp", { romaji: "ima chenji" }), /Overlapping/);
  assert.throws(() => selectGuide({ versions: { jp: { kind: "inherit", from: "jp" } } }, "jp"), /Circular/);
});
