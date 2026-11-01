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
function renderGraph(m) {
  clearGraph();
  hint.style.display = 'none';
  pointer.style.display = 'none';
  selection.style.display = 'none';
  trail.setAttribute('d', '');
  const W = innerWidth,
    H = innerHeight,
    r = m.radius * W,
    at = (p) => ({ x: p.x * W, y: p.y * H });
  const layer = el('g', { id: 'graph-layer' }, svg);
  for (const c of m.callouts) {
    const g = el('g', { class: 'graph-callout' }, layer);
    el('rect', { x: c.x * W, y: c.y * H, width: c.width * W, height: c.height * H, rx: 10 }, g);
    el('text', { x: c.x * W, y: Math.max(20, c.y * H - 10) }, g).textContent = c.label;
  }
  for (const e of m.edges) {
    const a = at(e.from), c = at(e.control), b = at(e.to), mid = at(e.center);
    const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
    const g = el('g', { class: `graph-edge is-${e.tone}` }, layer);
    el('path', { d, class: 'graph-stroke' }, g);
    if (e.tone === 'cut') {
      const x = el('g', { class: 'graph-cut', transform: `translate(${mid.x} ${mid.y})` }, g);
      el('circle', { r: r * 0.55 }, x);
      const k = r * 0.22;
      el('path', { d: `M ${-k} ${-k} L ${k} ${k} M ${k} ${-k} L ${-k} ${k}` }, x);
    }
    const hit = el('path', { d, class: 'graph-hit', 'data-edge': e.id }, g);
    el('title', {}, hit).textContent = e.label;
  }
  for (const w of m.weights) {
    const p = at(w);
    const g = el('g', { class: 'graph-weight', transform: `translate(${p.x} ${p.y})` }, layer);
    el('rect', { x: -r * 1.25, y: -r * 0.55, width: r * 2.5, height: r * 1.1, rx: r * 0.55 }, g);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': r * 0.62 }, g).textContent = w.text;
  }
  for (const n of m.nodes) {
    const p = at(n);
    const g = el('g', { class: `graph-node is-${n.status}`, transform: `translate(${p.x} ${p.y})` }, layer);
    el('circle', { r, class: 'graph-ring' }, g);
    if (n.distance !== null) {
      const b = el('g', { class: 'graph-badge', transform: `translate(${r * 0.95} ${-r * 0.95})` }, g);
      el('rect', { x: -r * 0.55, y: -r * 0.42, width: r * 1.1, height: r * 0.84, rx: r * 0.42 }, b);
      el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': r * 0.56 }, b).textContent = String(n.distance);
    }
  }
  if (m.caption) {
    const box = document.createElement('div');
    box.id = 'graph-caption';
    const label = document.createElement('span');
    label.textContent = m.caption.stepLabel + ' · Esc hides';
    box.append(label, document.createTextNode(m.caption.text));
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
