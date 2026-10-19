import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../karaoke-sources.js", import.meta.url), "utf8");

export function karaokeApi(options = {}){
  const storage = options.storage || new Map();
  const requests = [];
  const root = {
    URL, AbortController, setTimeout, clearTimeout,
    navigator: { onLine: options.online !== false },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, init) => {
      requests.push({ url, init });
      return options.fetch ? options.fetch(url, init) : { ok: false, status: 503 };
    }
  };
  vm.runInNewContext(source, { window: root, URL, console }, { filename: "karaoke-sources.js" });
  return { api: root.KARAOKE_SOURCES, requests, storage };
}

export const plain = value => JSON.parse(JSON.stringify(value));

export function wordLyrics(lines){
  return {
    format: "timed-lyrics-v1",
    source: "test word timing",
    granularity: "word",
    lines: lines.map(([start, text, step = 0.2]) => ({
      start, end: start + Array.from(text).length * step,
      words: Array.from(text).map((char, index) => ({ text: char, start: start + index * step, end: start + (index + 1) * step }))
    }))
  };
}
