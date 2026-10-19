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

export function insertActionIcons(markup, placements, mode, icons, documentRef = document){
  const iconMarkup = marks => marks.map(mark => {
    if (!icons[mark]) throw new Error(`Missing action icon: ${mark}`);
    return icons[mark];
  }).join("");
  if (!placements.length) return markup;
  if (placements.every(placement => ["start", "end"].includes(placement.edge))){
    const edgeMarkup = edge => iconMarkup(placements.filter(placement => placement.edge === edge).flatMap(placement => placement.marks));
    return edgeMarkup("start") + markup + edgeMarkup("end");
  }
  const template = documentRef.createElement("template");
  template.innerHTML = markup;
  const content = template.content;
  const pieces = [];
  let length = 0, rawLength = 0;
  const visit = parent => {
    for (const node of [...parent.childNodes]){
      if (node.nodeType === 1 && (node.matches("rt,rp,.ico"))) continue;
      if (node.nodeType === 3 || node.nodeType === 1 && node.tagName === "RUBY"){
        const atomic = node.nodeType === 1;
        const text = atomic ? [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.nodeValue).join("") : node.nodeValue;
        const offsets = [];
        let offset = 0;
        for (const char of Array.from(text)){
          if (!/\s/u.test(char)) offsets.push({ start: offset, end: offset + char.length });
          offset += char.length;
        }
        pieces.push({ node, atomic, offsets, start: length, end: length + offsets.length, rawStart: rawLength, rawEnd: rawLength + text.length });
        length += offsets.length;
        rawLength += text.length;
      } else if (node.nodeType === 1) visit(node);
    }
  };
  visit(content);
  const points = new Map();
  const boundaries = new Map();
  const physicalPoints = new Map();
  const boundary = (node, edge) => {
    let edges = boundaries.get(node);
    if (!edges){ edges = {}; boundaries.set(node, edges); }
    if (!edges[edge]){
      const anchor = documentRef.createTextNode("");
      if (node === content){ if (edge === "start") content.prepend(anchor); else content.append(anchor); }
      else if (edge === "start") node.before(anchor);
      else node.after(anchor);
      edges[edge] = anchor;
    }
    return { node: edges[edge], offset: 0 };
  };
  for (const placement of placements){
    const position = placement.positions[mode];
    if (position === null) continue;
    if (!Number.isInteger(position) || position < 0 || position > length) throw new Error(`Invalid action boundary: ${position}`);
    let point, physicalPosition;
    if (["start", "end"].includes(placement.edge)){
      physicalPosition = placement.edge === "start" ? 0 : rawLength;
      point = () => boundary(content, placement.edge);
    }
    else {
      const after = placement.edge === "after";
      const piece = pieces.find(piece => after ? piece.start < position && position <= piece.end : piece.start <= position && position < piece.end);
      if (!piece) throw new Error(`Action boundary not found: ${position}`);
      if (piece.atomic){
        if (position !== piece.start && position !== piece.end) throw new Error(`Action boundary splits ruby: ${piece.node.textContent}`);
        const edge = position === piece.start ? "start" : "end";
        physicalPosition = edge === "start" ? piece.rawStart : piece.rawEnd;
        point = () => boundary(piece.node, edge);
      } else {
        const offset = after ? piece.offsets[position - piece.start - 1].end : piece.offsets[position - piece.start].start;
        physicalPosition = piece.rawStart + offset;
        point = () => ({ node: piece.node, offset });
      }
    }
    if (!physicalPoints.has(physicalPosition)) physicalPoints.set(physicalPosition, { point, marks: [] });
    physicalPoints.get(physicalPosition).marks.push(...placement.marks);
  }
  for (const { point: createPoint, marks } of physicalPoints.values()){
    const point = createPoint();
    if (!points.has(point.node)) points.set(point.node, new Map());
    points.get(point.node).set(point.offset, marks);
  }
  for (const [node, offsets] of points){
    for (const [offset, marks] of [...offsets].sort(([a], [b]) => b - a)){
      const marker = documentRef.createTextNode("");
      const tail = documentRef.createTextNode(node.nodeValue.slice(offset));
      node.nodeValue = node.nodeValue.slice(0, offset);
      node.after(marker, tail);
      while (marker.parentNode !== content){
        const parent = marker.parentNode;
        const after = parent.cloneNode(false);
        while (marker.nextSibling) after.appendChild(marker.nextSibling);
        parent.after(marker, after);
        if (!parent.childNodes.length) parent.remove();
        if (!after.childNodes.length) after.remove();
      }
      const iconTemplate = documentRef.createElement("template");
      iconTemplate.innerHTML = iconMarkup(marks);
      marker.replaceWith(iconTemplate.content);
    }
  }
  const output = documentRef.createElement("div");
  output.appendChild(content);
  return output.innerHTML;
}
