import type { DcSolution } from './dc-circuit';
import { circuitQuantity } from './exploration-view';
import { tagBox, type OverlayStatus, type OverlayTagTone, type SourceOverlayModel } from './source-overlay-model';

/** Normalized image coordinates of the interpreted circuit: one point on each node's wire,
 * and each component's two ends as drawn. */
export type SourceCircuitLayout = {
  nodes: { nodeId: string; x: number; y: number }[];
  components: { componentId: string; x1: number; y1: number; x2: number; y2: number }[];
};
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Region = { x: number; y: number; width: number; height: number };
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

/** Presentation only: every mark and number comes from the supplied solution. The result is
 * the same model the graph path produces, so the page and the companion draw it unchanged:
 * each part is inked along its own body, each revealed node is circled with its voltage, and
 * each part's current is tagged with its direction on the drawing. */
export function circuitOverlayModel({
  layout,
  solution,
  index,
  caption,
  stepLabel,
  aspect,
  obstacles = [],
}: {
  layout: SourceCircuitLayout;
  solution: DcSolution;
  index: number;
  caption: string | null;
  stepLabel: string;
  aspect: number;
  obstacles?: Region[];
}): SourceOverlayModel | null {
  const W = 1000,
    H = W * aspect;
  const px = (p: Point): Point => ({ x: p.x * W, y: p.y * H });
  const norm = (p: Point): Point => ({ x: p.x / W, y: p.y / H });
  const { input } = solution;
  const nodes = new Map(layout.nodes.map((n) => [n.nodeId, px(n)]));
  if (input.nodes.some((n) => !nodes.has(n.id))) return null;
  const solved = solution.status === 'solved';
  const steps = solution.steps;
  const at = Math.min(index, Math.max(0, steps.length - 1)),
    step = steps[at],
    before = at > 0 ? steps[at - 1] : null,
    finished = !solved || at >= steps.length - 1;
  const revealedNodes = new Set(solved ? step.revealedNodes : []),
    revealedParts = new Set(solved ? step.revealedComponents : []);
  const fresh = new Set(solved ? step.revealedComponents.filter((id) => !before?.revealedComponents.includes(id)) : []);
  const open = new Set(solution.state.open);

  const points = [...nodes.values()];
  const minGap = Math.min(
    ...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
  );
  const r = Math.max(6, Math.min(14, minGap * 0.1));
  const font = Math.max(9, Math.min(15, minGap * 0.085));

  // Each part's ends, the one touching its `from` node first.
  const ends = new Map<string, [Point, Point]>();
  for (const c of input.components) {
    const spot = layout.components.find((x) => x.componentId === c.id);
    if (!spot) continue;
    const a = px({ x: spot.x1, y: spot.y1 }),
      b = px({ x: spot.x2, y: spot.y2 }),
      f = nodes.get(c.from)!,
      t = nodes.get(c.to)!;
    const d = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
    ends.set(c.id, d(a, f) + d(b, t) <= d(b, f) + d(a, t) ? [a, b] : [b, a]);
  }
  const edges: SourceOverlayModel['edges'] = input.components.flatMap((c) => {
    const pair = ends.get(c.id);
    if (!pair) return [];
    const [a, b] = pair,
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const current = solution.currents[c.id] ?? 0;
    const tone = open.has(c.id)
      ? 'cut'
      : !solved || !revealedParts.has(c.id)
        ? 'idle'
        : fresh.has(c.id) && !finished
          ? 'relaxed'
          : current !== 0
            ? 'path'
            : 'idle';
    const value = solution.state.values[c.id] ?? c.value;
    return [
      {
        id: c.id,
        label: `${open.has(c.id) ? 'Reconnect' : 'Open'} ${c.label}, ${Number(value.toPrecision(4))} ${c.kind === 'resistor' ? 'Ω' : c.kind === 'voltage-source' ? 'V' : 'A'}`,
        from: norm(a),
        control: norm(mid),
        to: norm(b),
        center: norm(mid),
        tone,
      },
    ];
  });
  const weights: SourceOverlayModel['weights'] = input.components.flatMap((c) => {
    const value = solution.state.values[c.id],
      pair = ends.get(c.id);
    if (value === undefined || value === c.value || !pair) return [];
    const unit = c.kind === 'resistor' ? 'Ω' : c.kind === 'voltage-source' ? 'V' : 'A';
    const mid = norm({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
    return [{ edgeId: c.id, x: mid.x, y: mid.y, text: `${Number(c.value.toPrecision(4))} → ${Number(value.toPrecision(4))} ${unit}`.slice(0, 24) }];
  });
  const modelNodes: SourceOverlayModel['nodes'] = input.nodes.map((n) => {
    const p = layout.nodes.find((x) => x.nodeId === n.id)!;
    const status: OverlayStatus =
      solution.voltages[n.id] === null && solved
        ? 'unreached'
        : step?.node === n.id && !finished
          ? 'current'
          : revealedNodes.has(n.id)
            ? 'settled'
            : 'waiting';
    return { id: n.id, label: n.label, x: p.x, y: p.y, status, distance: null };
  });

  // Annotations avoid the circuit's own marks and the source's text regions.
  const blocked: Box[] = [
    ...points.map((p) => ({ x: p.x, y: p.y, w: r * 2.4, h: r * 2.4 })),
    ...[...ends.values()].map(([a, b]) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      w: Math.max(Math.abs(a.x - b.x), r * 2),
      h: Math.max(Math.abs(a.y - b.y), r * 2),
    })),
    ...obstacles
      .filter((o) => !points.some((p) => p.x >= o.x * W && p.x <= (o.x + o.width) * W && p.y >= o.y * H && p.y <= (o.y + o.height) * H))
      .map((o) => ({ x: (o.x + o.width / 2) * W, y: (o.y + o.height / 2) * H, w: o.width * W, h: o.height * H })),
  ];
  const centre = {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
  const overlap = (b: Box) =>
    blocked.reduce((sum, o) => {
      const ox = Math.min(o.x + o.w / 2, b.x + b.w / 2 + 3) - Math.max(o.x - o.w / 2, b.x - b.w / 2 - 3),
        oy = Math.min(o.y + o.h / 2, b.y + b.h / 2 + 2) - Math.max(o.y - o.h / 2, b.y - b.h / 2 - 2);
      return ox > 0 && oy > 0 ? sum + ox * oy : sum;
    }, 0);
  const inside = (b: Box) => b.x - b.w / 2 >= 2 && b.x + b.w / 2 <= W - 2 && b.y - b.h / 2 >= 2 && b.y + b.h / 2 <= H - 2;
  const tags: SourceOverlayModel['tags'] = [];
  const place = (id: string, text: string, tone: OverlayTagTone, anchor: Point, curved: boolean) => {
    if (tags.length >= 12) return;
    const { w, h } = tagBox(text, font);
    const base = Math.atan2(anchor.y - centre.y, anchor.x - centre.x || 0.001);
    const candidates: Point[] = [];
    for (const distance of [r * 1.8 + h / 2, r * 2.8 + h / 2, r * 4 + h / 2, r * 5.6 + h / 2])
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const angle = base + turn;
        candidates.push({
          x: anchor.x + Math.cos(angle) * (distance + w * 0.3 * Math.abs(Math.cos(angle))),
          y: anchor.y + Math.sin(angle) * distance,
        });
      }
    const fits = candidates.filter((c) => inside({ ...c, w, h }));
    const spot =
      fits.find((c) => overlap({ ...c, w, h }) === 0) ??
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
  };
  if (solved) {
    const partTag = (id: string) => {
      const c = input.components.find((x) => x.id === id)!,
        pair = ends.get(id);
      if (!pair || open.has(id)) return;
      const current = solution.currents[id];
      const mid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      if (current === 0) return place(`current-${id}`, `${c.label}: 0 A`, 'tentative', mid, true);
      const [a, b] = current > 0 ? pair : [pair[1], pair[0]];
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const arrow = ARROWS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
      const amount = circuitQuantity(Math.abs(current), 'A');
      place(`current-${id}`, `${c.label}: ${amount} ${arrow}`, fresh.has(id) && !finished ? 'equation' : 'route', mid, true);
    };
    const nodeTag = (id: string) => {
      const v = solution.voltages[id];
      if (v === null || !nodes.has(id)) return;
      const name = input.nodes.find((n) => n.id === id)!.label;
      place(
        `voltage-${id}`,
        `${name.length > 14 ? `${name.slice(0, 13)}…` : name} = ${circuitQuantity(v, 'V')}`,
        step.node === id && !finished ? 'current' : 'settled',
        nodes.get(id)!,
        false,
      );
    };
    // This step's news first, then the rest, so the tag cap never hides what just changed.
    if (step.node) nodeTag(step.node);
    for (const id of fresh) partTag(id);
    for (const id of step.revealedComponents) if (!fresh.has(id)) partTag(id);
    for (const id of step.revealedNodes) if (id !== step.node) nodeTag(id);
  }

  const bottom = Math.max(...blocked.map((b) => b.y + b.h / 2)),
    top = Math.min(...blocked.map((b) => b.y - b.h / 2));
  const left = Math.max(0.01, (Math.min(...points.map((p) => p.x)) - r * 2) / W);
  const underneath = H - bottom > font * 5 || H - bottom > top;
  const text = caption ? (caption.length > 380 ? `${caption.slice(0, 379)}…` : caption) : null;
  return {
    final: finished,
    radius: r / W,
    font: font / W,
    nodes: modelNodes,
    edges,
    weights,
    tags,
    callouts: [],
    caption: text
      ? underneath
        ? { text, stepLabel, x: left, y: Math.min(0.86, (bottom + font * 0.8) / H), anchor: 'top', font: font / W }
        : { text, stepLabel, x: left, y: Math.max(0.02, (top - font * 0.8) / H), anchor: 'bottom', font: font / W }
      : null,
  };
}
