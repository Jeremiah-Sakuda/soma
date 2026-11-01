'use client';
import { useState, type KeyboardEvent } from 'react';
import type { BfsExecution, BfsInput } from '@/lib/domain/graph-search';

export type SourceGraphLayout = {
  nodes: { nodeId: string; x: number; y: number }[];
  edgeLabels: { edgeId: string; x: number; y: number }[];
};
type Point = { x: number; y: number };
const WIDTH = 1000;

/** Draws the checked trace over the learner's own capture. Presentation only: every ring,
 * distance and route comes from the supplied execution; nothing is read from pixels here. */
export function SourceOverlay({
  image,
  layout,
  graph,
  execution,
  index,
  disabledEdgeIds,
  weights,
  canToggle,
  selected,
  caption,
  stepLabel,
  onToggleEdge,
  onSelect,
}: {
  image: string;
  layout: SourceGraphLayout;
  /** The full interpreted graph, including connections the learner has cut. */
  graph: BfsInput;
  execution: BfsExecution;
  index: number;
  disabledEdgeIds: readonly string[];
  /** Hypothetical costs the learner set; drawn over the source's printed weights. */
  weights?: Record<string, number>;
  canToggle: boolean;
  selected: string | null;
  caption: string | null;
  stepLabel: string;
  onToggleEdge: (edgeId: string) => void;
  onSelect: (id: string) => void;
}) {
  const [aspect, setAspect] = useState<number | null>(null);
  const height = WIDTH * (aspect ?? 0.5625);
  const at = (p: Point): Point => ({ x: p.x * WIDTH, y: p.y * height });
  const nodes = new Map(layout.nodes.map((n) => [n.nodeId, at(n)]));
  const labels = new Map(layout.edgeLabels.map((l) => [l.edgeId, at(l)]));
  const step = execution.steps[Math.min(index, execution.steps.length - 1)];
  const finished = index >= execution.steps.length - 1;
  const input = execution.input;
  const allEdges = graph.edges.map((e) => ({ ...e, disabled: disabledEdgeIds.includes(e.id) }));
  const pairKey = (a: string, b: string) => (input.directed ? `${a}>${b}` : [a, b].sort().join('|'));
  const pathEdges = new Set<string>();
  if (finished && execution.path)
    for (let i = 1; i < execution.path.length; i++)
      pathEdges.add(pairKey(execution.path[i - 1], execution.path[i]));
  const treeEdges = new Set<string>();
  for (const [node, parent] of Object.entries(step.parents))
    if (parent) treeEdges.add(pairKey(parent, node));
  const minGap = Math.min(
    ...[...nodes.values()].flatMap((a, i, all) =>
      all.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
    ),
  );
  const radius = Math.max(14, Math.min(34, minGap * 0.3));

  function geometry(edge: { id: string; from: string; to: string }) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    if (!a || !b) return null;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      label = labels.get(edge.id),
      length = Math.hypot(b.x - a.x, b.y - a.y);
    // A label far from the straight midpoint means the source drew this edge as an arc.
    const control =
      label && Math.hypot(label.x - mid.x, label.y - mid.y) > length * 0.25
        ? { x: 2 * label.x - mid.x, y: 2 * label.y - mid.y }
        : mid;
    const trim = (p: Point, toward: Point) => {
      const d = Math.hypot(toward.x - p.x, toward.y - p.y) || 1;
      return { x: p.x + ((toward.x - p.x) / d) * radius, y: p.y + ((toward.y - p.y) / d) * radius };
    };
    const start = trim(a, control),
      end = trim(b, control);
    return {
      d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
      center: { x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y },
    };
  }
  const name = (id: string) => input.nodes.find((n) => n.id === id)?.label ?? id;
  const keyActivate = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
  const ys = [...nodes.values()].map((p) => p.y);
  // Slides keep titles at the top, so prefer the space under the graph when there is room.
  const below = height - Math.max(...ys) - radius * 1.6,
    captionBelow = below > height * 0.14 || below > Math.min(...ys) - radius * 1.6;
  const xs = [...nodes.values()].map((p) => p.x);
  const captionStyle = captionBelow
    ? { top: `${((Math.max(...ys) + radius * 1.6) / height) * 100}%`, left: `${Math.max(2, ((Math.min(...xs) - radius) / WIDTH) * 100)}%` }
    : { bottom: `${((height - Math.min(...ys) + radius * 1.6) / height) * 100}%`, left: `${Math.max(2, ((Math.min(...xs) - radius) / WIDTH) * 100)}%` };

  return (
    <figure className="source-overlay">
      <img
        src={image}
        alt="Your captured source, with Soma's checked search drawn over it"
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth) setAspect(img.naturalHeight / img.naturalWidth);
        }}
      />
      {aspect && (
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="source-overlay-layer"
          role="group"
          aria-label={`Checked search over your source. ${stepLabel}`}
        >
          {allEdges.map((edge) => {
            const shape = geometry(edge);
            if (!shape) return null;
            const { from, to } = edge;
            const key = pairKey(from, to);
            const tone = edge.disabled
              ? 'is-cut'
              : pathEdges.has(key)
                ? 'is-path'
                : treeEdges.has(key)
                  ? 'is-tree'
                  : 'is-idle';
            const label = `${edge.disabled ? 'Restore' : 'Cut'} connection ${name(from)}–${name(to)}${edge.weight === undefined ? '' : `, cost ${edge.weight}`}`;
            return (
              <g key={edge.id} className={`source-overlay-edge ${tone}`}>
                <path d={shape.d} className="source-overlay-stroke" />
                {edge.disabled && (
                  <g transform={`translate(${shape.center.x} ${shape.center.y})`} className="source-overlay-cut">
                    <circle r={radius * 0.55} />
                    <path d={`M ${-radius * 0.22} ${-radius * 0.22} L ${radius * 0.22} ${radius * 0.22} M ${radius * 0.22} ${-radius * 0.22} L ${-radius * 0.22} ${radius * 0.22}`} />
                  </g>
                )}
                {canToggle && (
                  <path
                    d={shape.d}
                    className="source-overlay-hit"
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    onClick={() => onToggleEdge(edge.id)}
                    onKeyDown={(event) => keyActivate(event, () => onToggleEdge(edge.id))}
                  >
                    <title>{label}</title>
                  </path>
                )}
              </g>
            );
          })}
          {graph.edges.map((edge) => {
            const value = weights?.[edge.id],
              label = labels.get(edge.id);
            if (value === undefined || value === (edge.weight ?? 1) || !label) return null;
            const text = `${edge.weight ?? 1} → ${value}`;
            return (
              <g key={`w-${edge.id}`} className="source-overlay-weight" transform={`translate(${label.x} ${label.y})`}>
                <rect x={-radius * 1.25} y={-radius * 0.55} width={radius * 2.5} height={radius * 1.1} rx={radius * 0.55} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.62}>
                  {text}
                </text>
              </g>
            );
          })}
          {input.nodes.map((node) => {
            const p = nodes.get(node.id);
            if (!p) return null;
            const status =
              step.current === node.id
                ? 'is-current'
                : step.expanded.includes(node.id)
                  ? 'is-settled'
                  : step.queue.includes(node.id)
                    ? 'is-waiting'
                    : 'is-unreached';
            const distance = step.distances[node.id];
            const words = { 'is-current': 'now', 'is-settled': 'settled', 'is-waiting': 'waiting', 'is-unreached': 'not reached' }[status];
            return (
              <g
                key={node.id}
                className={`source-overlay-node ${status} ${selected === node.id ? 'is-selected' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}: ${words}${distance === undefined ? '' : `, distance ${distance}`}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => keyActivate(event, () => onSelect(node.id))}
              >
                <circle r={radius} className="source-overlay-ring" />
                {distance !== undefined && (
                  <g transform={`translate(${radius * 0.95} ${-radius * 0.95})`} className="source-overlay-badge">
                    <rect x={-radius * 0.55} y={-radius * 0.42} width={radius * 1.1} height={radius * 0.84} rx={radius * 0.42} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.56}>
                      {distance}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {caption && (
        <figcaption
          className={`source-overlay-caption ${captionBelow ? 'is-below' : 'is-above'}`}
          style={aspect ? captionStyle : undefined}
          aria-live="polite"
        >
          <span className="overline">{stepLabel}</span>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
