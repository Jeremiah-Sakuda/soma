'use client';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { BfsExecution, BfsInput } from '@/lib/domain/graph-search';
import { sourceOverlayModel, type SourceGraphLayout, type SourceOverlayModel } from '@/lib/domain/source-overlay-model';

export type { SourceGraphLayout } from '@/lib/domain/source-overlay-model';
const WIDTH = 1000;
const STATUS_WORDS = { current: 'now', settled: 'settled', waiting: 'waiting', unreached: 'not reached' };

/** Draws the checked trace over the learner's own capture. Presentation only. */
export function SourceOverlay({
  image,
  canToggle,
  selected,
  onToggleEdge,
  onSelect,
  onModel,
  ...input
}: {
  image: string;
  layout: SourceGraphLayout;
  graph: BfsInput;
  execution: BfsExecution;
  index: number;
  disabledEdgeIds: readonly string[];
  weights?: Record<string, number>;
  canToggle: boolean;
  selected: string | null;
  caption: string | null;
  stepLabel: string;
  callouts?: { id: string; label: string; region: { x: number; y: number; width: number; height: number } }[];
  onToggleEdge: (edgeId: string) => void;
  onSelect: (id: string) => void;
  /** Receives the same normalized model, e.g. to mirror it over the real display. */
  onModel?: (model: SourceOverlayModel | null) => void;
}) {
  const [aspect, setAspect] = useState<number | null>(null);
  const model = aspect ? sourceOverlayModel({ ...input, aspect }) : null;
  const serialized = JSON.stringify(model);
  useEffect(() => {
    onModel?.(serialized === 'null' ? null : (JSON.parse(serialized) as SourceOverlayModel));
  }, [serialized, onModel]);
  useEffect(() => () => onModel?.(null), [onModel]);
  const height = WIDTH * (aspect ?? 0.5625);
  const at = (p: { x: number; y: number }) => ({ x: p.x * WIDTH, y: p.y * height });
  const r = (model?.radius ?? 0) * WIDTH;
  const keyActivate = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
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
      {model && (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="source-overlay-layer" role="group" aria-label={`Checked search over your source. ${input.stepLabel}`}>
          {model.callouts.map((c) => {
            const p = at(c),
              w = c.width * WIDTH,
              h = c.height * height,
              tag = Math.max(r * 0.6, 12);
            return (
              <g key={`c-${c.id}`} className="source-overlay-callout">
                <rect x={p.x} y={p.y} width={w} height={h} rx={8} />
                <text x={p.x} y={Math.max(tag, p.y - tag * 0.45)} fontSize={tag}>
                  {c.label}
                </text>
              </g>
            );
          })}
          {model.edges.map((edge) => {
            const a = at(edge.from),
              c = at(edge.control),
              b = at(edge.to),
              m = at(edge.center),
              d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
            return (
              <g key={edge.id} className={`source-overlay-edge is-${edge.tone}`}>
                <path d={d} className="source-overlay-stroke" />
                {edge.tone === 'cut' && (
                  <g transform={`translate(${m.x} ${m.y})`} className="source-overlay-cut">
                    <circle r={r * 0.55} />
                    <path d={`M ${-r * 0.22} ${-r * 0.22} L ${r * 0.22} ${r * 0.22} M ${r * 0.22} ${-r * 0.22} L ${-r * 0.22} ${r * 0.22}`} />
                  </g>
                )}
                {canToggle && (
                  <path
                    d={d}
                    className="source-overlay-hit"
                    role="button"
                    tabIndex={0}
                    aria-label={edge.label}
                    onClick={() => onToggleEdge(edge.id)}
                    onKeyDown={(event) => keyActivate(event, () => onToggleEdge(edge.id))}
                  >
                    <title>{edge.label}</title>
                  </path>
                )}
              </g>
            );
          })}
          {model.weights.map((w) => {
            const p = at(w);
            return (
              <g key={`w-${w.edgeId}`} className="source-overlay-weight" transform={`translate(${p.x} ${p.y})`}>
                <rect x={-r * 1.25} y={-r * 0.55} width={r * 2.5} height={r * 1.1} rx={r * 0.55} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.62}>
                  {w.text}
                </text>
              </g>
            );
          })}
          {model.nodes.map((node) => {
            const p = at(node);
            return (
              <g
                key={node.id}
                className={`source-overlay-node is-${node.status} ${selected === node.id ? 'is-selected' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}: ${STATUS_WORDS[node.status]}${node.distance === null ? '' : `, distance ${node.distance}`}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => keyActivate(event, () => onSelect(node.id))}
              >
                <circle r={r} className="source-overlay-ring" />
                {node.distance !== null && (
                  <g transform={`translate(${r * 0.95} ${-r * 0.95})`} className="source-overlay-badge">
                    <rect x={-r * 0.55} y={-r * 0.42} width={r * 1.1} height={r * 0.84} rx={r * 0.42} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.56}>
                      {node.distance}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {model?.caption && (
        <figcaption
          className="source-overlay-caption"
          style={
            model.caption.anchor === 'top'
              ? { top: `${model.caption.y * 100}%`, left: `${model.caption.x * 100}%` }
              : { bottom: `${(1 - model.caption.y) * 100}%`, left: `${model.caption.x * 100}%` }
          }
          aria-live="polite"
        >
          <span className="overline">{model.caption.stepLabel}</span>
          {model.caption.text}
        </figcaption>
      )}
    </figure>
  );
}
