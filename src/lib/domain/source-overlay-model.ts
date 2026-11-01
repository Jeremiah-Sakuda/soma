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
  }[];
  weights: { edgeId: string; x: number; y: number; text: string }[];
  /** Small tags with leader lines, in the reference style. Text is computed from the trace. */
  tags: { id: string; text: string; tone: OverlayTagTone; x: number; y: number; anchor: Point; curved: boolean }[];
  /** Kept for compatibility; the overlay no longer outlines source regions. */
  callouts: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  caption: { text: string; stepLabel: string; x: number; y: number; anchor: 'top' | 'bottom'; font: number } | null;
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
  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const weightOf = (a: string, b: string) => input.edges.find((e) => pairKey(e.from, e.to) === pairKey(a, b))?.weight ?? 1;

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
  const treeEdges = new Set<string>();
  for (const [node, parent] of Object.entries(step.parents)) if (parent) treeEdges.add(pairKey(parent, node));
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
      label && Math.hypot(label.x - mid.x, label.y - mid.y) > length * 0.25 ? { x: 2 * label.x - mid.x, y: 2 * label.y - mid.y } : mid;
    const trim = (p: Point, toward: Point) => {
      const d = Math.hypot(toward.x - p.x, toward.y - p.y) || 1;
      return { x: p.x + ((toward.x - p.x) / d) * r * 1.1, y: p.y + ((toward.y - p.y) / d) * r * 1.1 };
    };
    const cut = disabledEdgeIds.includes(edge.id),
      key = pairKey(edge.from, edge.to),
      centre = { x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y };
    edgeCentre.set(key, centre);
    edges.push({
      id: edge.id,
      label: `${cut ? 'Restore' : 'Cut'} connection ${name(edge.from)}–${name(edge.to)}, cost ${edge.weight ?? 1}`,
      from: norm(trim(a, control)),
      control: norm(control),
      to: norm(trim(b, control)),
      center: norm(centre),
      tone: cut
        ? 'cut'
        : pathEdges.has(key)
          ? 'path'
          : struck.has(key)
            ? 'struck'
            : relaxed.has(key)
              ? 'relaxed'
              : treeEdges.has(key)
                ? 'tree'
                : 'idle',
    });
  }
  const weightLabels: SourceOverlayModel['weights'] = graph.edges.flatMap((edge) => {
    const value = weights?.[edge.id],
      spot = layout.edgeLabels.find((l) => l.edgeId === edge.id);
    return value === undefined || value === (edge.weight ?? 1) || !spot
      ? []
      : [{ edgeId: edge.id, x: spot.x, y: spot.y, text: `${edge.weight ?? 1} → ${value}` }];
  });
  const modelNodes: SourceOverlayModel['nodes'] = input.nodes.flatMap((node) => {
    const p = layout.nodes.find((n) => n.nodeId === node.id);
    if (!p) return [];
    const status: OverlayStatus =
      step.current === node.id ? 'current' : step.expanded.includes(node.id) ? 'settled' : step.queue.includes(node.id) ? 'waiting' : 'unreached';
    return [{ id: node.id, label: node.label, x: p.x, y: p.y, status, distance: step.distances[node.id] ?? null }];
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
  const hits = (b: Box) =>
    blocked.some((o) => Math.abs(o.x - b.x) < (o.w + b.w) / 2 + 3 && Math.abs(o.y - b.y) < (o.h + b.h) / 2 + 2);
  const inside = (b: Box) => b.x - b.w / 2 >= 2 && b.x + b.w / 2 <= W - 2 && b.y - b.h / 2 >= 2 && b.y + b.h / 2 <= H - 2;
  const tags: SourceOverlayModel['tags'] = [];
  const place = (id: string, label: string, tone: OverlayTagTone, anchor: Point, curved: boolean) => {
    const text = label.length > 60 ? `${label.slice(0, 59)}…` : label;
    const { w, h } = tagBox(text, font);
    const base = Math.atan2(anchor.y - centre.y, anchor.x - centre.x || 0.001);
    const candidates: Point[] = [];
    for (const distance of [r * 2.2 + h / 2, r * 3.1 + h / 2, r * 4.3 + h / 2])
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const angle = base + turn;
        candidates.push({ x: anchor.x + Math.cos(angle) * (distance + w * 0.3 * Math.abs(Math.cos(angle))), y: anchor.y + Math.sin(angle) * distance });
      }
    const spot = candidates.find((c) => inside({ ...c, w, h }) && !hits({ ...c, w, h })) ?? candidates.find((c) => inside({ ...c, w, h })) ?? candidates[0];
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
  };

  // The relaxation equation first, so it gets the clearest spot beside its edge.
  for (const x of relaxations) {
    const anchor = edgeCentre.get(pairKey(x.parent, x.node));
    if (!anchor) continue;
    const w = weightOf(x.parent, x.node);
    place(`equation-${x.node}`, `${x.value - w} + ${w} = ${x.value} < ${x.old}`, 'equation', anchor, true);
  }
  step.expanded.forEach((id, k) => {
    const p = nodes.get(id);
    if (p) place(`settled-${id}`, `${CIRCLED[k] ?? k + 1} ${name(id)} = ${step.distances[id]}`, id === step.current ? 'current' : 'settled', p, false);
  });
  if (!finished)
    for (const id of step.queue) {
      const p = nodes.get(id);
      if (p && !step.expanded.includes(id) && step.distances[id] !== undefined)
        place(`tentative-${id}`, `${name(id)} ≤ ${step.distances[id]}`, 'tentative', p, false);
    }
  if (finished && execution.path && execution.path.length > 1) {
    const goal = nodes.get(execution.path.at(-1)!);
    const cost = execution.path.slice(1).reduce((sum, to, i) => sum + weightOf(execution.path![i], to), 0);
    if (goal) place('route', `${execution.path.map(name).join(' → ')} = ${cost}`, 'route', goal, true);
  }

  // The caption sits below everything drawn and printed near the graph, or above it.
  const bottom = Math.max(...blocked.map((b) => b.y + b.h / 2)),
    top = Math.min(...blocked.map((b) => b.y - b.h / 2));
  const left = Math.max(0.01, (Math.min(...points.map((p) => p.x)) - r * 2) / W);
  const underneath = H - bottom > font * 5 || H - bottom > top;
  return {
    radius: r / W,
    font: font / W,
    nodes: modelNodes,
    edges,
    weights: weightLabels,
    tags: tags.slice(0, 12),
    callouts: [],
    caption: caption
      ? (caption = caption.length > 380 ? `${caption.slice(0, 379)}…` : caption, underneath)
        ? { text: caption, stepLabel, x: left, y: Math.min(0.98, (bottom + font * 0.8) / H), anchor: 'top', font: font / W }
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
