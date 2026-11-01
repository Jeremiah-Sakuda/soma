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

// Distances arrive rounded to two places, so smaller differences are rounding, not slack.
const TOLERANCE = 0.011;
/** How much longer a connection is than the climb between its ends: 0 means taut. Negative
 * only next to an estimate: the connection offers a shorter way and will lower it. */
export function slackOf(weight, fromDistance, toDistance, directed) {
  if (!Number.isFinite(weight) || fromDistance === null || toDistance === null) return null;
  const climb = directed ? toDistance - fromDistance : Math.abs(toDistance - fromDistance);
  const slack = weight - climb;
  return Math.abs(slack) < TOLERANCE ? 0 : Number(slack.toFixed(4));
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
  // The highest distance in the whole search rises about four fifths of the graph's own
  // height, so a difference of one is plainly visible as height.
  const tallest = Math.max(r * 6, Math.min(frame.height * 0.42, Math.max(regionPx.height, regionPx.width * 0.5) * 0.8));
  const scale = tallest / lift.maxDistance;
  // A node at distance 0 rests on the sheet; height above that is distance.
  const base = r * 0.78;
  const byId = new Map();
  const nodes = model.nodes.map((n) => {
    const known = n.distance !== null && n.status !== 'unreached';
    const node = {
      id: n.id,
      label: n.label,
      status: n.status,
      distance: known ? n.distance : null,
      // The start is known exactly from the outset, and breadth-first distances are final
      // when found; only Dijkstra's queued costs are estimates.
      tentative: n.status === 'waiting' && lift.unit === 'cost' && !(n.id === lift.source && n.distance === 0),
      ...toWorld(n, frame),
      // Within the search's own range, so a bad value cannot fly off screen.
      height: known ? base + Math.max(0, Math.min(lift.maxDistance, n.distance)) * scale : 0,
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
    // Between two estimates nothing is settled yet, so it stays drawn on the sheet.
    const kind =
      slack === null || (a.tentative && b.tentative)
        ? 'flat'
        : slack < 0
          ? 'pull'
          : a.tentative || b.tentative
            ? 'tentative'
            : slack === 0
              ? 'taut'
              : 'slack';
    // A shorter way to an estimate: the node it reaches will come down.
    const lower = kind === 'pull' ? (a.tentative ? a : b) : null;
    const label =
      kind === 'slack'
        ? `${fmt(weight)} · slack ${fmt(slack)}`
        : kind === 'pull'
          ? `${fmt(weight)} · lowers ${lower.label} by ${fmt(-slack)}`
          : kind === 'taut' || kind === 'tentative'
            ? fmt(weight)
            : '';
    return [{ id: e.id, from: a.id, to: b.id, weight, slack, kind, tone: e.tone, label, directed: lift.directed }];
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

/** Vertical drop of a slack string's midpoint, proportional to its slack (at least `least`
 * so a small slack still shows), bounded so a very long connection stays near its ends. */
export function sagDepth(slack, scale, tallest, least = 0) {
  if (!slack) return 0;
  return Math.min(tallest * 0.7, Math.max(least, slack * scale * 0.9));
}

/** Points along a string from a to b (each {x, y, z}) sagging by `sag` at its middle. A
 * string that would sag through the sheet rests on it instead (never below `floor`). */
export function stringPoints(a, b, sag, segments = 24, floor = -Infinity) {
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: Math.max(Math.min(floor, a.z, b.z), a.z + (b.z - a.z) * t - sag * 4 * t * (1 - t)),
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
