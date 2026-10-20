const ACTION_MARKER = /[\[(](?:wave|clap|mic|chant|jump|spin|turn)[\])]/iu;

export function buildReadingLookup(base, corrections = {}){
  const result = {};
  for (const mode of ["furigana", "romaji"]){
    const table = Object.create(null);
    for (const [source, entries] of [["base", base[mode]], ["corrections", corrections[mode]]]){
      for (const [text, reading] of Object.entries(entries || {})){
        if (!text.trim() || typeof reading !== "string" || !reading.trim()){
          throw new Error(`Invalid ${source} ${mode} reading: ${JSON.stringify(text)}`);
        }
        if (ACTION_MARKER.test(text) || ACTION_MARKER.test(reading)){
          throw new Error(`Action markers are not allowed in ${source} ${mode} readings: ${JSON.stringify(text)}`);
        }
        table[text] = reading;
      }
    }
    result[mode] = Object.freeze(table);
  }
  return Object.freeze(result);
}

export function getReading(table, text){
  return table?.[text];
}
