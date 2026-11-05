import type { ExplorationPanel } from './exploration';
import type { diagramLayout } from './exploration-layout';
type Diagram = Extract<ExplorationPanel, { kind: 'diagram' }>;
export type DiagramPoint = { x: number; y: number };
type Box = { x1: number; y1: number; x2: number; y2: number };
export function segmentCrossesBox(a: DiagramPoint, b: DiagramPoint, r: Box) {
  if (a.x === b.x)
    return a.x > r.x1 && a.x < r.x2 && Math.max(a.y, b.y) > r.y1 && Math.min(a.y, b.y) < r.y2;
  if (a.y === b.y)
    return a.y > r.y1 && a.y < r.y2 && Math.max(a.x, b.x) > r.x1 && Math.min(a.x, b.x) < r.x2;
  return true;
}
/** Orthogonal routes prevent a shortcut across another card from falsely
 * depicting a sequential relationship. Presentation only; no semantic edits. */
export function diagramRoutes(panel: Diagram, layout: ReturnType<typeof diagramLayout>) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const boxes = layout.positions.map((p) => ({
    id: p.id,
    x1: p.x - layout.cardWidth / 2 - 3,
    x2: p.x + layout.cardWidth / 2 + 3,
    y1: p.y - layout.cardHeight / 2 - 3,
    y2: p.y + layout.cardHeight / 2 + 3,
  }));
  const ports = (id: string) => {
    const p = layout.positions.find((n) => n.id === id)!;
    return [
      { x: round(p.x - layout.cardWidth / 2 - 7), y: round(p.y) },
      { x: round(p.x + layout.cardWidth / 2 + 7), y: round(p.y) },
      { x: round(p.x), y: round(p.y - layout.cardHeight / 2 - 7) },
      { x: round(p.x), y: round(p.y + layout.cardHeight / 2 + 7) },
    ];
  };
  const xs = [
    ...new Set([
      5,
      layout.width - 5,
      ...layout.positions.flatMap((p) => ports(p.id).map((v) => v.x)),
    ]),
  ]
    .filter((v) => v >= 3 && v <= layout.width - 3)
    .sort((a, b) => a - b);
  const ys = [
    ...new Set([
      5,
      (layout.notes[0]?.y ?? layout.height) - 5,
      ...layout.positions.flatMap((p) => ports(p.id).map((v) => v.y)),
    ]),
  ]
    .filter((v) => v >= 3 && v <= layout.height - 3)
    .sort((a, b) => a - b);
  const key = (x: number, y: number) => y * xs.length + x;
  const point = (k: number) => ({ x: xs[k % xs.length], y: ys[Math.floor(k / xs.length)] });
  return panel.objects
    .filter((o) => o.kind === 'edge')
    .filter((o) => o.from !== o.to)
    .map((edge) => {
      const starts = ports(edge.from).filter((p) => xs.includes(p.x) && ys.includes(p.y));
      const goals = ports(edge.to).filter((p) => xs.includes(p.x) && ys.includes(p.y));
      const goalIds = new Set(goals.map((p) => key(xs.indexOf(p.x), ys.indexOf(p.y))));
      const heuristic = (p: DiagramPoint) =>
        Math.min(...goals.map((g) => Math.abs(p.x - g.x) + Math.abs(p.y - g.y)));
      const best = new Map<string, number>(),
        parents = new Map<string, string>(),
        queue: { k: number; dir: number; cost: number; score: number; state: string }[] = [];
      for (const p of starts) {
        const k = key(xs.indexOf(p.x), ys.indexOf(p.y)),
          state = k + ':0';
        queue.push({ k, dir: 0, cost: 0, score: heuristic(p), state });
        best.set(state, 0);
      }
      let found: string | undefined,
        iterations = 0;
      while (queue.length && iterations++ < 20000) {
        queue.sort((a, b) => a.score - b.score || a.cost - b.cost || a.k - b.k);
        const q = queue.shift()!;
        if (q.cost !== best.get(q.state)) continue;
        if (goalIds.has(q.k)) {
          found = q.state;
          break;
        }
        const x = q.k % xs.length,
          y = Math.floor(q.k / xs.length),
          a = point(q.k);
        for (const [nx, ny, dir] of [
          [x - 1, y, 1],
          [x + 1, y, 1],
          [x, y - 1, 2],
          [x, y + 1, 2],
        ]) {
          if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
          const k = key(nx, ny),
            b = point(k);
          if (boxes.some((r) => segmentCrossesBox(a, b, r))) continue;
          const cost =
              q.cost +
              Math.abs(a.x - b.x) +
              Math.abs(a.y - b.y) +
              (q.dir && q.dir !== dir ? 10 : 0),
            state = k + ':' + dir;
          if (cost >= (best.get(state) ?? Infinity)) continue;
          best.set(state, cost);
          parents.set(state, q.state);
          queue.push({ k, dir, cost, score: cost + heuristic(b), state });
        }
      }
      const points: DiagramPoint[] = [];
      if (found) {
        let s: string | undefined = found;
        while (s) {
          points.unshift(point(Number(s.split(':')[0])));
          s = parents.get(s);
        }
      }
      const simplified = points.filter(
        (p, i) =>
          !i ||
          i === points.length - 1 ||
          !(
            (points[i - 1].x === p.x && p.x === points[i + 1].x) ||
            (points[i - 1].y === p.y && p.y === points[i + 1].y)
          ),
      );
      return {
        id: edge.id,
        points: simplified,
        d: simplified.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '),
      };
    });
}
export function pointOnDiagramRoute(points: DiagramPoint[], progress: number): DiagramPoint {
  if (!points.length) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y)),
    total = lengths.reduce((a, b) => a + b, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    remaining -= lengths[i];
  }
  return points.at(-1)!;
}
