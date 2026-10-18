export function markChantRanges(markup, ranges, full = false, documentRef = document){
  const template = documentRef.createElement("template");
  template.innerHTML = markup;
  const content = template.content;
  content.querySelectorAll(".ico").forEach(icon => icon.remove());
  const pieces = [];
  const visit = parent => {
    for (const node of [...parent.childNodes]){
      if (node.nodeType === 3) pieces.push({ node, text: node.nodeValue, atomic: false });
      else if (node.nodeType === 1){
        if (["RT", "RP"].includes(node.tagName)) continue;
        if (node.tagName === "RUBY"){
          pieces.push({ node, text: [...node.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(""), atomic: true });
        } else visit(node);
      }
    }
  };
  visit(content);
  let index = 0;
  const selected = position => full || ranges.some(r => r.start <= position && position < r.end);
  const wrap = node => {
    const span = documentRef.createElement("span");
    span.className = "chant-range";
    node.replaceWith(span);
    span.appendChild(node);
  };
  for (const piece of pieces){
    const chars = Array.from(piece.text);
    if (piece.atomic){
      const length = chars.filter(c => !/\s/u.test(c)).length;
      const mask = Array.from({ length }, (_, i) => selected(index + i));
      if (mask.some(Boolean) && !mask.every(Boolean)) throw new Error(`Chant boundary splits ruby: ${piece.text}`);
      if (length && mask.every(Boolean)) wrap(piece.node);
      index += length;
      continue;
    }
    const fragment = documentRef.createDocumentFragment();
    let run = "", state = false;
    const flush = () => {
      if (!run) return;
      const node = documentRef.createTextNode(run);
      fragment.appendChild(node);
      if (state) wrap(node);
      run = "";
    };
    for (const char of chars){
      const space = /\s/u.test(char);
      const next = space ? state : selected(index++);
      if (next !== state){ flush(); state = next; }
      run += char;
    }
    flush();
    piece.node.replaceWith(fragment);
  }
  const output = documentRef.createElement("div");
  output.appendChild(content);
  return output.innerHTML;
}
