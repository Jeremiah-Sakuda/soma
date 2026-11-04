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
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// A new caption types itself in with an uneven rhythm; an unchanged one appears at once.
let typedText = '', typing = 0;
function typeCaption(node, text) {
  const token = ++typing;
  if (text === typedText || reducedMotion.matches) {
    node.textContent = text;
    typedText = text;
    return;
  }
  typedText = text;
  let i = 0;
  const next = () => {
    if (token !== typing) return;
    i = Math.min(text.length, i + 1 + (Math.random() < 0.3 ? 1 : 0));
    node.textContent = text.slice(0, i);
    if (i < text.length) setTimeout(next, 18 + Math.random() * 28);
  };
  next();
}
// A companion pointer flies to the node being settled at each step: a lifted arc, a slight
// swell mid-flight, facing its direction of travel, landing just beside the node.
const trailPath = el('path', { id: 'buddy-trail' }, svg);
const buddy = el('g', { id: 'buddy', opacity: 0 }, svg);
el('path', { d: 'M0 0 L20 10 L10 13 L6 22 Z', class: 'buddy-shape' }, buddy);
let trailPoints = [];
let buddyAt = null, buddyTarget = null, flight = 0;
function placeBuddy(p, angle, scale) {
  buddy.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle}) scale(${scale})`);
}
function flyBuddy(target) {
  if (buddyTarget && Math.hypot(buddyTarget.x - target.x, buddyTarget.y - target.y) < 1) return;
  buddyTarget = target;
  const token = ++flight;
  buddy.setAttribute('opacity', 1);
  if (!buddyAt || reducedMotion.matches) {
    buddyAt = target;
    placeBuddy(target, -35, 1);
    return;
  }
  const from = buddyAt, dx = target.x - from.x, dy = target.y - from.y, dist = Math.hypot(dx, dy);
  const lift = Math.min(80, dist * 0.2),
    control = { x: from.x + dx / 2, y: from.y + dy / 2 - lift },
    duration = Math.min(1400, Math.max(600, (dist / 800) * 1000)),
    start = performance.now();
  const frame = (now) => {
    if (token !== flight) return;
    const t = Math.min(1, (now - start) / duration),
      e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const q = (a, c, b) => (1 - e) ** 2 * a + 2 * (1 - e) * e * c + e * e * b;
    const p = { x: q(from.x, control.x, target.x), y: q(from.y, control.y, target.y) };
    const tx = 2 * (1 - e) * (control.x - from.x) + 2 * e * (target.x - control.x),
      ty = 2 * (1 - e) * (control.y - from.y) + 2 * e * (target.y - control.y);
    const heading = t < 1 ? (Math.atan2(ty, tx) * 180) / Math.PI - 25 : -35;
    placeBuddy(p, heading, 1 + 0.3 * Math.sin(Math.PI * t));
    buddyAt = p;
    trailPoints = [...trailPoints, p].slice(-14);
    trailPath.setAttribute('d', trailPoints.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join(' '));
    trailPath.style.opacity = t < 1 ? 0.5 : 0;
    if (t >= 1) trailPoints = [];
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function hideBuddy() {
  flight++;
  trailPoints = [];
  trailPath.setAttribute('d', '');
  buddyAt = buddyTarget = null;
  buddy.setAttribute('opacity', 0);
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
// The final route draws from the start to the goal, one connection after another, each in
// its direction of travel (mirrors routeSequence in source-overlay-model.ts).
const ROUTE_LEAD = 0.15, ROUTE_SEGMENT = 0.45;
function routeSequence(m) {
  const order = new Map(), route = m.edges.filter((e) => e.tone === 'path' && e.fromId && e.toId);
  let at = m.lift?.source;
  while (at) {
    const next = route.find((e) => !order.has(e.id) && (e.fromId === at || e.toId === at));
    if (!next) break;
    order.set(next.id, { index: order.size, reverse: next.toId === at });
    at = next.toId === at ? next.fromId : next.toId;
  }
  return order.size === route.length ? order : new Map();
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
  const layer = el('g', { id: 'graph-layer', class: m.final ? 'is-final' : '' }, svg);
  const sequence = routeSequence(m), routeDone = `${ROUTE_LEAD + sequence.size * ROUTE_SEGMENT}s`;
  for (const e of m.edges) {
    const a = at(e.from), c = at(e.control), b = at(e.to), mid = at(e.center);
    const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
    const g = el('g', { class: `graph-edge is-${e.tone}` }, layer);
    if (e.tone !== 'idle' && e.tone !== 'struck') {
      // An edge inks once; later steps only change its tone. The final route inks again,
      // travelling from the start.
      const step = e.tone === 'path' ? sequence.get(e.id) : undefined;
      const stroke = el('path', { d: step?.reverse ? `M ${b.x} ${b.y} Q ${c.x} ${c.y} ${a.x} ${a.y}` : d, class: 'graph-stroke' + fresh(`e-${e.id}-${e.tone === 'path' ? 'path' : 'drawn'}`), pathLength: 1, 'stroke-width': r * (e.tone === 'path' ? 0.22 : 0.18) }, g);
      if (step) Object.assign(stroke.style, { animationDelay: `${ROUTE_LEAD + step.index * ROUTE_SEGMENT}s`, animationDuration: `${ROUTE_SEGMENT}s`, animationTimingFunction: 'linear' });
    }
    if (e.tone === 'struck') {
      // One slash on the source's own line, a third of the way along, clear of its label.
      const k = r * 0.5, sp = e.strike ? at(e.strike) : mid, sx = sp.x, sy = sp.y;
      el('path', { class: 'graph-cut' + fresh(`s-${e.id}`), pathLength: 1, 'stroke-width': r * 0.16, d: `M ${sx - k} ${sy + k} L ${sx + k} ${sy - k}` }, g);
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
    // Waiting nodes are told by their tags; only reached nodes get a loop.
    if (n.status === 'unreached' || n.status === 'waiting') continue;
    const p = at(n);
    const g = el('g', { class: `graph-node is-${n.status}` }, layer);
    const loop = el('path', { d: loopPath(p.x, p.y, r * 1.22, n.id), class: 'graph-loop' + (n.status === 'waiting' ? '' : fresh(`n-${n.id}-solid`)), pathLength: 1, 'stroke-width': r * (n.status === 'current' ? 0.12 : 0.08) }, g);
    // The goal is circled as the route arrives at it.
    if (sequence.size && n.id === m.lift?.goal) loop.style.animationDelay = routeDone;
  }
  for (const w of m.weights) {
    const p = at(w);
    const g = el('g', { class: 'graph-weight', transform: `translate(${p.x} ${p.y})` }, layer);
    el('rect', { x: -font * 2.2, y: -font * 0.85, width: font * 4.4, height: font * 1.7, rx: 4 }, g);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g).textContent = w.text;
  }
  // Measures text in the overlay's own hand, so leaders start on the box as drawn.
  const probeGroup = el('g', { class: 'graph-tag', visibility: 'hidden' }, layer);
  const probe = el('text', { 'font-size': font }, probeGroup);
  for (const t of m.tags) {
    const p = at(t), anchor = at(t.anchor), h = font * 1.65;
    probe.textContent = t.text;
    const measured = probe.getComputedTextLength?.();
    const w = measured ? measured + font * 1.1 : t.text.length * font * 0.56 + font * 1.1;
    const dx = p.x - anchor.x, dy = p.y - anchor.y, dist = Math.hypot(dx, dy) || 1;
    const end = { x: anchor.x + (dx / dist) * r * 1.05, y: anchor.y + (dy / dist) * r * 1.05 };
    const start = { x: Math.max(p.x - w / 2, Math.min(p.x + w / 2, end.x)), y: end.y < p.y ? p.y - h / 2 : p.y + h / 2 };
    const bend = { x: (start.x + end.x) / 2 + (end.y - start.y) * 0.25, y: (start.y + end.y) / 2 - (end.x - start.x) * 0.25 };
    const isNew = fresh(`t-${t.id}-${t.text}`);
    const g = el('g', { class: `graph-tag is-${t.tone}${t.quiet ? ' is-quiet' : ''}${isNew}` }, layer);
    // The route's own label lands once the route has reached the goal.
    const goal = m.nodes.find((n) => n.id === m.lift?.goal);
    const atGoal = goal && Math.abs(t.anchor.x - goal.x) < 1e-6 && Math.abs(t.anchor.y - goal.y) < 1e-6;
    if (sequence.size && (t.tone === 'route' || atGoal)) g.style.animationDelay = routeDone;
    el('path', { class: 'graph-leader', pathLength: 1,
      d: t.curved ? `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      ...(t.curved ? { 'marker-end': 'url(#graph-arrow)' } : {}) }, g);
    if (!t.curved) el('circle', { cx: end.x, cy: end.y, r: 3.5, class: 'graph-dot' }, g);
    el('rect', { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 3 }, g);
    el('text', { x: p.x, y: p.y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': font }, g).textContent = t.text;
    if (sequence.size && (t.tone === 'route' || atGoal)) g.querySelector('.graph-leader').style.animationDelay = routeDone;
  }
  probeGroup.remove();
  seen = now;
  const focus = m.nodes.find((n) => n.status === 'current');
  if (focus) {
    const p = at(focus);
    flyBuddy({ x: p.x + r * 0.95, y: p.y + r * 0.95 });
  } else hideBuddy();
  svg.appendChild(trailPath);
  svg.appendChild(buddy);
  if (m.caption) {
    const box = document.createElement('div');
    box.id = 'graph-caption';
    const title = document.createElement('strong');
    title.textContent = m.caption.stepLabel;
    const body = document.createElement('span');
    box.append(title, body);
    // Size the card for the finished text first so it does not grow while typing.
    body.textContent = m.caption.text;
    document.body.appendChild(box);
    box.style.width = Math.ceil(box.getBoundingClientRect().width) + 'px';
    body.textContent = '';
    typeCaption(body, m.caption.text);
    box.style.left = m.caption.x * W + frame.dx + 'px';
    if (m.caption.anchor === 'top') box.style.top = m.caption.y * H + frame.dy + 'px';
    else box.style.bottom = innerHeight - (m.caption.y * H + frame.dy) + 'px';
    document.body.appendChild(box);
  }
}
// Both lifted renderers share pointer routing. Graph actions return to the solver;
// model parts keep their existing selection IPC. A gesture belongs to one draw epoch.
let held = null, pointerEpoch = 0;
const activeLift = () => !document.body.classList.contains('lifted') ? null
  : window.SomaModel?.active ? window.SomaModel : window.SomaLift?.active ? window.SomaLift : null;
function cancelHeld() {
  held = null;
  document.body.style.cursor = '';
  window.SomaLift?.hover?.(null);
  window.SomaModel?.hover?.(null);
  if (graphHover) window.somaPointOverlay.hover((graphHover = false));
}
function pointerHover(event) {
  const lifted = activeLift();
  let over;
  if (lifted) {
    const id = lifted.hit(event.clientX, event.clientY);
    lifted.hover(id && id !== 'sheet' ? id : null);
    over = Boolean(id);
    document.body.style.cursor = id === 'control:caption' ? 'default' : id && id !== 'sheet' ? 'pointer' : id ? 'grab' : '';
  } else {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    over = !document.body.classList.contains('lifted') && Boolean(target?.classList?.contains('graph-hit'));
  }
  if (over !== graphHover) window.somaPointOverlay.hover((graphHover = over));
}
document.addEventListener('mousemove', (event) => {
  const lifted = activeLift();
  if (held && (held.renderer !== lifted || held.epoch !== pointerEpoch || event.buttons === 0)) cancelHeld();
  if (held) {
    const dx = event.clientX - held.x, dy = event.clientY - held.y;
    if (Math.hypot(event.clientX - held.startX, event.clientY - held.startY) > 4) held.moved = true;
    if (held.moved && !held.id.startsWith('control:')) lifted.drag(dx, dy);
    held.x = event.clientX;
    held.y = event.clientY;
    document.body.style.cursor = 'grabbing';
    return;
  }
  pointerHover(event);
});
document.addEventListener('mousedown', (event) => {
  const lifted = activeLift();
  if (!lifted || event.button !== 0 || event.detail > 1) return;
  const id = lifted.hit(event.clientX, event.clientY);
  if (!id) return;
  held = { renderer: lifted, epoch: pointerEpoch, id, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  document.body.style.cursor = 'grabbing';
});
document.addEventListener('mouseup', (event) => {
  if (!held || event.button !== 0) return;
  const gesture = held, lifted = activeLift();
  held = null;
  const same = lifted === gesture.renderer && gesture.epoch === pointerEpoch;
  const released = same ? lifted.hit(event.clientX, event.clientY) : null;
  const moved = gesture.moved || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 4;
  if (same && !moved && released === gesture.id) {
    if (lifted === window.SomaLift) {
      if (released.startsWith('edge:')) window.somaPointOverlay.toggleEdge(released.slice(5));
      else lifted.activate(released);
    } else if (released !== 'sheet') window.somaPointOverlay.select(released);
  }
  document.body.style.cursor = '';
  pointerHover(event);
});
document.addEventListener('dblclick', (event) => {
  const lifted = activeLift();
  const hit = lifted?.hit(event.clientX, event.clientY);
  // Models reset from a part or their sheet. Graph edges keep their single-toggle
  // gesture above; only the graph's sheet resets its view.
  if (hit && (lifted === window.SomaModel || hit === 'sheet')) lifted.resetView();
});
window.addEventListener('blur', cancelHeld);
document.addEventListener('mouseleave', cancelHeld);
document.addEventListener('click', (event) => {
  if (document.body.classList.contains('lifted')) return;
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
// The 3D lift draws the same checked model over the 2D sketch, which waits underneath and
// returns exactly where the sheet lands.
// A lift that fails after starting (lost GPU context, an error mid-frame) drops back to the
// flat sketch and tells the companion, which updates the controls.
for (const renderer of [window.SomaLift, window.SomaModel])
  if (renderer)
    renderer.onFail = (reason) => {
      cancelHeld();
      pointerEpoch++;
      document.body.classList.remove('lifted');
      window.somaPointOverlay.liftFailed(reason);
    };
// A checked search lifts as strings and heights; any other answer lifts as its 3D model.
function liftView(event) {
  // A checked circuit carries its scene beside the drawing; a search carries its lift.
  const scene = Boolean(event.model?.scene && !event.model.lift);
  const lift = scene ? window.SomaModel : window.SomaLift;
  // Switching between the two kinds: the other one lands first.
  (scene ? window.SomaLift : window.SomaModel)?.dispose();
  if (scene && event.view === '3d') event = { ...event, model: { ...event.model.scene, caption: event.model.caption } };
  if (event.view === '3d' && !lift) {
    // The 3D bundle did not load: stay flat and say so.
    document.body.classList.remove('lifted');
    window.somaPointOverlay.liftFailed();
  } else if (event.view === '3d') {
    try {
      // show() updates a running scene, and turns a landing back into a lift.
      lift.show(event.model, event.sheet, frame);
      document.body.classList.add('lifted');
    } catch (error) {
      console.error('Soma 3D lift could not start:', error);
      lift.dispose();
      document.body.classList.remove('lifted');
      window.somaPointOverlay.liftFailed();
    }
  } else if (lift?.active) lift.hide(() => document.body.classList.remove('lifted'));
  else document.body.classList.remove('lifted');
}
window.somaPointOverlay.onDraw((event) => {
  pointerEpoch++;
  cancelHeld();
  applyFrame(event);
  if (event.type === 'graph') {
    renderGraph(event.model);
    liftView(event);
    return;
  }
  if (event.type === 'graph-clear') {
    window.SomaLift?.dispose();
    window.SomaModel?.dispose();
    document.body.classList.remove('lifted');
    clearGraph();
    hideBuddy();
    typedText = '';
    typing++;
    seen = new Set();
    if (graphHover) window.somaPointOverlay.hover((graphHover = false));
    return;
  }
  // Pointing at new context replaces the graph. Do not leave a live 3D canvas or
  // its caption above the new selection, even if no separate clear event arrived.
  window.SomaLift?.dispose();
  window.SomaModel?.dispose();
  document.body.classList.remove('lifted');
  clearGraph();
  hideBuddy();
  seen = new Set();
  typedText = '';
  typing++;
  if (graphHover) window.somaPointOverlay.hover((graphHover = false));
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
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, r.x * frame.width + frame.dx)) + 'px';
    hint.style.top = Math.max(8, r.y * frame.height + frame.dy - 48) + 'px';
  }
});
