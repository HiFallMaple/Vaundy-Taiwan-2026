import { getReading } from "../src/readings/lookup.js";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import assert from "node:assert/strict";
import { SONG_CONTENT } from "../src/song-content.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";
import { compact, resolveSongChants } from "../src/chant/resolve.js";
import { readings } from "./chant-data.mjs";

const { window, document } = parseHTML(fs.readFileSync("dist/index.html", "utf8"));
for (const key of ["window", "document", "Node", "HTMLElement", "Element", "MutationObserver", "Event", "CustomEvent"]){
  globalThis[key] = key === "window" ? window : key === "document" ? document : window[key];
}
const storage = new Map();
globalThis.localStorage = globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.location = window.location = { hash: "#/song/Yobigoe", pathname: "/", search: "", hostname: "localhost", href: "http://localhost/#/song/Yobigoe", origin: "http://localhost" };
globalThis.history = { replaceState(){} };
Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "DOM test", maxTouchPoints: 0 }, configurable: true });
window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){} });
window.scrollTo = () => {};
window.innerWidth = 1200;
window.innerHeight = 900;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "", lineHeight: "24px" });
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
window.HTMLElement.prototype.scrollTo = () => {};
window.HTMLElement.prototype.pause = () => {};
window.HTMLElement.prototype.load = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 100, right: 500, width: 500, height: 100 });
Object.defineProperty(window.HTMLSelectElement.prototype, "value", { get(){ return this.getAttribute("value") || ""; }, set(value){ this.setAttribute("value", value); } });
globalThis.fetch = async () => { throw new Error("No external resources in DOM smoke test"); };
const interval = globalThis.setInterval;
globalThis.setInterval = (...args) => { const timer = interval(...args); timer.unref(); return timer; };
const script = fs.readFileSync("dist/index.html", "utf8").match(/src="\.\/assets\/(index-[^"]+\.js)"/)[1];
try {
  await import(pathToFileURL(`${process.cwd()}/dist/assets/${script}`));
  await new Promise(resolve => setTimeout(resolve, 1000));
  const visible = el => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("rt,rp,.ico").forEach(n => n.remove());
    return compact(clone.textContent);
  };
  let cases = 0;
  for (const song of SONG_CONTENT){
    console.log(`Checking ${song.id}`);
    location.hash = `#/song/${encodeURIComponent(song.id)}`;
    window.dispatchEvent(new Event("hashchange"));
    await new Promise(resolve => setTimeout(resolve, 0));
    for (const version of ["kr", "jp", "kr", "jp"]){
      if ((localStorage.getItem("horo-chant-version") || "jp") !== version) document.getElementById("chant-version-btn").click();
      const expected = resolveSongChants(song, CHANT_GUIDES[song.id], version, readings);
      for (const mode of ["kana", "romaji", "both"]){
        for (let attempt = 0; attempt < 3 && (localStorage.getItem("horo-reading") || "kana") !== mode; attempt++) document.getElementById("reading-btn").click();
        assert.equal(localStorage.getItem("horo-reading") || "kana", mode);
        const rows = [...document.querySelectorAll("#lyrics-list .lyric-line")];
        assert.equal(rows.length, song.lyrics.length, song.id);
        rows.forEach((row, index) => {
          const resolved = expected[index];
          assert.equal(row.dataset.chant, resolved.chant);
          const target = row.querySelector(".lyric-jp");
          const source = visible(target);
          const lyric = song.lyrics[index];
          assert.equal(source, compact(mode === "romaji" ? getReading(readings, lyric.jp) || lyric.jp : lyric.jp), `Reading text: ${song.id} ${mode} @${resolved.time}`);
          const ranges = resolved.ranges[mode === "romaji" ? "romaji" : "jp"];
          const want = resolved.chant === "full" ? source : ranges.slice().sort((a, b) => a.start - b.start).map(r => Array.from(source).slice(r.start, r.end).join("")).join("");
          const actual = [...target.querySelectorAll(".chant-range")].map(visible).join("");
          assert.equal(actual, want, `${song.id} ${version} ${mode} @${resolved.time}`);
          assert.equal([...target.children].filter(n => n.classList.contains("ico")).length, resolved.actions.length, `Actions: ${song.id} ${version} ${mode} @${resolved.time}`);
        });
        document.getElementById("karaoke-btn").click();
        document.getElementById("karaoke-btn").click();
        cases++;
      }
    }
  }
  console.log(`Built app DOM smoke passed: ${cases} song/version/reading cases with bidirectional version and karaoke toggles.`);
} catch (error){ console.error(error); process.exit(1); }
process.exit(0);
