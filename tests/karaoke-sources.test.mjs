import test from "node:test";
import assert from "node:assert/strict";
import { SONGS } from "../src/song-metadata.js";
import { karaokeApi, wordLyrics } from "./helpers/karaoke.mjs";

const payload = {
  Type: "Syllable",
  Source: { Provider: "kugou", Transport: "direct" },
  Content: [{ Type: "Vocal", Lead: { StartTime: 1, EndTime: 2, Syllables: [{ Text: "test", StartTime: 1, EndTime: 2 }] } }]
};
const response = { ok: true, json: async () => payload };

test("worker requests use valid IDs for every song and the verified Yobigoe ID", async () => {
  const { api, requests } = karaokeApi({ fetch: async () => response });
  for (const song of SONGS) await api.load(song);
  assert.equal(requests.length, SONGS.length);
  const ids = requests.map(({ url }) => new URL(url).pathname.split("/").at(-1));
  assert(ids.every(id => /^[a-zA-Z0-9]{1,100}$/.test(id)));
  assert.equal(new Set(ids).size, SONGS.length);
  const yobigoe = requests.find(({ url }) => new URL(url).searchParams.get("track_name") === "呼び声");
  assert(new URL(yobigoe.url).pathname.endsWith("/3kQf453SpkwX7ALdgzNSNY"));
  const timed = await api.load(SONGS[0]);
  assert.equal(timed.source, "酷狗 KRC");
});

test("new code refreshes legacy caches online and reuses the upgraded cache", async () => {
  const storage = new Map([["horo-karaoke-v2-test", JSON.stringify(wordLyrics([[1, "legacy"]]))]]);
  const { api, requests } = karaokeApi({ storage, fetch: async () => response });
  const song = { id: "test", title: "test" };
  const timed = await api.load(song);
  assert.equal(timed.source, "酷狗 KRC");
  assert.equal(requests.length, 1);
  await api.load(song);
  assert.equal(requests.length, 1);
  assert(storage.has("horo-karaoke-v2-test"));
  assert(storage.has("horo-karaoke-v3-test"));
});

test("legacy offline lyrics and failed refreshes retain usable cached data", async () => {
  const cached = wordLyrics([[1, "legacy"]]);
  for (const online of [false, true]){
    const storage = new Map([["horo-karaoke-v2-test", JSON.stringify(cached)]]);
    const { api, requests } = karaokeApi({ storage, online });
    const result = await api.load({ id: "test", title: "test" });
    assert.equal(result.source, cached.source);
    assert.equal(storage.has("horo-karaoke-v3-test"), false);
    if (!online) assert.equal(requests.length, 0);
  }
});
