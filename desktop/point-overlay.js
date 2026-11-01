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
  const W = innerWidth, H = innerHeight, r = m.radius * W, font = m.font * W,
    at = (p) => ({ x: p.x * W, y: p.y * H });
  const now = new Set(), fresh = (key) => { now.add(key); return seen.has(key) ? '' : ' ink-new'; };
  const layer = el('g', { id: 'graph-layer' }, svg);
  for (const c of m.callouts) {
    const g = el('g', { class: 'graph-callout' }, layer);
    el('rect', { x: c.x * W, y: c.y * H, width: c.width * W, height: c.height * H, rx: 8 }, g);
    el('text', { x: c.x * W, y: Math.max(20, c.y * H - 10) }, g).textContent = c.label;
  }
  for (const e of m.edges) {
    const a = at(e.from), c = at(e.control), b = at(e.to), mid = at(e.center);
    const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
    const g = el('g', { class: `graph-edge is-${e.tone}` }, layer);
    if (e.tone !== 'idle')
      el('path', { d, class: 'graph-stroke' + fresh(`e-${e.id}-${e.tone}`), pathLength: 1, 'stroke-width': r * (e.tone === 'path' ? 0.62 : 0.5) }, g);
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
    if (n.status === 'waiting' && n.distance !== null)
      el('text', { x: p.x + r * 1.45, y: p.y - r * 1.2, class: 'graph-pencil', 'font-size': font }, g).textContent = String(n.distance);
  }
  for (const w of m.weights) {
    const p = at(w);
    const g = el('g', { class: 'graph-weight', transform: `translate(${p.x} ${p.y})` }, layer);
    el('rect', { x: -font * 2.2, y: -font * 0.85, width: font * 4.4, height: font * 1.7, rx: 4 }, g);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g).textContent = w.text;
  }
  for (const t of m.tags) {
    const p = at(t), anchor = at(t.anchor), w = t.text.length * font * 0.52 + font * 1.3, h = font * 1.8;
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
    el('rect', { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 4 }, g);
    el('text', { x: p.x, y: p.y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g).textContent = t.text;
  }
  seen = now;
  if (m.caption) {
    const box = document.createElement('div');
    box.id = 'graph-caption';
    const title = document.createElement('strong');
    title.textContent = m.caption.stepLabel;
    const note = document.createElement('small');
    note.textContent = 'Esc hides';
    box.append(title, note, document.createTextNode(m.caption.text));
    box.style.fontSize = Math.max(12, m.caption.font * W) + 'px';
    box.style.left = m.caption.x * W + 'px';
    if (m.caption.anchor === 'top') box.style.top = m.caption.y * H + 'px';
    else box.style.bottom = (1 - m.caption.y) * H + 'px';
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
window.somaPointOverlay.onDraw((event) => {
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
      rect.setAttribute('x', r.x * innerWidth);
      rect.setAttribute('y', r.y * innerHeight);
      rect.setAttribute('width', r.width * innerWidth);
      rect.setAttribute('height', r.height * innerHeight);
      rect.setAttribute('class', 'source-reference');
      group.appendChild(rect);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', Math.max(8, r.x * innerWidth));
      label.setAttribute('y', Math.max(22, r.y * innerHeight - 8));
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
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, event.x + 22)) + 'px';
    hint.style.top = Math.min(innerHeight - 60, Math.max(8, event.y + 22)) + 'px';
  } else if (event.type === 'focus') {
    pointer.style.display = 'none';
    trail.setAttribute('d', '');
    selection.style.display = '';
    const r = event.region;
    selection.setAttribute('x', r.x * innerWidth);
    selection.setAttribute('y', r.y * innerHeight);
    selection.setAttribute('width', r.width * innerWidth);
    selection.setAttribute('height', r.height * innerHeight);
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, r.x * innerWidth)) + 'px';
    hint.style.top = Math.max(8, r.y * innerHeight - 48) + 'px';
  }
});
