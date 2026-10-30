import type { BfsInput, ExplorationPanel } from './exploration';

type GraphPanel = Extract<ExplorationPanel, { kind: 'graph' }>;
type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
const overlaps = (a: Box, b: Box, gap = 5) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
  Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap;
const inside = (point: Point, box: Box, gap = 0) =>
  Math.abs(point.x - box.x) <= box.width / 2 + gap &&
  Math.abs(point.y - box.y) <= box.height / 2 + gap;
const crossing = (a: Point, b: Point, c: Point, d: Point) => {
  const turn = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0;
};

/** Geometry only. Never changes the graph, costs, trace or saved coordinates.
 * Each cost is placed on (or touching) its own connection; a crowded case uses
 * a keyed cost legend rather than hiding a weight or placing it near another one.
 */
export function weightedGraphLayout(panel: GraphPanel, input: BfsInput, width: number) {
  const xs = panel.positions.map((p) => p.x),
    ys = panel.positions.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const cardWidth = width < 500 ? 84 : 100;
  let nodes = input.nodes.map((node) => {
    const authored = panel.positions.find((p) => p.nodeId === node.id)!;
    const nodeWidth = node.label.length > 10 ? 130 : cardWidth;
    return {
      ...node,
      width: nodeWidth,
      height: 30 + Math.ceil(node.label.length / Math.floor((nodeWidth - 8) / 8.5)) * 18,
      x: 72 + (maxX === minX ? 0.5 : (authored.x - minX) / (maxX - minX)) * (width - 144),
      y: 65 + (maxY === minY ? 0.5 : (authored.y - minY) / (maxY - minY)) * 160,
    };
  });
  if (nodes.some((a, i) => nodes.slice(i + 1).some((b) => overlaps(a, b, 18)))) {
    const columns = Math.max(
      2,
      Math.min(
        width < 500 ? 3 : 4,
        Math.floor((width - 24) / (Math.max(...nodes.map((n) => n.width)) + 18)),
      ),
    );
    const rowHeight = Math.max(...nodes.map((n) => n.height)) + 65;
    const order = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    nodes = order.map((node, i) => ({
      ...node,
      x: 72 + ((i % columns) * (width - 144)) / (columns - 1),
      y: 70 + Math.floor(i / columns) * rowHeight,
    }));
  }
  const height = Math.max(280, ...nodes.map((n) => n.y + n.height / 2 + 20));
  const routed: { id: string; point: (t: number) => Point }[] = [];
  const edges = input.edges.map((edge) => {
    const a = nodes.find((n) => n.id === edge.from)!;
    const b = nodes.find((n) => n.id === edge.to)!;
    if (a.id === b.id) {
      const start = { x: a.x - 15, y: a.y - a.height / 2 };
      const end = { x: a.x + 15, y: start.y };
      const point = (t: number): Point => ({
        x:
          (1 - t) ** 3 * start.x +
          3 * (1 - t) ** 2 * t * (a.x - 70) +
          3 * (1 - t) * t * t * (a.x + 70) +
          t ** 3 * end.x,
        y:
          (1 - t) ** 3 * start.y +
          3 * (1 - t) ** 2 * t * (a.y - 65) +
          3 * (1 - t) * t * t * (a.y - 65) +
          t ** 3 * end.y,
      });
      return {
        ...edge,
        start,
        end,
        point,
        path: `M ${start.x} ${start.y} C ${a.x - 70} ${a.y - 65}, ${a.x + 70} ${a.y - 65}, ${end.x} ${end.y}`,
        reversePath: `M ${end.x} ${end.y} C ${a.x + 70} ${a.y - 65}, ${a.x - 70} ${a.y - 65}, ${start.x} ${start.y}`,
      };
    }
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    const boundary = (node: typeof a, toward: Point) => {
      const vx = toward.x - node.x,
        vy = toward.y - node.y;
      const t = Math.min(
        (node.width / 2 + 4) / (Math.abs(vx) || 0.001),
        (node.height / 2 + 4) / (Math.abs(vy) || 0.001),
      );
      return { x: node.x + vx * t, y: node.y + vy * t };
    };
    const route = (bend: number) => {
      const control = {
        x: (a.x + b.x) / 2 + normal.x * bend,
        y: (a.y + b.y) / 2 + normal.y * bend,
      };
      const start = boundary(a, control),
        end = boundary(b, control);
      const point = (t: number): Point => ({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
      });
      return {
        start,
        end,
        point,
        path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        reversePath: `M ${end.x} ${end.y} Q ${control.x} ${control.y} ${start.x} ${start.y}`,
      };
    };
    const routes = [0, 45, -45, 85, -85, 125, -125, 200, -200, 260, -260].map(route);
    const valid = routes.filter((r) =>
      Array.from({ length: 21 }, (_, i) => r.point(i / 20)).every(
        (p) =>
          p.x >= 8 &&
          p.x <= width - 8 &&
          p.y >= 8 &&
          p.y <= height - 8 &&
          !nodes.some((n) => n.id !== a.id && n.id !== b.id && inside(p, n, 5)),
      ),
    );
    const otherEdges = input.edges.filter(
      (e) => e.id !== edge.id && ![e.from, e.to].includes(a.id) && ![e.from, e.to].includes(b.id),
    );
    const score = (r: (typeof routes)[number]) =>
      otherEdges.reduce((total, other) => {
        const existing = routed.find((e) => e.id === other.id);
        const c = nodes.find((n) => n.id === other.from)!,
          d = nodes.find((n) => n.id === other.to)!;
        const point =
          existing?.point ??
          ((t: number) => ({ x: c.x + (d.x - c.x) * t, y: c.y + (d.y - c.y) * t }));
        const hit = Array.from({ length: 20 }, (_, i) => i).some((i) =>
          Array.from({ length: 20 }, (_, j) => j).some((j) =>
            crossing(r.point(i / 20), r.point((i + 1) / 20), point(j / 20), point((j + 1) / 20)),
          ),
        );
        return total + Number(hit);
      }, 0);
    const chosen =
      valid.map((r) => ({ r, score: score(r) })).sort((a, b) => a.score - b.score)[0]?.r ??
      routes[0];
    routed.push({ id: edge.id, point: chosen.point });
    return { ...edge, ...chosen };
  });
  const labels: (Box & { id: string; text: string; anchor: Point; legend: boolean })[] = [];
  for (const edge of edges) {
    const text = String(edge.weight ?? 1),
      boxWidth = Math.max(24, text.length * 8 + 12);
    let chosen: (Box & { anchor: Point }) | undefined;
    // A cost sits on its own connection (its box masks the line beneath it), or
    // touches it; a label far from its edge reads as belonging to another one.
    for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
      const anchor = edge.point(t),
        next = edge.point(Math.min(0.999, t + 0.001));
      const dx = next.x - anchor.x,
        dy = next.y - anchor.y,
        length = Math.hypot(dx, dy) || 1;
      for (const distance of [0, 12, -12, 20, -20]) {
        const box = {
          x: anchor.x - (dy / length) * distance,
          y: anchor.y + (dx / length) * distance,
          width: boxWidth,
          height: 22,
        };
        if (
          box.x - box.width / 2 < 4 ||
          box.x + box.width / 2 > width - 4 ||
          box.y < 14 ||
          box.y > height - 14
        )
          continue;
        if (nodes.some((n) => overlaps(n, box, 8)) || labels.some((l) => overlaps(l, box, 5)))
          continue;
        if (
          edges.some(
            (other) =>
              other.id !== edge.id &&
              Array.from({ length: 61 }, (_, i) => other.point(i / 60)).some((p) =>
                inside(p, box, 3),
              ),
          )
        )
          continue;
        chosen = { ...box, anchor };
        break;
      }
      if (chosen) break;
    }
    labels.push({
      ...(chosen ?? { x: 0, y: 0, width: boxWidth, height: 22, anchor: edge.point(0.5) }),
      id: edge.id,
      text,
      legend: !chosen,
    });
  }
  return { width, height, nodes, edges, labels };
}
