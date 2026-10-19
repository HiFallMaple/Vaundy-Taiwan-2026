import { getReading } from "../readings/lookup.js";

export const ICONS = /[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu;
export const compact = value => Array.from(String(value || "").replace(ICONS, "")).filter(c => !/\s/u.test(c)).join("");

export function selectGuide(entry, version, seen = new Set()){
  if (seen.has(version)) throw new Error(`Circular chant inheritance: ${version}`);
  seen.add(version);
  const guide = entry?.versions?.[version];
  if (!guide) throw new Error(`Missing chant version: ${version}`);
  if (guide.kind === "inherit") return selectGuide(entry, guide.from, seen);
  if (guide.kind !== "guide") throw new Error(`Invalid chant guide: ${version}`);
  return { ...guide, resolvedVersion: version };
}

export function findRange(source, target){
  if (!target || typeof target.text !== "string" || !Number.isInteger(target.occurrence) || target.occurrence < 1) throw new Error("Invalid chant occurrence or target");
  const chars = Array.from(compact(source));
  const needle = Array.from(compact(target.text));
  if (!needle.length) throw new Error("Empty chant target");
  let count = 0;
  for (let start = 0; start <= chars.length - needle.length; start++){
    if (needle.every((c, i) => c === chars[start + i]) && ++count === target.occurrence) return { start, end: start + needle.length };
  }
  throw new Error(`Chant target not found: ${target.text} #${target.occurrence}`);
}

export function resolveLineChant(line, entry, version, readings = {}){
  const guide = selectGuide(entry, version);
  const cue = line.chants?.[guide.resolvedVersion];
  const chant = cue?.chant?.kind || "none";
  if (!["none", "full", "partial"].includes(chant)) throw new Error(`Invalid chant kind: ${chant}`);
  if (chant === "full" && cue.chant.parts) throw new Error("Full chant cannot have parts");
  const sources = { jp: line.jp, romaji: readings.romaji ?? (!/[ぁ-ゖ゠-ヿ一-鿿]/u.test(line.jp) ? line.jp : undefined), zh: line.tr };
  const ranges = { jp: [], romaji: [], zh: [] };
  if (chant === "partial"){
    if (!cue.chant.parts?.length) throw new Error("Partial chant requires parts");
    for (const part of cue.chant.parts){
      if (!part.jp || !part.romaji) throw new Error("Partial chant requires Japanese and romaji targets");
      for (const mode of Object.keys(ranges)){
        if (!part[mode] || sources[mode] === undefined) continue;
        const range = findRange(sources[mode], part[mode]);
        if (ranges[mode].some(r => r.start < range.end && range.start < r.end)) throw new Error(`Overlapping chant ranges: ${mode}`);
        ranges[mode].push(range);
      }
    }
  }
  for (const target of cue?.chant?.translationParts || []){
    const range = findRange(line.tr, target);
    if (ranges.zh.some(r => r.start < range.end && range.start < r.end)) throw new Error("Overlapping translation ranges");
    ranges.zh.push(range);
  }
  const actionPlacements = (cue?.actions || []).map(action => {
    const marks = parseActionMarks(action.marks);
    const keys = ["at", "before", "after"].filter(key => Object.hasOwn(action, key));
    if (keys.length !== 1 || action.at !== undefined && !["start", "end"].includes(action.at)) throw new Error("Invalid action position");
    const positions = {};
    for (const mode of ["jp", "romaji"]){
      if (action.at) positions[mode] = action.at === "start" ? 0 : Array.from(compact(sources[mode])).length;
      else {
        const target = (action.before || action.after)?.[mode];
        if (!target || !compact(line.jp)) throw new Error("Inline action requires Japanese and romaji targets");
        if (typeof target.text !== "string" || !compact(target.text) || !Number.isInteger(target.occurrence) || target.occurrence < 1) throw new Error("Invalid action target");
        if (sources[mode] === undefined) positions[mode] = null;
        else {
          const range = findRange(sources[mode], target);
          positions[mode] = action.before ? range.start : range.end;
        }
      }
    }
    return { marks, positions, edge: action.at || keys[0] };
  });
  return { time: line.time, chant, ranges, actionPlacements, actions: [...new Set(actionPlacements.flatMap(action => action.marks))], requestedVersion: version, resolvedVersion: guide.resolvedVersion };
}

export function resolveSongChants(song, entry, version, readings = {}){
  return song.lyrics.map(line => resolveLineChant(line, entry, version, { romaji: getReading(readings, line.jp) }));
}

export function parseActionMarks(value){
  if (typeof value !== "string" || !/^(?:\[(?:clap|wave|jump|spin)\])+$/.test(value)) throw new Error(`Invalid action marks: ${value}`);
  return [...value.matchAll(/\[([a-z]+)\]/g)].map(match => match[1]);
}
