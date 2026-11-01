// Geometry for lifting Soma's checked search off the slide in 3D: the string model of
// shortest paths. A node rises to its checked distance from the start; each connection is
// a string as long as its cost, so the strings on shortest routes are taut and the others
// hang slack by exactly how much longer they are. Pure functions; no rendering.

export const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

/** Camera distance at which the z = 0 plane fills `height` pixels exactly, so a flat scene
 * lands on the slide pixel for pixel. */
export function cameraDistance(height, fovDegrees) {
  return height / 2 / Math.tan(((fovDegrees / 2) * Math.PI) / 180);
}

/** Normalized capture point to world pixels: origin at the display centre, y up. */
export const toWorld = (p, frame) => ({ x: p.x * frame.width - frame.width / 2, y: frame.height / 2 - p.y * frame.height });

/** How much longer a connection is than the climb between its ends; 0 means taut. */
export function slackOf(weight, fromDistance, toDistance, directed) {
  if (!Number.isFinite(weight) || fromDistance === null || toDistance === null) return null;
  const climb = directed ? toDistance - fromDistance : Math.abs(toDistance - fromDistance);
  const slack = weight - climb;
  // Tentative distances are upper bounds, so a string can never be shorter than its climb.
  return Math.abs(slack) < 1e-9 * Math.max(1, weight) ? 0 : Math.max(0, slack);
}

/** Region of the graph on the slide, in normalized coordinates, padded to include the
 * source's own node circles and arcs. */
export function sheetRegion(model) {
  const r = model.radius;
  // An arc's control point lies beyond the drawn curve; the curve's midpoint is on it.
  const xs = [...model.nodes.map((n) => n.x), ...model.edges.map((e) => e.center.x)],
    ys = [...model.nodes.map((n) => n.y), ...model.edges.map((e) => e.center.y)];
  // The printed node circles are about one radius; leave room for their stroke and the
  // printed costs beside the arcs, but stop short of neighbouring slide text.
  const pad = r * 1.8;
  const x = Math.max(0, Math.min(...xs) - pad),
    y = Math.max(0, Math.min(...ys) - pad);
  return {
    x,
    y,
    width: Math.min(1, Math.max(...xs) + pad) - x,
    height: Math.min(1, Math.max(...ys) + pad) - y,
  };
}

/** Everything the renderer draws, from one validated overlay model. Heights and slack come
 * only from the model's checked distances and costs. */
export function liftLayout(model, frame) {
  const lift = model.lift ?? { directed: false, source: model.nodes[0]?.id, goal: null, maxDistance: 1, unit: 'cost' };
  const region = sheetRegion(model);
  const regionPx = { width: region.width * frame.width, height: region.height * frame.height };
  const r = model.radius * frame.width;
  // The tallest node rises about two thirds of the graph's own height above the sheet.
  const tallest = Math.max(r * 6, Math.min(frame.height * 0.34, Math.max(regionPx.height, regionPx.width * 0.5) * 0.62));
  const scale = tallest / lift.maxDistance;
  const base = r * 1.6;
  const byId = new Map();
  const nodes = model.nodes.map((n) => {
    const known = n.distance !== null && n.status !== 'unreached';
    const node = {
      id: n.id,
      label: n.label,
      status: n.status,
      distance: known ? n.distance : null,
      tentative: n.status === 'waiting',
      ...toWorld(n, frame),
      height: known ? base + n.distance * scale : 0,
      source: n.id === lift.source,
      goal: n.id === lift.goal,
    };
    byId.set(n.id, node);
    return node;
  });
  const edges = model.edges.flatMap((e) => {
    const a = byId.get(e.fromId), b = byId.get(e.toId);
    if (!a || !b) return [];
    const weight = Number.isFinite(e.weight) ? e.weight : null;
    if (e.tone === 'cut') return [{ id: e.id, from: a.id, to: b.id, weight, slack: null, kind: 'cut', tone: e.tone, label: '' }];
    const slack = weight === null ? null : slackOf(weight, a.distance, b.distance, lift.directed);
    // A string to a tentative node holds it up at its current estimate; it may still change.
    const kind = slack === null ? 'flat' : a.tentative || b.tentative ? 'tentative' : slack === 0 ? 'taut' : 'slack';
    const label = kind === 'slack' ? `${fmt(weight)} · slack ${fmt(slack)}` : kind === 'taut' || (kind === 'tentative' && slack === 0) ? fmt(weight) : kind === 'tentative' ? `${fmt(weight)} · slack ${fmt(slack)}` : '';
    return [{ id: e.id, from: a.id, to: b.id, weight, slack, kind, tone: e.tone, label }];
  });
  // The sheet hinges on its bottom edge, so the graph's base stays on the slide.
  const sheet = {
    ...toWorld({ x: region.x + region.width / 2, y: region.y + region.height / 2 }, frame),
    width: regionPx.width,
    height: regionPx.height,
  };
  const hinge = { x: sheet.x, y: sheet.y - sheet.height / 2 };
  return { nodes, edges, sheet, hinge, region, radius: r, scale, base, tallest, unit: lift.unit, source: lift.source };
}

/** Vertical drop of a slack string's midpoint, proportional to its slack, bounded so a very
 * long connection does not fall through the sheet. */
export function sagDepth(slack, scale, tallest) {
  if (!slack) return 0;
  return Math.min(tallest * 0.55, slack * scale * 0.6);
}

/** Points along a string from a to b (each {x, y, z}) sagging by `sag` at its middle. */
export function stringPoints(a, b, sag, segments = 24) {
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t - sag * 4 * t * (1 - t),
    });
  }
  return out;
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** Rise progress of one node during the lift: nodes leave the sheet in order of distance. */
export function riseAt(t, rank, count) {
  const start = 0.32 + (count > 1 ? (rank / (count - 1)) * 0.38 : 0);
  return easeOutBack(clamp01((t - start) / 0.3));
}

/** Moves a value toward its target, frame-rate independent. */
export const approach = (value, target, dt, tau = 0.22) => target + (value - target) * Math.exp(-dt / tau);

/** Nudges overlapping labels apart, keeping the most important in place. Each item is
 * {x, y, w, h, priority} with (x, y) the bottom centre; returns new y values. */
export function separateLabels(items, gap = 3) {
  const order = items.map((item, i) => ({ ...item, i })).sort((a, b) => b.priority - a.priority);
  const placed = [], ys = items.map((item) => item.y);
  const hits = (a, y, b) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && y - a.h < b.y + gap && b.y - b.h < y + gap;
  for (const item of order) {
    let y = item.y;
    for (let k = 1; k <= 8 && placed.some((p) => hits(item, y, p)); k++)
      y = item.y + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (item.h + gap);
    ys[item.i] = y;
    placed.push({ ...item, y });
  }
  return ys;
}
