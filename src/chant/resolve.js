export const ICONS = /[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu;
export const compact = value => Array.from(String(value || "").replace(ICONS, "")).filter(c => !/\s/u.test(c)).join("");
export const timeKey = time => Math.round(Number(time) * 1000);

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
  if (!target || !Number.isInteger(target.occurrence) || target.occurrence < 1) throw new Error("Invalid chant occurrence");
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
  const cue = (guide.cues || []).find(c => timeKey(c.time) === timeKey(line.time));
  const actions = (guide.actionOverrides || []).find(c => timeKey(c.time) === timeKey(line.time))
    || (entry.actions || []).find(c => timeKey(c.time) === timeKey(line.time));
  if (cue && cue.expectedText !== line.jp) throw new Error(`Stale chant text @ ${line.time}`);
  if (actions && actions.expectedText !== line.jp) throw new Error(`Stale action text @ ${line.time}`);
  const chant = cue?.chant?.kind || "none";
  if (!["none", "full", "partial"].includes(chant)) throw new Error(`Invalid chant kind: ${chant}`);
  if (chant === "full" && cue.chant.parts) throw new Error("Full chant cannot have parts");
  const sources = { jp: line.jp, romaji: readings.romaji, zh: line.tr };
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
  return { time: line.time, chant, ranges, actions: actions?.values || [], requestedVersion: version, resolvedVersion: guide.resolvedVersion };
}

export function resolveSongChants(song, entry, version, readings = {}){
  return song.lyrics.map(line => resolveLineChant(line, entry, version, { romaji: readings[line.jp] }));
}
