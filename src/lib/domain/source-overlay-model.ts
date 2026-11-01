import type { BfsExecution, BfsInput } from './graph-search';

export type SourceGraphLayout = {
  nodes: { nodeId: string; x: number; y: number }[];
  edgeLabels: { edgeId: string; x: number; y: number }[];
};
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Region = { x: number; y: number; width: number; height: number };
export type OverlayStatus = 'current' | 'settled' | 'waiting' | 'unreached';
/** relaxed: improved at this step; struck: the route it beat. */
export type OverlayTone = 'path' | 'relaxed' | 'tree' | 'struck' | 'cut' | 'idle';
export type OverlayTagTone = 'settled' | 'current' | 'tentative' | 'equation' | 'route';
/** Normalized to the captured image (0–1 on each axis), so the same model can be drawn
 * over an in-page copy of the capture or over the real display it came from. */
export type SourceOverlayModel = {
  /** The completed search: draw only the result. */
  final: boolean;
  radius: number;
  /** Tag font size as a fraction of the capture width. */
  font: number;
  nodes: { id: string; label: string; x: number; y: number; status: OverlayStatus; distance: number | null }[];
  edges: {
    id: string;
    label: string;
    from: Point;
    control: Point;
    to: Point;
    center: Point;
    tone: OverlayTone;
    /** Where a struck edge's slash goes: on the line, clear of printed labels. */
    strike?: Point;
    /** For the 3D lift: the endpoints and the cost the search used (1 per edge for BFS). */
    fromId?: string;
    toId?: string;
    weight?: number;
  }[];
  weights: { edgeId: string; x: number; y: number; text: string }[];
  /** Small tags with leader lines, in the reference style. Text is computed from the trace. */
  tags: { id: string; text: string; tone: OverlayTagTone; x: number; y: number; anchor: Point; curved: boolean; quiet?: boolean }[];
  /** Kept for compatibility; the overlay no longer outlines source regions. */
  callouts: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  caption: { text: string; stepLabel: string; x: number; y: number; anchor: 'top' | 'bottom'; font: number } | null;
  /** Scale for the 3D lift: heights are checked distances, so they need the run's largest
   * value, including tentative estimates. */
  lift?: { directed: boolean; source: string; goal: string | null; maxDistance: number; unit: 'cost' | 'edges' };
};

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
/** Estimated tag box; renderers measure the real text and only widen. */
export const tagBox = (text: string, font: number) => ({ w: text.length * font * 0.56 + font * 1.1, h: font * 1.65 });

/** Presentation only: every mark, number and sentence comes from the supplied execution. */
export function sourceOverlayModel({
  layout,
  graph,
  execution,
  index,
  disabledEdgeIds,
  weights,
  caption,
  stepLabel,
  aspect,
  obstacles = [],
}: {
  layout: SourceGraphLayout;
  /** The full interpreted graph, including connections the learner has cut. */
  graph: BfsInput;
  execution: BfsExecution;
  index: number;
  disabledEdgeIds: readonly string[];
  weights?: Record<string, number>;
  caption: string | null;
  stepLabel: string;
  /** Capture height / width; geometry is computed in uniform pixels, then normalized. */
  aspect: number;
  /** Source text regions (title, lists, results) that annotations should not cover. */
  obstacles?: Region[];
  callouts?: unknown;
}): SourceOverlayModel {
  const W = 1000,
    H = W * aspect;
  const px = (p: Point): Point => ({ x: p.x * W, y: p.y * H });
  const norm = (p: Point): Point => ({ x: p.x / W, y: p.y / H });
  const nodes = new Map(layout.nodes.map((n) => [n.nodeId, px(n)]));
  const labels = new Map(layout.edgeLabels.map((l) => [l.edgeId, px(l)]));
  const at = Math.min(index, execution.steps.length - 1),
    step = execution.steps[at],
    finished = index >= execution.steps.length - 1;
  const input = execution.input;
  const pairKey = (a: string, b: string) => (input.directed ? `${a}>${b}` : [a, b].sort().join('|'));
  const fullName = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  // Tags shorten names, never numbers.
  const name = (id: string) => {
    const label = fullName(id);
    return label.length > 14 ? `${label.slice(0, 13)}…` : label;
  };
  const fmt = (n: number, places = 2) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(places))));
  // An equation must still add up after rounding.
  const sum = (a: number, b: number, total: number) => {
    for (const places of [2, 3, 4]) {
      const [x, y, z] = [a, b, total].map((n) => Number(fmt(n, places)));
      if (Number(fmt(x + y, places)) === z) return [a, b, total].map((n) => fmt(n, places));
    }
    return [a, b, total].map((n) => fmt(n, 4));
  };
  const dijkstra = execution.modelId === 'dijkstra-nonnegative';
  // Cut connections are absent from the executed input; their printed cost comes from the graph.
  const weightOf = (a: string, b: string) =>
    (input.edges.find((e) => pairKey(e.from, e.to) === pairKey(a, b)) ?? graph.edges.find((e) => pairKey(e.from, e.to) === pairKey(a, b)))?.weight ?? 1;

  // The moment that explains Dijkstra: a known distance plus one edge beats the old estimate.
  // At the end, replay the relaxation that gave the goal its final cost.
  type Relaxation = { node: string; parent: string; old: number; value: number; oldParent: string | null };
  const relaxationsAt = (k: number): Relaxation[] => {
    if (k <= 0) return [];
    const s = execution.steps[k],
      p = execution.steps[k - 1];
    return Object.entries(s.distances).flatMap(([node, value]) => {
      const old = p.distances[node],
        parent = s.parents[node];
      return old !== undefined && value < old && parent ? [{ node, parent, old, value, oldParent: p.parents[node] ?? null }] : [];
    });
  };
  let relaxations = relaxationsAt(at);
  if (finished && execution.path && execution.path.length > 1) {
    const goal = execution.path.at(-1)!;
    relaxations = [];
    for (let k = execution.steps.length - 1; k > 0; k--) {
      const found = relaxationsAt(k).find((x) => x.node === goal);
      if (found) {
        relaxations = [found];
        break;
      }
    }
  }
  const pathEdges = new Set<string>();
  if (finished && execution.path)
    for (let i = 1; i < execution.path.length; i++) pathEdges.add(pairKey(execution.path[i - 1], execution.path[i]));
  const relaxed = new Set(relaxations.map((x) => pairKey(x.parent, x.node)));
  const struck = new Set(
    relaxations.filter((x) => x.oldParent && x.oldParent !== x.parent).map((x) => pairKey(x.oldParent!, x.node)),
  );

  const points = [...nodes.values()];
  const minGap = Math.min(...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
  // Hug the source's own node circles, which slides draw at roughly a fifth of the spacing.
  const r = Math.max(9, Math.min(30, minGap * 0.2));
  // Annotation type sits a little smaller than the source's own labels.
  const font = Math.max(7, Math.min(15, r * 0.72));

  const edges: SourceOverlayModel['edges'] = [];
  const edgeCentre = new Map<string, Point>();
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    if (!a || !b) continue;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      label = labels.get(edge.id),
      length = Math.hypot(b.x - a.x, b.y - a.y);
    // A printed label far from the straight midpoint means the source drew an arc.
    const control =
      label && Math.hypot(label.x - mid.x, label.y - mid.y) > Math.max(length * 0.2, r * 3)
        ? { x: 2 * label.x - mid.x, y: 2 * label.y - mid.y }
        : mid;
    const trim = (p: Point, toward: Point) => {
      const d = Math.hypot(toward.x - p.x, toward.y - p.y) || 1;
      return { x: p.x + ((toward.x - p.x) / d) * r * 1.1, y: p.y + ((toward.y - p.y) / d) * r * 1.1 };
    };
    const cut = disabledEdgeIds.includes(edge.id),
      key = pairKey(edge.from, edge.to),
      centre = { x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y };
    edgeCentre.set(key, centre);
    let strike: Point | undefined;
    if (struck.has(key) && !cut) {
      const along = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y });
      const clearOf = (p: Point) => [...labels.values()].every((l) => Math.hypot(l.x - p.x, l.y - p.y) > Math.max(r * 1.6, 18));
      strike = norm([0.32, 0.4, 0.25, 0.6, 0.68, 0.5].map(along).find(clearOf) ?? along(0.32));
    }
    edges.push({
      id: edge.id,
      label: `${cut ? 'Restore' : 'Cut'} connection ${name(edge.from)}–${name(edge.to)}, cost ${fmt(weightOf(edge.from, edge.to))}`,
      from: norm(trim(a, control)),
      control: norm(control),
      to: norm(trim(b, control)),
      center: norm(centre),
      ...(strike ? { strike } : {}),
      fromId: edge.from,
      toId: edge.to,
      weight: Number(fmt(dijkstra ? weightOf(edge.from, edge.to) : 1, 4)),
      tone: cut
        ? 'cut'
        : pathEdges.has(key)
          ? 'path'
          : struck.has(key)
            ? 'struck'
            : relaxed.has(key) && !finished
              ? 'relaxed'
              : 'idle',
    });
  }
  const weightLabels: SourceOverlayModel['weights'] = graph.edges.flatMap((edge) => {
    const value = weights?.[edge.id],
      spot = layout.edgeLabels.find((l) => l.edgeId === edge.id);
    return value === undefined || value === (edge.weight ?? 1) || !spot
      ? []
      : [{ edgeId: edge.id, x: spot.x, y: spot.y, text: `${fmt(edge.weight ?? 1)} → ${fmt(value)}`.slice(0, 24) }];
  });
  const modelNodes: SourceOverlayModel['nodes'] = input.nodes.flatMap((node) => {
    const p = layout.nodes.find((n) => n.nodeId === node.id);
    if (!p) return [];
    const status: OverlayStatus =
      step.current === node.id ? 'current' : step.expanded.includes(node.id) ? 'settled' : step.queue.includes(node.id) ? 'waiting' : 'unreached';
    const distance = step.distances[node.id];
    return [{ id: node.id, label: node.label, x: p.x, y: p.y, status, distance: distance === undefined ? null : Number(fmt(distance)) }];
  });

  // Annotations avoid the source's own marks: nodes, printed weights and text regions.
  const blocked: Box[] = [
    ...points.map((p) => ({ x: p.x, y: p.y, w: r * 2.5, h: r * 2.5 })),
    ...[...labels.values()].map((p) => ({ x: p.x, y: p.y, w: font * 2.4, h: font * 1.8 })),
    ...obstacles
      .filter((o) => !points.some((p) => p.x >= o.x * W && p.x <= (o.x + o.width) * W && p.y >= o.y * H && p.y <= (o.y + o.height) * H))
      .map((o) => ({ x: (o.x + o.width / 2) * W, y: (o.y + o.height / 2) * H, w: o.width * W, h: o.height * H })),
  ];
  const centre = { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
  const overlap = (b: Box) =>
    blocked.reduce((sum, o) => {
      const ox = Math.min(o.x + o.w / 2, b.x + b.w / 2 + 3) - Math.max(o.x - o.w / 2, b.x - b.w / 2 - 3),
        oy = Math.min(o.y + o.h / 2, b.y + b.h / 2 + 2) - Math.max(o.y - o.h / 2, b.y - b.h / 2 - 2);
      return ox > 0 && oy > 0 ? sum + ox * oy : sum;
    }, 0);
  const inside = (b: Box) => b.x - b.w / 2 >= 2 && b.x + b.w / 2 <= W - 2 && b.y - b.h / 2 >= 2 && b.y + b.h / 2 <= H - 2;
  const tags: SourceOverlayModel['tags'] = [];
  const place = (id: string, label: string, tone: OverlayTagTone, anchor: Point, curved: boolean, optional = false) => {
    const text = label.length > 60 ? `${label.slice(0, 59)}…` : label;
    const { w, h } = tagBox(text, font);
    const base = Math.atan2(anchor.y - centre.y, anchor.x - centre.x || 0.001);
    const candidates: Point[] = [];
    for (const distance of [r * 2.2 + h / 2, r * 3.1 + h / 2, r * 4.3 + h / 2, r * 6 + h / 2])
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const angle = base + turn;
        candidates.push({ x: anchor.x + Math.cos(angle) * (distance + w * 0.3 * Math.abs(Math.cos(angle))), y: anchor.y + Math.sin(angle) * distance });
      }
    // The first clear spot, else the one that covers the least of the source.
    const fits = candidates.filter((c) => inside({ ...c, w, h }));
    const clear = fits.find((c) => overlap({ ...c, w, h }) === 0);
    if (!clear && optional) return false;
    const spot =
      clear ??
      fits.reduce<Point | null>((best, c) => (!best || overlap({ ...c, w, h }) < overlap({ ...best, w, h }) ? c : best), null) ??
      candidates[0];
    blocked.push({ ...spot, w, h });
    tags.push({
      id,
      text,
      tone,
      x: Math.min(1, Math.max(0, spot.x / W)),
      y: Math.min(1, Math.max(0, spot.y / H)),
      anchor: { x: anchor.x / W, y: anchor.y / H },
      curved,
    });
    return true;
  };

  // The relaxation equation first, so it gets the clearest spot beside its edge.
  for (const x of relaxations) {
    const anchor = nodes.get(x.node);
    if (!anchor || !edgeCentre.has(pairKey(x.parent, x.node))) continue;
    const w = weightOf(x.parent, x.node),
      from = execution.steps.find((s2) => s2.parents[x.node] === x.parent && s2.distances[x.node] === x.value)?.distances[x.parent] ?? x.value - w;
    const [fa, fw, fv] = sum(from, w, x.value);
    place(`equation-${x.node}`, `${fa} + ${fw} = ${fv} < ${fmt(x.old)}`, 'equation', anchor, true);
  }
  // The route and the goal's own tag claim their places first on the final frame.
  let routeLine: string | null = null;
  const goalId = finished && execution.path && execution.path.length > 1 ? execution.path.at(-1)! : null;
  if (goalId) {
    const goal = nodes.get(goalId);
    const unit = dijkstra ? '' : execution.path!.length - 1 === 1 ? ' edge' : ' edges';
    const total = dijkstra ? step.distances[goalId] ?? execution.path!.slice(1).reduce((sum, to, i) => sum + weightOf(execution.path![i], to), 0) : execution.path!.length - 1;
    const tail = ` = ${fmt(total)}${unit}`;
    // Shrink names, never the total; a route that still will not fit leads the caption.
    let text = `${execution.path!.map(name).join(' → ')}${tail}`;
    for (let limit = 10; text.length > 60 && limit >= 2; limit -= 2)
      text = `${execution.path!.map((id) => (fullName(id).length > limit ? `${fullName(id).slice(0, limit - 1)}…` : fullName(id))).join(' → ')}${tail}`;
    if (text.length > 60 || !goal || !place('route', text, 'route', goal, true, true)) routeLine = `${execution.path!.map(fullName).join(' → ')}${tail}`;
  }
  const order = goalId ? [goalId, ...step.expanded.filter((id) => id !== goalId)] : step.expanded;
  for (const id of order) {
    const p = nodes.get(id),
      k = step.expanded.indexOf(id);
    if (p && k >= 0 && tags.length < 12)
      place(`settled-${id}`, `${CIRCLED[k] ?? k + 1} ${name(id)} = ${fmt(step.distances[id])}`, id === step.current ? 'current' : 'settled', p, false);
    else if (p && id === goalId && step.distances[id] !== undefined && tags.length < 12)
      place(`settled-${id}`, `${name(id)} = ${fmt(step.distances[id])}`, 'current', p, false);
  }
  if (!finished) {
    const before = at > 0 ? execution.steps[at - 1] : null;
    for (const id of step.queue) {
      const p = nodes.get(id);
      if (p && tags.length < 12 && !step.expanded.includes(id) && step.distances[id] !== undefined && !relaxations.some((x) => x.node === id)) {
        place(`tentative-${id}`, `${name(id)} ≤ ${fmt(step.distances[id])}`, 'tentative', p, false);
        if (before && before.distances[id] === step.distances[id]) tags[tags.length - 1].quiet = true;
      }
    }
  }
  if (routeLine && caption && !caption.includes(routeLine)) caption = `${routeLine}. ${caption}`;

  // The caption sits below everything drawn and printed near the graph, or above it.
  const bottom = Math.max(...blocked.map((b) => b.y + b.h / 2)),
    top = Math.min(...blocked.map((b) => b.y - b.h / 2));
  const left = Math.max(0.01, (Math.min(...points.map((p) => p.x)) - r * 2) / W);
  const underneath = H - bottom > font * 5 || H - bottom > top;
  // Tentative estimates can exceed final distances (F ≤ 11 before it settles at 7).
  const allDistances = execution.steps.flatMap((x) => Object.values(x.distances)).filter(Number.isFinite);
  return {
    final: finished,
    lift: {
      directed: Boolean(input.directed),
      source: input.start,
      goal: input.goal ?? null,
      maxDistance: Math.max(1, ...allDistances),
      unit: dijkstra ? 'cost' : 'edges',
    },
    radius: r / W,
    font: font / W,
    nodes: modelNodes,
    edges,
    weights: weightLabels,
    tags: tags.slice(0, 12),
    callouts: [],
    caption: caption
      ? (caption = caption.length > 380 ? `${caption.slice(0, 379)}…` : caption, underneath)
        ? { text: caption, stepLabel, x: left, y: Math.min(0.86, (bottom + font * 0.8) / H), anchor: 'top', font: font / W }
        : { text: caption, stepLabel, x: left, y: Math.max(0.02, (top - font * 0.8) / H), anchor: 'bottom', font: font / W }
      : null,
  };
}

/** A hand-drawn loop around a point, deterministic per id so redraws don't jitter. */
export function loopPath(x: number, y: number, r: number, id: string): string {
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const start = (seed % 360) * (Math.PI / 180),
    parts: string[] = [];
  for (let k = 0; k <= 26; k++) {
    const t = start + (k / 24) * Math.PI * 2,
      wobble = Math.sin(t * 3 + seed) * r * 0.05 + (k > 24 ? (k - 24) * r * 0.04 : 0),
      rr = r + wobble;
    parts.push(`${k ? 'L' : 'M'}${(x + Math.cos(t) * rr).toFixed(1)} ${(y + Math.sin(t) * rr * 0.94).toFixed(1)}`);
  }
  return parts.join(' ');
}
