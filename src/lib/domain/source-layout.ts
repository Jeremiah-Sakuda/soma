import type { ExplorationSpec } from './exploration';

export type SourceNodePosition = { nodeId: string; x: number; y: number };
type GraphPosition = { nodeId: string; x: number; y: number };
const MIN_SPACING = 0.08;

/** Fits source positions into the graph panel's unit space, preserving the drawing's
 * aspect ratio. Returns null unless every node is placed and nodes stay distinguishable. */
export function fitSourcePositions(
  nodeIds: readonly string[],
  source: readonly SourceNodePosition[],
): GraphPosition[] | null {
  const byId = new Map(source.map((p) => [p.nodeId, p]));
  if (nodeIds.length < 2 || nodeIds.some((id) => !byId.has(id))) return null;
  const points = nodeIds.map((id) => byId.get(id)!),
    minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y)),
    span = Math.max(maxX - minX, maxY - minY);
  if (!(span > 0)) return null;
  const margin = 0.08,
    scale = (1 - 2 * margin) / span,
    offsetX = margin + (1 - 2 * margin - (maxX - minX) * scale) / 2,
    offsetY = margin + (1 - 2 * margin - (maxY - minY) * scale) / 2;
  const fitted = points.map((p) => ({
    nodeId: p.nodeId,
    x: Number((offsetX + (p.x - minX) * scale).toFixed(4)),
    y: Number((offsetY + (p.y - minY) * scale).toFixed(4)),
  }));
  for (let i = 0; i < fitted.length; i++)
    for (let j = i + 1; j < fitted.length; j++)
      if (Math.hypot(fitted[i].x - fitted[j].x, fitted[i].y - fitted[j].y) < MIN_SPACING)
        return null;
  return fitted;
}

/** Presentation only: places checked-graph nodes where a freshly read source drew them,
 * otherwise keeps an earlier revision's layout. Never changes the graph, costs or trace. */
export function applyGraphLayout(
  spec: ExplorationSpec,
  layout: { source?: readonly SourceNodePosition[] | null; previous?: ExplorationSpec | null },
): 'source' | 'previous' | null {
  if (spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') return null;
  const nodeIds = spec.input.nodes.map((n) => n.id);
  const previous =
    layout.previous &&
    (layout.previous.mode === 'checked-bfs' || layout.previous.mode === 'checked-dijkstra')
      ? layout.previous.scene.panels.find((p) => p.kind === 'graph' && p.execution === 'primary')
      : undefined;
  const kept =
    previous?.kind === 'graph' &&
    previous.positions.length === nodeIds.length &&
    nodeIds.every((id) => previous.positions.some((p) => p.nodeId === id))
      ? previous.positions.map((p) => ({ ...p }))
      : null;
  const fresh = layout.source ? fitSourcePositions(nodeIds, layout.source) : null;
  const positions = fresh ?? kept;
  if (!positions) return null;
  for (const panel of spec.scene.panels)
    if (panel.kind === 'graph') panel.positions = positions.map((p) => ({ ...p }));
  return fresh ? 'source' : 'previous';
}
