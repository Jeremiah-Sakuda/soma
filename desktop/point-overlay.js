const svg = document.querySelector('svg'),
  pointer = document.getElementById('pointer'),
  trail = document.getElementById('trail'),
  selection = document.getElementById('selection'),
  hint = document.getElementById('hint');
const NS = 'http://www.w3.org/2000/svg';
let graphHover = false;
function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.appendChild(node);
  return node;
}
function clearGraph() {
  document.getElementById('graph-layer')?.remove();
  document.getElementById('graph-caption')?.remove();
}
// Shapes arrive in normalized capture coordinates; the window covers that display exactly.
// Drawn as an annotated sketch: inked edges, hand loops and pastel tags with leader lines.
// Only elements new since the last draw ink in, so stepping doesn't redraw everything.
let seen = new Set();
function loopPath(x, y, r, id) {
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const start = (seed % 360) * (Math.PI / 180), parts = [];
  for (let k = 0; k <= 28; k++) {
    const t = start + (k / 24) * Math.PI * 2,
      rr = r + Math.sin(t * 3 + seed) * r * 0.06 + (k > 24 ? (k - 24) * r * 0.035 : 0);
    parts.push(`${k ? 'L' : 'M'}${(x + Math.cos(t) * rr).toFixed(1)} ${(y + Math.sin(t) * rr * 0.94).toFixed(1)}`);
  }
  return parts.join(' ');
}
function renderGraph(m) {
  clearGraph();
  hint.style.display = 'none';
  pointer.style.display = 'none';
  selection.style.display = 'none';
  trail.setAttribute('d', '');
  const W = frame.width, H = frame.height, r = m.radius * W, font = m.font * W,
    at = (p) => ({ x: p.x * W, y: p.y * H });
  const now = new Set(), fresh = (key) => { now.add(key); return seen.has(key) ? '' : ' ink-new'; };
  const layer = el('g', { id: 'graph-layer' }, svg);
  for (const e of m.edges) {
    const a = at(e.from), c = at(e.control), b = at(e.to), mid = at(e.center);
    const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
    const g = el('g', { class: `graph-edge is-${e.tone}` }, layer);
    if (e.tone !== 'idle')
      el('path', { d, class: 'graph-stroke' + fresh(`e-${e.id}-${e.tone}`), pathLength: 1, 'stroke-width': r * (e.tone === 'struck' ? 0.14 : e.tone === 'path' ? 0.36 : 0.28) }, g);
    if (e.tone === 'struck') {
      const k = r * 0.45;
      el('path', { class: 'graph-cut' + fresh(`s-${e.id}`), pathLength: 1, 'stroke-width': r * 0.16, d: `M ${mid.x - k} ${mid.y + k} L ${mid.x + k} ${mid.y - k}` }, g);
    }
    if (e.tone === 'cut') {
      const k = r * 0.5;
      el('path', { class: 'graph-cut' + fresh(`x-${e.id}`), pathLength: 1, 'stroke-width': r * 0.18,
        d: `M ${mid.x - k} ${mid.y - k} L ${mid.x + k} ${mid.y + k} M ${mid.x + k} ${mid.y - k} L ${mid.x - k * 0.96} ${mid.y + k * 1.04}` }, g);
    }
    const hit = el('path', { d, class: 'graph-hit', 'data-edge': e.id }, g);
    el('title', {}, hit).textContent = e.label;
  }
  for (const n of m.nodes) {
    if (n.status === 'unreached') continue;
    const p = at(n);
    const g = el('g', { class: `graph-node is-${n.status}` }, layer);
    el('path', { d: loopPath(p.x, p.y, r * 1.22, n.id), class: 'graph-loop' + (n.status === 'waiting' ? '' : fresh(`n-${n.id}-${n.status}`)), pathLength: 1, 'stroke-width': r * (n.status === 'current' ? 0.2 : 0.13) }, g);
  }
  for (const w of m.weights) {
    const p = at(w);
    const g = el('g', { class: 'graph-weight', transform: `translate(${p.x} ${p.y})` }, layer);
    el('rect', { x: -font * 2.2, y: -font * 0.85, width: font * 4.4, height: font * 1.7, rx: 4 }, g);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g).textContent = w.text;
  }
  for (const t of m.tags) {
    const p = at(t), anchor = at(t.anchor), h = font * 1.65;
    let w = t.text.length * font * 0.56 + font * 1.1;
    const dx = p.x - anchor.x, dy = p.y - anchor.y, dist = Math.hypot(dx, dy) || 1;
    const end = { x: anchor.x + (dx / dist) * r * 1.3, y: anchor.y + (dy / dist) * r * 1.3 };
    const start = { x: Math.max(p.x - w / 2, Math.min(p.x + w / 2, end.x)), y: end.y < p.y ? p.y - h / 2 : p.y + h / 2 };
    const bend = { x: (start.x + end.x) / 2 + (end.y - start.y) * 0.25, y: (start.y + end.y) / 2 - (end.x - start.x) * 0.25 };
    const isNew = fresh(`t-${t.id}-${t.text}`);
    const g = el('g', { class: `graph-tag is-${t.tone}${isNew}` }, layer);
    el('path', { class: 'graph-leader', pathLength: 1,
      d: t.curved ? `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      ...(t.curved ? { 'marker-end': 'url(#graph-arrow)' } : {}) }, g);
    if (!t.curved) el('circle', { cx: end.x, cy: end.y, r: 3.5, class: 'graph-dot' }, g);
    const box = el('rect', { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 3 }, g);
    const label = el('text', { x: p.x, y: p.y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g);
    label.textContent = t.text;
    // Fit the tag to its real text width.
    const measured = label.getComputedTextLength?.();
    if (measured) {
      w = measured + font * 1.1;
      box.setAttribute('x', p.x - w / 2);
      box.setAttribute('width', w);
    }
  }
  seen = now;
  if (m.caption) {
    const box = document.createElement('div');
    box.id = 'graph-caption';
    const title = document.createElement('strong');
    title.textContent = m.caption.stepLabel;
    box.append(title, document.createTextNode(m.caption.text));
    box.style.left = m.caption.x * W + frame.dx + 'px';
    if (m.caption.anchor === 'top') box.style.top = m.caption.y * H + frame.dy + 'px';
    else box.style.bottom = innerHeight - (m.caption.y * H + frame.dy) + 'px';
    document.body.appendChild(box);
  }
}
document.addEventListener('mousemove', (event) => {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const over = Boolean(target?.classList?.contains('graph-hit'));
  if (over !== graphHover) {
    graphHover = over;
    window.somaPointOverlay.hover(over);
  }
});
document.addEventListener('click', (event) => {
  const edge = event.target?.getAttribute?.('data-edge');
  if (edge) window.somaPointOverlay.toggleEdge(edge);
});
// Coordinates are relative to the captured display; the window may sit offset from it.
let frame = { dx: 0, dy: 0, width: innerWidth, height: innerHeight };
function applyFrame(event) {
  // Measured here, at draw time: the window's own screen position is always current.
  const d = event.display;
  frame = d
    ? { dx: d.x - window.screenX, dy: d.y - window.screenY, width: d.width, height: d.height }
    : { dx: 0, dy: 0, width: innerWidth, height: innerHeight };
  svg.style.transform = `translate(${frame.dx}px, ${frame.dy}px)`;
  svg.style.width = frame.width + 'px';
  svg.style.height = frame.height + 'px';
}
window.somaPointOverlay.onDraw((event) => {
  applyFrame(event);
  if (event.type === 'graph') return renderGraph(event.model);
  if (event.type === 'graph-clear') {
    clearGraph();
    seen = new Set();
    if (graphHover) window.somaPointOverlay.hover((graphHover = false));
    return;
  }
  clearGraph();
  hint.style.display = '';
  hint.textContent = event.text;
  document.getElementById('source-annotations')?.remove();
  if (event.type === 'annotations') {
    pointer.style.display = 'none';
    selection.style.display = 'none';
    trail.setAttribute('d', '');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'source-annotations';
    for (const a of event.anchors) {
      const r = a.region,
        rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', r.x * frame.width);
      rect.setAttribute('y', r.y * frame.height);
      rect.setAttribute('width', r.width * frame.width);
      rect.setAttribute('height', r.height * frame.height);
      rect.setAttribute('class', 'source-reference');
      group.appendChild(rect);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', Math.max(8, r.x * frame.width));
      label.setAttribute('y', Math.max(22, r.y * frame.height - 8));
      label.textContent = a.label;
      group.appendChild(label);
    }
    svg.appendChild(group);
    hint.style.left = '12px';
    hint.style.top = '12px';
  } else if (event.type === 'tracking') {
    pointer.style.display = '';
    selection.style.display = 'none';
    pointer.setAttribute('cx', event.x);
    pointer.setAttribute('cy', event.y);
    trail.setAttribute(
      'd',
      event.path.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '),
    );
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, event.x + frame.dx + 22)) + 'px';
    hint.style.top = Math.min(innerHeight - 60, Math.max(8, event.y + frame.dy + 22)) + 'px';
  } else if (event.type === 'focus') {
    pointer.style.display = 'none';
    trail.setAttribute('d', '');
    selection.style.display = '';
    const r = event.region;
    selection.setAttribute('x', r.x * frame.width);
    selection.setAttribute('y', r.y * frame.height);
    selection.setAttribute('width', r.width * frame.width);
    selection.setAttribute('height', r.height * frame.height);
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, r.x * frame.width)) + 'px';
    hint.style.top = Math.max(8, r.y * frame.height - 48) + 'px';
  }
});
