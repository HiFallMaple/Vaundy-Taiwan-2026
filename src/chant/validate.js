import { selectGuide, timeKey } from "./resolve.js";

const actions = new Set(["clap", "wave", "jump", "spin"]);
const ensure = (value, message) => { if (!value) throw new Error(message); };

export function validateChantEntry(song, entry, sources){
  ensure(entry && Object.keys(entry.versions).sort().join() === "jp,kr", `Missing or unknown version: ${song.id}`);
  const lines = new Map();
  for (const line of song.lyrics){
    ensure(Number.isFinite(line.time), "Invalid lyric time");
    ensure(!lines.has(timeKey(line.time)), `Duplicate lyric time: ${line.time}`);
    lines.set(timeKey(line.time), line);
  }
  const validateRows = (rows, actionRows = false) => {
    ensure(Array.isArray(rows), "Expected cue array");
    const seen = new Set();
    for (const row of rows){
      ensure(Number.isFinite(row.time), "Invalid cue time");
      const key = timeKey(row.time);
      ensure(!seen.has(key), `Duplicate cue: ${row.time}`);
      seen.add(key);
      ensure(lines.has(key), `Missing lyric @ ${row.time}`);
      ensure(row.expectedText === lines.get(key).jp, `Stale expectedText @ ${row.time}`);
      if (actionRows){
        ensure(Array.isArray(row.values) && row.values.every(value => actions.has(value)), `Invalid actions @ ${row.time}`);
        ensure(new Set(row.values).size === row.values.length, `Duplicate actions @ ${row.time}`);
      } else {
        ensure(["full", "partial"].includes(row.chant?.kind), `Invalid chant @ ${row.time}`);
      }
    }
  };
  validateRows(entry.actions, true);
  for (const version of ["jp", "kr"]){
    const guide = entry.versions[version];
    ensure(["guide", "inherit"].includes(guide.kind), "Invalid guide kind");
    if (guide.kind === "inherit"){
      ensure(["jp", "kr"].includes(guide.from), "Invalid inherited version");
      selectGuide(entry, version);
      continue;
    }
    ensure(Array.isArray(guide.sourceIds) && guide.sourceIds.every(id => Object.hasOwn(sources, id)), "Unknown source");
    ensure(Array.isArray(guide.notes) && guide.notes.every(note => typeof note === "string"), "Invalid notes");
    validateRows(guide.cues);
    validateRows(guide.actionOverrides || [], true);
  }
}
