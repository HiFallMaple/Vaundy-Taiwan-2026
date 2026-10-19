export function stripActionMarkers(value){
  return String(value ?? "").replace(/[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/giu, "");
}

export function buildReadingLookup(base, corrections = {}){
  const result = {};
  const conflicts = [];
  for (const mode of ["furigana", "romaji"]){
    const table = Object.create(null);
    const origins = new Map();
    for (const [key, value] of Object.entries({ ...base[mode], ...corrections[mode] })){
      const text = stripActionMarkers(key);
      if (!text.trim()) continue;
      const reading = stripActionMarkers(value);
      if (Object.hasOwn(table, text) && table[text] !== reading){
        conflicts.push({ mode, text, keys: [origins.get(text), key] });
      } else {
        table[text] = reading;
        origins.set(text, key);
      }
    }
    result[mode] = Object.freeze(table);
  }
  if (conflicts.length) throw new Error(`Conflicting action-free readings: ${JSON.stringify(conflicts)}`);
  return Object.freeze(result);
}

export function getReading(table, text){
  return table?.[stripActionMarkers(text)];
}
