import test from "node:test";
import assert from "node:assert/strict";
import { findRange, resolveLineChant, selectGuide } from "../src/chant/resolve.js";

const chant = { kind: "partial", parts: [{ jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }] };
const line = { time: 1.5, jp: "今 チェンジ", tr: "此刻 Change", chants: { jp: { chant, actions: [{ at: "start", marks: "[wave]" }] } } };
const entry = { versions: { jp: { kind: "guide" }, kr: { kind: "inherit", from: "jp" } } };

test("partial chants resolve through inheritance with explicit actions", () => {
  const resolved = resolveLineChant(line, entry, "kr", { romaji: "ima chenji" });
  assert.equal(resolved.resolvedVersion, "jp");
  assert.deepEqual(resolved.ranges.jp, [{ start: 1, end: 5 }]);
  assert.deepEqual(resolved.actions, ["wave"]);
});
test("repeated targets select their explicit occurrence using Unicode positions", () => {
  assert.deepEqual(findRange("😀ないぜ (ないぜ)", { text: "ないぜ", occurrence: 2 }), { start: 5, end: 8 });
});
test("empty independent guides do not inherit actions", () => {
  const changed = structuredClone(entry);
  changed.versions.kr = { kind: "guide" };
  const result = resolveLineChant(line, changed, "kr");
  assert.equal(result.chant, "none");
  assert.deepEqual(result.actions, []);
});
test("missing targets, overlapping ranges and cycles fail", () => {
  assert.throws(() => resolveLineChant({ ...line, jp: "changed" }, entry, "jp"), /not found/);
  assert.throws(() => findRange("abc", { text: "z", occurrence: 1 }), /not found/);
  const changed = structuredClone(line);
  changed.chants.jp.chant.parts.push(chant.parts[0]);
  assert.throws(() => resolveLineChant(changed, entry, "jp", { romaji: "ima chenji" }), /Overlapping/);
  assert.throws(() => selectGuide({ versions: { jp: { kind: "inherit", from: "jp" } } }, "jp"), /Circular/);
});

test("changing time keeps the same cue and inline positions", () => {
  const moved = { ...line, time: 20 };
  assert.deepEqual(resolveLineChant(moved, entry, "jp", { romaji: "ima chenji" }), { ...resolveLineChant(line, entry, "jp", { romaji: "ima chenji" }), time: 20 });
});
