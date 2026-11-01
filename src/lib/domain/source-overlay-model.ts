import type { BfsExecution, BfsInput } from './graph-search';

export type SourceGraphLayout = {
  nodes: { nodeId: string; x: number; y: number }[];
  edgeLabels: { edgeId: string; x: number; y: number }[];
};
type Point = { x: number; y: number };
export type OverlayStatus = 'current' | 'settled' | 'waiting' | 'unreached';
export type OverlayTone = 'path' | 'tree' | 'cut' | 'idle';
/** Normalized to the captured image (0–1 on each axis), so the same model can be drawn
 * over an in-page copy of the capture or over the real display it came from. */
export type SourceOverlayModel = {
  radius: number;
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
  /** Source regions Muse tied to the visible step, outlined in place with their labels. */
  callouts: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  caption: { text: string; stepLabel: string; x: number; y: number; anchor: 'top' | 'bottom' } | null;
};

/** Presentation only: every ring, distance and route comes from the supplied execution. */
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
  callouts = [],
}: {
  callouts?: { id: string; label: string; region: { x: number; y: number; width: number; height: number } }[];
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
}): SourceOverlayModel {
  const W = 1000,
    H = W * aspect;
  const px = (p: Point): Point => ({ x: p.x * W, y: p.y * H });
  const norm = (p: Point): Point => ({ x: p.x / W, y: p.y / H });
  const nodes = new Map(layout.nodes.map((n) => [n.nodeId, px(n)]));
  const labels = new Map(layout.edgeLabels.map((l) => [l.edgeId, px(l)]));
  const step = execution.steps[Math.min(index, execution.steps.length - 1)];
  const finished = index >= execution.steps.length - 1;
  const input = execution.input;
  const pairKey = (a: string, b: string) => (input.directed ? `${a}>${b}` : [a, b].sort().join('|'));
  const pathEdges = new Set<string>();
  if (finished && execution.path)
    for (let i = 1; i < execution.path.length; i++)
      pathEdges.add(pairKey(execution.path[i - 1], execution.path[i]));
  const treeEdges = new Set<string>();
  for (const [node, parent] of Object.entries(step.parents)) if (parent) treeEdges.add(pairKey(parent, node));
  const points = [...nodes.values()];
  const minGap = Math.min(
    ...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
  );
  const r = Math.max(14, Math.min(34, minGap * 0.3));
  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  const edges: SourceOverlayModel['edges'] = [];
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    if (!a || !b) continue;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      label = labels.get(edge.id),
      length = Math.hypot(b.x - a.x, b.y - a.y);
    // A printed label far from the straight midpoint means the source drew an arc.
    const control =
      label && Math.hypot(label.x - mid.x, label.y - mid.y) > length * 0.25
        ? { x: 2 * label.x - mid.x, y: 2 * label.y - mid.y }
        : mid;
    const trim = (p: Point, toward: Point) => {
      const d = Math.hypot(toward.x - p.x, toward.y - p.y) || 1;
      return { x: p.x + ((toward.x - p.x) / d) * r, y: p.y + ((toward.y - p.y) / d) * r };
    };
    const cut = disabledEdgeIds.includes(edge.id),
      key = pairKey(edge.from, edge.to);
    edges.push({
      id: edge.id,
      label: `${cut ? 'Restore' : 'Cut'} connection ${name(edge.from)}–${name(edge.to)}, cost ${edge.weight ?? 1}`,
      from: norm(trim(a, control)),
      control: norm(control),
      to: norm(trim(b, control)),
      center: norm({ x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y }),
      tone: cut ? 'cut' : pathEdges.has(key) ? 'path' : treeEdges.has(key) ? 'tree' : 'idle',
    });
  }
  const weightLabels: SourceOverlayModel['weights'] = graph.edges.flatMap((edge) => {
    const value = weights?.[edge.id],
      at = layout.edgeLabels.find((l) => l.edgeId === edge.id);
    return value === undefined || value === (edge.weight ?? 1) || !at
      ? []
      : [{ edgeId: edge.id, x: at.x, y: at.y, text: `${edge.weight ?? 1} → ${value}` }];
  });
  const modelNodes: SourceOverlayModel['nodes'] = input.nodes.flatMap((node) => {
    const p = layout.nodes.find((n) => n.nodeId === node.id);
    if (!p) return [];
    const status: OverlayStatus =
      step.current === node.id
        ? 'current'
        : step.expanded.includes(node.id)
          ? 'settled'
          : step.queue.includes(node.id)
            ? 'waiting'
            : 'unreached';
    return [{ id: node.id, label: node.label, x: p.x, y: p.y, status, distance: step.distances[node.id] ?? null }];
  });
  // Slides keep titles at the top, so prefer the space under the graph when there is room.
  const ys = points.map((p) => p.y),
    xs = points.map((p) => p.x);
  const below = H - Math.max(...ys) - r * 1.6;
  const underneath = below > H * 0.14 || below > Math.min(...ys) - r * 1.6;
  const left = Math.max(0.02, (Math.min(...xs) - r) / W);
  return {
    radius: r / W,
    nodes: modelNodes,
    edges,
    weights: weightLabels,
    callouts: callouts.slice(0, 6).map((c) => ({ id: c.id, label: c.label.slice(0, 100), ...c.region })),
    caption: caption
      ? underneath
        ? { text: caption, stepLabel, x: left, y: (Math.max(...ys) + r * 1.6) / H, anchor: 'top' }
        : { text: caption, stepLabel, x: left, y: (Math.min(...ys) - r * 1.6) / H, anchor: 'bottom' }
      : null,
  };
}
