import test from "node:test";
import assert from "node:assert/strict";
import { checkLyricLayout, checkSongContent } from "../scripts/check-song-content.mjs";

test("nested cues and escaped strings stay in one lyric object line", () => {
  assert.equal(checkLyricLayout('lyrics: [\n{ jp: "\\\"},[", chants: { jp: { actions: [{ marks: "[clap]" }] } } },\n]'), 1);
});

test("multiline lyric objects fail even when their nested cues are valid", () => {
  assert.throws(() => checkLyricLayout('lyrics: [\n{ jp: "a",\n chants: {} },\n]'), /one physical line/);
});

test("all shipped lyric rows follow layout and metadata ownership rules", checkSongContent);
