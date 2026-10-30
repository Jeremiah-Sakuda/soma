import { segmentCrossesBox, type DiagramPoint } from './diagram-routing';
import type { ExplorationPanel, ExplorationSpec } from './exploration';
type Diagram = Extract<ExplorationPanel, { kind: 'diagram' }>;
/** Presentation only. Retain semantic identities; positions are not measurements. */
export function diagramLayout(panel: Diagram, compact: boolean, availableWidth?: number) {
  const width =
    availableWidth === undefined
      ? compact
        ? 400
        : 600
      : Math.max(280, Math.min(760, availableWidth));
  const cardWidth = 150;
  const nodes = panel.objects.filter((o) => o.kind === 'node' || o.kind === 'block');
  const cardHeight = Math.max(
    76,
    ...nodes.map((o) => Math.ceil(o.label.length / 15) * 20 + 16),
  );
  const top = Math.max(55, cardHeight / 2 + 16);
  let positions = nodes.map((o) => ({
    id: o.id,
    x: 90 + o.position.x * (width - 180),
    y: top + o.position.y * 210,
  }));
  const crowded = positions.some((p, i) =>
    positions
      .slice(i + 1)
      .some(
        (q) => Math.abs(p.x - q.x) < cardWidth + 16 && Math.abs(p.y - q.y) < cardHeight + 16,
      ),
  );
  if (crowded) {
    const authored = [...nodes].sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
    );
    // In a causal DAG, read the mechanism in arrow order instead of turning
    // arbitrary authored y coordinates into a backwards processing sequence.
    // Cycles retain the authored order. This changes presentation, never meaning.
    const edges = panel.objects
      .filter((o) => o.kind === 'edge')
      .filter((o) => o.directed && o.from !== o.to);
    const incoming = new Map(
      nodes.map((node) => [node.id, edges.filter((e) => e.to === node.id).length]),
    );
    const connected = (id: string) => edges.some((e) => e.from === id || e.to === id);
    const pending = [...authored],
      causal: typeof nodes = [];
    while (pending.length) {
      const ready = pending
        .filter((node) => incoming.get(node.id) === 0)
        .sort(
          (a, b) =>
            Number(connected(b.id)) - Number(connected(a.id)) ||
            authored.indexOf(a) - authored.indexOf(b),
        );
      if (!ready.length) break;
      const next = ready[0];
      causal.push(next);
      pending.splice(pending.indexOf(next), 1);
      for (const edge of edges.filter((e) => e.from === next.id))
        incoming.set(edge.to, incoming.get(edge.to)! - 1);
    }
    const ordered = causal.length === nodes.length ? causal : authored;
    const columns =
      availableWidth === undefined
        ? compact
          ? 2
          : 3
        : Math.max(1, Math.min(4, Math.floor((width - 30) / (cardWidth + 16))));
    positions = ordered.map((o, i) => ({
      id: o.id,
      x:
        columns === 1
          ? width / 2
          : 90 +
            ((Math.floor(i / columns) % 2 ? columns - 1 - (i % columns) : i % columns) *
              (width - 180)) /
              (columns - 1),
      y: top + Math.floor(i / columns) * (cardHeight + 40),
    }));
  }
  if (panel.objects.some((o) => o.kind === 'edge' && o.from === o.to))
    positions = positions.map((p) => ({ ...p, y: p.y + 40 }));
  let bottom = Math.max(115, ...positions.map((p) => p.y + cardHeight / 2 + 24));
  const notes = panel.objects
    .filter((o) => o.kind === 'text')
    .map((o) => {
      const y = bottom,
        height = Math.max(
          42,
          Math.ceil(o.text.length / Math.floor((width - 48) / 7)) * 20 + 16,
        );
      bottom += height;
      return { ...o, y, height };
    });
  return {
    width,
    height: bottom,
    positions,
    notes,
    crowded,
    cardWidth,
    cardHeight,
  };
}
/** Labels must not cover their own endpoint cards, another label or a note.
 * A bounded dense case uses the explicit connection list instead of clipping. */
export function diagramEdgeLabels(
  panel: Diagram,
  layout: ReturnType<typeof diagramLayout>,
  routes?: { id: string; points: DiagramPoint[] }[],
) {
  const placed: {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    legend: boolean;
  }[] = [];
  for (const edge of panel.objects) {
    if (edge.kind !== 'edge' || !edge.label) continue;
    const a = layout.positions.find((p) => p.id === edge.from)!,
      b = layout.positions.find((p) => p.id === edge.to)!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const width = Math.max(32, edge.label.length * 7.6 + 14);
    const route = routes?.find((r) => r.id === edge.id);
    const candidates =
      edge.from === edge.to
        ? [{ x: a.x, y: a.y - 66 }]
        : route
          ? route.points
              .slice(1)
              .map((p, i) => ({
                a: route.points[i],
                b: p,
                length: Math.hypot(p.x - route.points[i].x, p.y - route.points[i].y),
              }))
              .sort((a, b) => b.length - a.length)
              .flatMap(({ a, b }) =>
                [0, -14, 14].map((offset) => ({
                  x: (a.x + b.x) / 2 + (a.x === b.x ? offset : 0),
                  y: (a.y + b.y) / 2 + (a.y === b.y ? offset : 0),
                })),
              )
          : [0, -54, 54, -80, 80, -108, 108].map((offset) => ({
              x: (a.x + b.x) / 2 + normal.x * offset,
              y: (a.y + b.y) / 2 + normal.y * offset,
            }));
    const candidate = candidates.find(
      (p) =>
        p.x - width / 2 >= 4 &&
        p.x + width / 2 <= layout.width - 4 &&
        p.y - 12 >= 2 &&
        p.y + 12 <= (layout.notes[0]?.y ?? layout.height) - 2 &&
        !layout.positions.some(
          (n) =>
            Math.abs(p.x - n.x) < (width + layout.cardWidth) / 2 + 5 &&
            Math.abs(p.y - n.y) < (24 + layout.cardHeight) / 2 + 5,
        ) &&
        !routes?.some(
          (route) =>
            route.id !== edge.id &&
            route.points.slice(1).some((point, i) =>
              segmentCrossesBox(route.points[i], point, {
                x1: p.x - width / 2 - 3,
                x2: p.x + width / 2 + 3,
                y1: p.y - 14,
                y2: p.y + 14,
              }),
            ),
        ) &&
        !placed.some(
          (l) =>
            !l.legend &&
            Math.abs(p.x - l.x) < (width + l.width) / 2 + 5 &&
            Math.abs(p.y - l.y) < 29,
        ),
    );
    placed.push({
      id: edge.id,
      text: edge.label,
      x: candidate?.x ?? 0,
      y: candidate?.y ?? 0,
      width,
      legend: !candidate,
    });
  }
  return placed;
}

/** Grid cells are presentation, never source/solver facts. Repack only an
 * overlapping/out-of-grid explanation; keep every panel and its declared order.
 * If capacity is insufficient, ordinary validation/repair still owns failure. */
export function arrangeExplanationPanels(spec: ExplorationSpec): {
  spec: ExplorationSpec;
  changed: boolean;
} {
  if (spec.mode !== 'explanation' || spec.scene.layout !== 'diagram-sidebar')
    return { spec, changed: false };
  const occupied = new Set<string>(),
    panels: ExplorationPanel[] = [];
  let changed = false;
  const fits = (p: ExplorationPanel['placement']) =>
    p.column + p.columnSpan <= 3 &&
    Array.from({ length: p.columnSpan }, (_, i) => `${p.row}:${p.column + i}`).every(
      (c) => !occupied.has(c),
    );
  for (const panel of spec.scene.panels) {
    let placement = panel.placement;
    if (!fits(placement)) {
      const candidates = [1, 2, 3, 4].flatMap((row) =>
        [1, 2].map((column) => ({ ...placement, row, column })),
      ) as ExplorationPanel['placement'][];
      const found = candidates.find(fits);
      if (!found) return { spec, changed: false };
      placement = found;
      changed = true;
    }
    for (let i = 0; i < placement.columnSpan; i++)
      occupied.add(`${placement.row}:${placement.column + i}`);
    panels.push({ ...panel, placement });
  }
  return changed
    ? { spec: { ...spec, scene: { ...spec.scene, panels } }, changed: true }
    : { spec, changed: false };
}
