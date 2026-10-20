export function chantSummary(lines){
  const summary = { chant: 0, clap: false, wave: false, jump: false, spin: false };
  for (const line of lines){
    if (line.chant !== "none") summary.chant++;
    for (const action of line.actions) summary[action] = true;
  }
  return summary;
}

export function buildChantBlocks(lines, times){
  const raw = [];
  for (let i = 0; i < lines.length; i++){
    if (lines[i].chant === "none") continue;
    let end = i;
    while (end + 1 < lines.length && lines[end + 1].chant !== "none") end++;
    raw.push({ from: i, to: end, start: Math.max(0, times[i] - 1.2), end: (times[end + 1] ?? times[end] + 8) + 0.6 });
    i = end;
  }
  const blocks = [];
  for (const block of raw){
    const previous = blocks.at(-1);
    if (previous && block.start - previous.end < 2.5){ previous.end = block.end; previous.to = block.to; }
    else blocks.push({ ...block });
  }
  return blocks;
}
