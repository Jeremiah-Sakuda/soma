import type { BfsExecution, BfsInput } from './graph-search';

export type SourceGraphLayout = {
  nodes: { nodeId: string; x: number; y: number }[];
  edgeLabels: { edgeId: string; x: number; y: number }[];
};
type Point = { x: number; y: number };
export type OverlayStatus = 'current' | 'settled' | 'waiting' | 'unreached';
export type OverlayTone = 'path' | 'tree' | 'cut' | 'idle';
export type OverlayTagTone = 'settled' | 'current' | 'change' | 'route' | 'warn';
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
  /** Pastel tags with leader lines, in the reference style. Text is computed from the trace:
   * settle order and distances, cost improvements at this step, and the final route. */
  tags: { id: string; text: string; tone: OverlayTagTone; x: number; y: number; anchor: Point; curved: boolean }[];
  /** Source regions Muse tied to the visible step, outlined in place with their labels. */
  callouts: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  caption: { text: string; stepLabel: string; x: number; y: number; anchor: 'top' | 'bottom'; font: number } | null;
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
  // Hug the source's own node circles, which slides draw at roughly a fifth of the spacing.
  const r = Math.max(9, Math.min(30, minGap * 0.2));
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
  // Annotation type follows the source's own scale, so a half-screen slide gets small tags.
  const font = Math.max(8, Math.min(TAG_FONT, r * 0.9));
  const tags = overlayTags({ graph, execution, index, nodes, labels, r, W, H, pathEdges, name, font });
  // Slides keep titles at the top, so prefer the space under the graph when there is room.
  const ys = points.map((p) => p.y),
    xs = points.map((p) => p.x);
  const tagBottom = Math.max(...ys, ...tags.map((t) => t.y * H + (font + 14) / 2));
  const tagTop = Math.min(...ys, ...tags.map((t) => t.y * H - (font + 14) / 2));
  const below = H - tagBottom - r;
  const underneath = below > H * 0.1 || below > tagTop - r;
  const left = Math.max(0.02, (Math.min(...xs) - r) / W);
  return {
    radius: r / W,
    font: font / W,
    nodes: modelNodes,
    edges,
    weights: weightLabels,
    tags,
    // Rings and labels already mark nodes and weights; callouts point at the surrounding text
    // (pseudocode, stated results) and never cover a node or a printed weight.
    callouts: callouts
      .filter((c) => {
        const box = { x: c.region.x * W - r, y: c.region.y * H - r, w: c.region.width * W + 2 * r, h: c.region.height * H + 2 * r };
        const inside = (p: Point) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
        return ![...nodes.values(), ...labels.values()].some(inside);
      })
      .slice(0, 6)
      .map((c) => ({ id: c.id, label: c.label.slice(0, 100), ...c.region })),
    caption: caption
      ? underneath
        ? { text: caption, stepLabel, x: left, y: (tagBottom + r * 0.8) / H, anchor: 'top', font: font / W }
        : { text: caption, stepLabel, x: left, y: (tagTop - r * 0.8) / H, anchor: 'bottom', font: font / W }
      : null,
  };
}

const TAG_FONT = 17;
const tagSize = (text: string, font: number) => ({ w: text.length * font * 0.52 + font * 1.3, h: font * 1.8 });

function overlayTags({
  graph,
  execution,
  index,
  nodes,
  labels,
  r,
  W,
  H,
  pathEdges,
  name,
  font,
}: {
  font: number;
  graph: BfsInput;
  execution: BfsExecution;
  index: number;
  nodes: Map<string, Point>;
  labels: Map<string, Point>;
  r: number;
  W: number;
  H: number;
  pathEdges: Set<string>;
  name: (id: string) => string;
}): SourceOverlayModel['tags'] {
  const at = Math.min(index, execution.steps.length - 1),
    step = execution.steps[at],
    before = at > 0 ? execution.steps[at - 1] : null,
    finished = index >= execution.steps.length - 1;
  const points = [...nodes.values()],
    centre = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  const raw: { id: string; text: string; tone: OverlayTagTone; anchor: Point; toward: Point; curved: boolean }[] = [];
  const outward = (p: Point, distance: number) => {
    const dx = p.x - centre.x,
      dy = p.y - centre.y,
      d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * distance, y: p.y + (dy / d) * distance };
  };
  step.expanded.forEach((id, k) => {
    const p = nodes.get(id);
    if (!p) return;
    const distance = step.distances[id];
    raw.push({
      id: `settled-${id}`,
      text: `${k + 1} · ${name(id)}${distance === undefined ? '' : ` = ${distance}`}`,
      tone: id === step.current ? 'current' : 'settled',
      anchor: p,
      toward: outward(p, r * 3.1),
      curved: false,
    });
  });
  if (before)
    for (const [id, distance] of Object.entries(step.distances)) {
      const old = before.distances[id],
        p = nodes.get(id);
      if (!p || step.expanded.includes(id) || old === undefined || distance >= old) continue;
      const via = step.parents[id];
      raw.push({
        id: `change-${id}`,
        text: `${name(id)}: ${old} → ${distance}${via ? `, cheaper via ${name(via)}` : ''}`,
        tone: 'change',
        anchor: p,
        toward: outward(p, r * 4.2),
        curved: true,
      });
    }
  if (finished && execution.path && execution.path.length > 1) {
    const goal = nodes.get(execution.path.at(-1)!);
    const cost = execution.path
      .slice(1)
      .reduce((sum, to, i) => {
        const from = execution.path![i];
        const edge = execution.input.edges.find(
          (e) => (e.from === from && e.to === to) || (!execution.input.directed && e.from === to && e.to === from),
        );
        return sum + (edge?.weight ?? 1);
      }, 0);
    if (goal)
      raw.push({
        id: 'route',
        text: `Route ${execution.path.map(name).join('→')} = ${cost}`,
        tone: 'route',
        anchor: goal,
        toward: { x: goal.x, y: goal.y + r * 4.4 },
        curved: true,
      });
    const start = execution.path[0],
      end = execution.path.at(-1)!;
    const direct = graph.edges.find(
      (e) => (e.from === start && e.to === end) || (!graph.directed && e.from === end && e.to === start),
    );
    const key = direct && (graph.directed ? `${direct.from}>${direct.to}` : [direct.from, direct.to].sort().join('|'));
    const label = direct && labels.get(direct.id);
    if (direct && label && key && !pathEdges.has(key))
      raw.push({
        id: 'direct',
        text: `${direct.weight ?? 1} · costs more`,
        tone: 'warn',
        anchor: label,
        toward: { x: label.x + r * 3.4, y: label.y - r * 1.6 },
        curved: false,
      });
  }
  // Keep tags inside the capture, off the nodes and off each other.
  const placed: { x: number; y: number; w: number; h: number }[] = points.map((p) => ({
    x: p.x,
    y: p.y,
    w: r * 2.6,
    h: r * 2.6,
  }));
  const out: SourceOverlayModel['tags'] = [];
  for (const tag of raw.slice(-8)) {
    const { w, h } = tagSize(tag.text, font);
    let x = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, tag.toward.x)),
      y = Math.min(H - h / 2 - 4, Math.max(h / 2 + 4, tag.toward.y));
    for (let tries = 0; tries < 16; tries++) {
      const hit = placed.find((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 6 && Math.abs(b.y - y) < (b.h + h) / 2 + 4);
      if (!hit) break;
      y = y >= hit.y ? hit.y + (hit.h + h) / 2 + 6 : hit.y - (hit.h + h) / 2 - 6;
      y = Math.min(H - h / 2 - 4, Math.max(h / 2 + 4, y));
    }
    placed.push({ x, y, w, h });
    out.push({
      id: tag.id,
      text: tag.text,
      tone: tag.tone,
      x: x / W,
      y: y / H,
      anchor: { x: tag.anchor.x / W, y: tag.anchor.y / H },
      curved: tag.curved,
    });
  }
  return out;
}

/** A hand-drawn loop around a point, deterministic per id so redraws don't jitter. */
export function loopPath(x: number, y: number, r: number, id: string): string {
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const start = (seed % 360) * (Math.PI / 180),
    parts: string[] = [];
  for (let k = 0; k <= 28; k++) {
    const t = start + (k / 24) * Math.PI * 2,
      wobble = Math.sin(t * 3 + seed) * r * 0.06 + (k > 24 ? (k - 24) * r * 0.035 : 0),
      rr = r + wobble;
    parts.push(`${k ? 'L' : 'M'}${(x + Math.cos(t) * rr).toFixed(1)} ${(y + Math.sin(t) * rr * 0.94).toFixed(1)}`);
  }
  return parts.join(' ');
}
