import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { resolveLineChant } from "../src/chant/resolve.js";
import { insertActionIcons, markChantRanges } from "../src/chant/render.js";
import { chantSummary } from "../src/chant/summary.js";
import { SONG_CONTENT } from "../src/song-content.js";
import { CHANT_GUIDES } from "../src/chant/version-data.js";

const { document } = parseHTML("<html></html>");
const icons = Object.fromEntries(["wave", "clap", "jump", "spin"].map(mark => [mark, `<i class="ico ico-${mark}">[${mark}]</i>`]));
const entry = { versions: { jp: { kind: "guide" }, kr: { kind: "guide" } } };
const target = (jp, romaji = jp, occurrence = 1) => ({ jp: { text: jp, occurrence }, romaji: { text: romaji, occurrence } });
const render = (line, version, source = line.jp, mode = "jp", romaji = line.jp) => {
  const resolved = resolveLineChant(line, entry, version, { romaji });
  const marked = markChantRanges(source, resolved.ranges[mode], resolved.chant === "full", document);
  return insertActionIcons(marked, resolved.actionPlacements, mode, icons, document);
};
const plain = markup => {
  const root = document.createElement("div");
  root.innerHTML = markup;
  root.querySelectorAll("rt,rp").forEach(node => node.remove());
  return root.textContent;
};

test("不可幸力 keeps the confirmed wave before welcome in both versions", () => {
  const song = SONG_CONTENT.find(song => song.id === "Fukakouryoku");
  const line = song.lyrics.find(line => line.time === 102.5);
  assert.equal(line.jp, "welcome to the dirty night");
  for (const version of ["jp", "kr"]){
    const resolved = resolveLineChant(line, CHANT_GUIDES[song.id], version);
    const markup = markChantRanges(line.jp, resolved.ranges.jp, resolved.chant === "full", document);
    const root = document.createElement("div");
    root.innerHTML = insertActionIcons(markup, resolved.actionPlacements, "jp", icons, document);
    assert.equal(root.firstElementChild.className, "ico ico-wave");
    assert.equal(root.querySelectorAll(".ico").length, 1);
    assert.equal(root.querySelectorAll(".chant-range .ico").length, 0);
    root.querySelector(".ico").remove();
    assert.equal(root.textContent, "welcome to the dirty night");
  }
});

test("start, before, after and end retain repeated marks and whitespace", () => {
  const line = { time: 1, jp: "😀今 チェンジ", chants: { jp: { actions: [
    { at: "start", marks: "[wave]" },
    { before: target("チェンジ", "chenji"), marks: "[clap][clap]" },
    { after: target("チェンジ", "chenji"), marks: "[jump]" },
    { at: "end", marks: "[spin]" }
  ] } } };
  assert.equal(plain(render(line, "jp", '<ruby>😀今<rt>いま</rt></ruby> チェンジ', "jp", "ima chenji")), "[wave]😀今 [clap][clap]チェンジ[jump][spin]");
  assert.equal(plain(render(line, "jp", "ima chenji", "romaji", "ima chenji")), "[wave]ima [clap][clap]chenji[jump][spin]");
});

test("same-boundary actions keep declaration order inside full chant markup", () => {
  const line = { time: 1, jp: "甲乙丙", chants: { jp: { chant: { kind: "full" }, actions: [
    { before: target("乙"), marks: "[clap]" },
    { before: target("乙"), marks: "[wave]" },
    { after: target("乙"), marks: "[spin]" }
  ] } } };
  const markup = render(line, "jp");
  assert.equal(plain(markup), "甲[clap][wave]乙[spin]丙");
  const root = document.createElement("div"); root.innerHTML = markup;
  assert.equal(root.querySelectorAll(".chant-range .ico").length, 0);
  assert.equal([...root.querySelectorAll(".chant-range")].map(node => node.textContent).join(""), "甲乙丙");
});

test("versions select different positions and occurrence without accumulating icons", () => {
  const line = { time: 1, jp: "abc abc", chants: {
    jp: { actions: [{ before: target("abc", "abc", 2), marks: "[clap]" }] },
    kr: { actions: [{ after: target("abc"), marks: "[wave]" }] }
  } };
  for (const version of ["jp", "kr", "jp", "kr", "jp"]){
    assert.equal(plain(render(line, version)), version === "jp" ? "abc [clap]abc" : "abc[wave] abc");
  }
});

test("ruby boundaries remain atomic for before and after actions", () => {
  const line = { time: 1, jp: "未来へ", chants: { jp: { actions: [{ after: target("未来", "mirai"), marks: "[wave]" }] } } };
  const markup = '<ruby>未来<rt>みらい</rt></ruby>へ';
  assert.equal(plain(render(line, "jp", markup, "jp", "mirai e")), "未来[wave]へ");
  line.chants.jp.actions = [{ before: target("来", "rai"), marks: "[clap]" }];
  assert.throws(() => render(line, "jp", markup, "jp", "mirai e"), /splits ruby/);
});

test("equivalent boundaries on adjacent ruby nodes retain declaration order", () => {
  const line = { time: 1, jp: "甲乙", chants: { jp: { actions: [
    { before: target("乙"), marks: "[clap]" },
    { after: target("甲"), marks: "[wave]" },
    { before: target("甲"), marks: "[spin]" },
    { at: "start", marks: "[jump]" }
  ] } } };
  assert.equal(plain(render(line, "jp", '<ruby>甲<rt>こう</rt></ruby><ruby>乙<rt>おつ</rt></ruby>')), "[spin][jump]甲[clap][wave]乙");
});

test("action-only rows render and repeated icons do not inflate statistics", () => {
  const line = { time: 1, jp: "", chants: { jp: { actions: [{ at: "start", marks: "[clap][clap]" }] } } };
  assert.equal(plain(render(line, "jp")), "[clap][clap]");
  assert.deepEqual(resolveLineChant(line, entry, "jp").actions, ["clap"]);
  assert.deepEqual(chantSummary([resolveLineChant(line, entry, "jp")]), { chant: 0, clap: true, wave: false, jump: false, spin: false });
});

test("invalid marks, positions and untranslated targets are rejected", () => {
  const line = action => ({ time: 1, jp: "abc", chants: { jp: { actions: [action] } } });
  for (const action of [
    { at: "start", marks: "[mic]" }, { at: "start", marks: "[clap]text" },
    { at: "start", before: target("a"), marks: "[clap]" }, { at: "middle", marks: "[clap]" },
    { before: { jp: { text: "a", occurrence: 1 } }, marks: "[clap]" },
    { before: target("missing"), marks: "[clap]" },
    { after: target("a", "a", 0), marks: "[clap]" }
  ]) assert.throws(() => resolveLineChant(line(action), entry, "jp", { romaji: "abc" }));
});

test("English fallback still resolves inline romaji positions without a reading entry", () => {
  const line = { time: 1, jp: "welcome", chants: { jp: { actions: [{ after: target("wel"), marks: "[wave]" }] } } };
  assert.deepEqual(resolveLineChant(line, entry, "jp").actionPlacements[0].positions, { jp: 3, romaji: 3 });
});
