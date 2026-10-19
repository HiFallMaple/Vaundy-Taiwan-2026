import { selectGuide, resolveLineChant } from "./resolve.js";

const ensure = (value, message) => { if (!value) throw new Error(message); };

export function validateChantEntry(song, entry, sources, readings = {}){
  ensure(entry?.versions && Object.keys(entry.versions).sort().join() === "jp,kr", `Missing or unknown version: ${song.id}`);
  ensure(!Object.hasOwn(entry, "actions"), "Legacy shared actions are not allowed");
  const times = new Set();
  for (const line of song.lyrics){
    ensure(Number.isFinite(line.time), "Invalid lyric time");
    const key = Math.round(line.time * 1000);
    ensure(!times.has(key), `Duplicate lyric time: ${line.time}`);
    times.add(key);
    ensure(typeof line.jp === "string" && !/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/iu.test(line.jp), "Lyric text must not contain action markers");
    ensure(line.chants === undefined || line.chants && typeof line.chants === "object" && !Array.isArray(line.chants), "Invalid line chants");
    for (const [version, cue] of Object.entries(line.chants || {})){
      ensure(["jp", "kr"].includes(version), `Unknown line version: ${version}`);
      ensure(entry.versions[version]?.kind === "guide", "Inherited version cannot have line overrides");
      ensure(cue && typeof cue === "object" && !Array.isArray(cue), "Invalid line cue");
      ensure(Object.keys(cue).every(key => ["chant", "actions"].includes(key)), "Unknown line cue field");
      if (Object.hasOwn(cue, "chant")) ensure(cue.chant && typeof cue.chant === "object" && ["full", "partial"].includes(cue.chant.kind), "Invalid chant kind");
      ensure(cue.actions === undefined || Array.isArray(cue.actions), "Invalid actions");
      for (const action of cue.actions || []) ensure(action && Object.keys(action).every(key => ["at", "before", "after", "marks"].includes(key)), "Unknown action field");
    }
  }
  for (const version of ["jp", "kr"]){
    const guide = entry.versions[version];
    ensure(guide && ["guide", "inherit"].includes(guide.kind), "Invalid guide kind");
    ensure(!Object.hasOwn(guide, "cues") && !Object.hasOwn(guide, "actionOverrides"), "Legacy guide cues are not allowed");
    if (guide.kind === "inherit"){
      ensure(["jp", "kr"].includes(guide.from), "Invalid inherited version");
      selectGuide(entry, version);
    } else {
      ensure(Array.isArray(guide.sourceIds) && guide.sourceIds.every(id => Object.hasOwn(sources, id)), "Unknown source");
      ensure(Array.isArray(guide.notes) && guide.notes.every(note => typeof note === "string"), "Invalid notes");
    }
    for (const [index, line] of song.lyrics.entries()){
      try { resolveLineChant(line, entry, version, { romaji: readings[line.jp] }); }
      catch (error){ throw new Error(`${song.id} #${index} @${line.time} ${version}: ${error.message}`); }
    }
  }
}
