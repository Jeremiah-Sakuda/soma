'use client';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { BfsExecution, BfsInput } from '@/lib/domain/graph-search';
import {
  loopPath,
  routeSequence,
  sourceOverlayModel,
  tagBox,
  type SourceGraphLayout,
  type SourceOverlayModel,
} from '@/lib/domain/source-overlay-model';
// Seconds before the route starts drawing, and for each connection along it.
const ROUTE_LEAD = 0.15,
  ROUTE_SEGMENT = 0.45;

export type { SourceGraphLayout } from '@/lib/domain/source-overlay-model';
const WIDTH = 1000;
const STATUS_WORDS = { current: 'now', settled: 'settled', waiting: 'waiting', unreached: 'not reached' };
const CIRCUIT_STATUS_WORDS = {
  current: 'voltage shown now', settled: 'voltage shown',
  waiting: 'voltage not yet shown', unreached: 'voltage undefined relative to ground',
};
let measureContext: CanvasRenderingContext2D | null | undefined;
/** Real text width in the annotation hand, so tags fit their words. */
function textWidth(text: string, font: number) {
  if (measureContext === undefined)
    measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!measureContext) return null;
  const hand = getComputedStyle(document.documentElement).getPropertyValue('--font-journal-hand').trim();
  measureContext.font = `700 ${font}px ${hand ? `${hand}, ` : ''}Noteworthy, cursive`;
  return measureContext.measureText(text).width;
}

/** Draws the checked trace over the learner's own capture, in the annotated-sketch style of
 * the product references: inked edges, hand-drawn loops and pastel tags with leader lines.
 * Presentation only; every word and number comes from the supplied execution. */
export function SourceOverlay({
  image,
  canToggle,
  selected,
  onToggleEdge,
  onSelect,
  onModel,
  compact = false,
  family = 'graph',
  build,
  ...input
}: {
  /** The same overlay is on the learner's screen; keep this copy small. */
  compact?: boolean;
  /** Controls accessible terminology only; the supplied model owns all geometry and facts. */
  family?: 'graph' | 'circuit';
  image: string;
  canToggle: boolean;
  selected: string | null;
  stepLabel: string;
  onToggleEdge: (edgeId: string) => void;
  onSelect: (id: string) => void;
  /** Receives the same normalized model, e.g. to mirror it over the real display. */
  onModel?: (model: SourceOverlayModel | null) => void;
} & (
  | {
      build?: undefined;
      layout: SourceGraphLayout;
      graph: BfsInput;
      execution: BfsExecution;
      index: number;
      disabledEdgeIds: readonly string[];
      weights?: Record<string, number>;
      caption: string | null;
      /** Source text regions annotations should keep clear of. */
      obstacles?: { x: number; y: number; width: number; height: number }[];
    }
  | {
      /** Another checked family (a circuit) supplies its own model for the capture's shape. */
      build: (aspect: number) => SourceOverlayModel | null;
    }
)) {
  const [aspect, setAspect] = useState<number | null>(null);
  const model = !aspect
    ? null
    : build
      ? build(aspect)
      : sourceOverlayModel({ ...(input as Omit<Parameters<typeof sourceOverlayModel>[0], 'aspect'>), aspect });
  const serialized = JSON.stringify(model);
  // The final route draws from the start to the goal, one connection after another.
  const sequence = model ? routeSequence(model) : new Map<string, { index: number; reverse: boolean }>();
  const routeDone = `${ROUTE_LEAD + sequence.size * ROUTE_SEGMENT}s`;
  // The goal's circle and its tags land as the route arrives there.
  const goalNode = model?.nodes.find((n) => n.id === model.lift?.goal);
  const atGoal = (p: { x: number; y: number }) => Boolean(goalNode && Math.abs(p.x - goalNode.x) < 1e-6 && Math.abs(p.y - goalNode.y) < 1e-6);
  useEffect(() => {
    onModel?.(serialized === 'null' ? null : (JSON.parse(serialized) as SourceOverlayModel));
  }, [serialized, onModel]);
  useEffect(() => () => onModel?.(null), [onModel]);
  const height = WIDTH * (aspect ?? 0.5625);
  const at = (p: { x: number; y: number }) => ({ x: p.x * WIDTH, y: p.y * height });
  const r = (model?.radius ?? 0) * WIDTH,
    font = (model?.font ?? 0.017) * WIDTH;
  const keyActivate = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
  return (
    <figure className={`source-overlay${compact ? ' is-compact' : ''}`}>
      <img
        src={image}
        alt={`Your captured source, with Soma's checked ${family === 'circuit' ? 'circuit' : 'search'} drawn over it`}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth) setAspect(img.naturalHeight / img.naturalWidth);
        }}
      />
      {model && (
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className={`source-overlay-layer${model.final ? ' is-final' : ''}`}
          role="group"
          aria-label={`Checked ${family === 'circuit' ? 'circuit' : 'search'} over your source. ${input.stepLabel}`}
        >
          <defs>
            <marker id="source-overlay-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {model.edges.map((edge) => {
            const a = at(edge.from),
              c = at(edge.control),
              b = at(edge.to),
              m = at(edge.center),
              d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
            return (
              <g key={edge.id} className={`source-overlay-edge is-${edge.tone}`}>
                {edge.tone !== 'idle' && edge.tone !== 'struck' && (() => {
                  const step = edge.tone === 'path' ? sequence.get(edge.id) : undefined;
                  return (
                    <path
                      key={edge.tone === 'path' ? 'path' : 'drawn'}
                      d={step?.reverse ? `M ${b.x} ${b.y} Q ${c.x} ${c.y} ${a.x} ${a.y}` : d}
                      className="source-overlay-stroke"
                      pathLength={1}
                      strokeWidth={r * (edge.tone === 'path' ? 0.22 : 0.18)}
                      style={step ? { animationDelay: `${ROUTE_LEAD + step.index * ROUTE_SEGMENT}s`, animationDuration: `${ROUTE_SEGMENT}s`, animationTimingFunction: 'linear' } : undefined}
                    />
                  );
                })()}
                {edge.tone === 'struck' && (() => {
                  // One slash on the source's own line, clear of its printed labels.
                  const point = edge.strike ? at(edge.strike) : m,
                    sx = point.x,
                    sy = point.y;
                  return <path className="source-overlay-cut" pathLength={1} strokeWidth={r * 0.16} d={`M ${sx - r * 0.5} ${sy + r * 0.5} L ${sx + r * 0.5} ${sy - r * 0.5}`} />;
                })()}
                {edge.tone === 'cut' && (
                  <path
                    className="source-overlay-cut"
                    pathLength={1}
                    d={`M ${m.x - r * 0.5} ${m.y - r * 0.5} L ${m.x + r * 0.5} ${m.y + r * 0.5} M ${m.x + r * 0.5} ${m.y - r * 0.5} L ${m.x - r * 0.48} ${m.y + r * 0.52}`}
                    strokeWidth={r * 0.18}
                  />
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
          {model.nodes.map((node) => {
            const p = at(node);
            return (
              <g
                key={node.id}
                className={`source-overlay-node is-${node.status} ${selected === node.id ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}: ${(family === 'circuit' ? CIRCUIT_STATUS_WORDS : STATUS_WORDS)[node.status]}${node.distance === null ? '' : family === 'circuit' ? `, voltage ${node.distance} V` : `, distance ${node.distance}`}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => keyActivate(event, () => onSelect(node.id))}
              >
                <circle cx={p.x} cy={p.y} r={r * 1.25} className="source-overlay-target" />
                {node.status !== 'unreached' && node.status !== 'waiting' && (
                  <path
                    key="solid"
                    d={loopPath(p.x, p.y, r * 1.22, node.id)}
                    className="source-overlay-loop"
                    pathLength={1}
                    strokeWidth={r * (node.status === 'current' ? 0.12 : 0.08)}
                    style={sequence.size && node.id === model.lift?.goal ? { animationDelay: routeDone } : undefined}
                  />
                )}
              </g>
            );
          })}
          {model.weights.map((w) => {
            const p = at(w);
            return (
              <g key={`w-${w.edgeId}`} className="source-overlay-weight" transform={`translate(${p.x} ${p.y})`}>
                <rect x={-font * 2.2} y={-font * 0.85} width={font * 4.4} height={font * 1.7} rx={4} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={font}>
                  {w.text}
                </text>
              </g>
            );
          })}
          {model.tags.map((tag) => {
            const p = at(tag),
              anchor = at(tag.anchor),
              measured = textWidth(tag.text, font),
              w = measured === null ? tagBox(tag.text, font).w : measured + font * 1.1,
              h = tagBox(tag.text, font).h;
            const dx = p.x - anchor.x,
              dy = p.y - anchor.y,
              dist = Math.hypot(dx, dy) || 1;
            const end = { x: anchor.x + (dx / dist) * r * 1.05, y: anchor.y + (dy / dist) * r * 1.05 };
            const start = {
              x: Math.max(p.x - w / 2, Math.min(p.x + w / 2, end.x)),
              y: end.y < p.y ? p.y - h / 2 : p.y + h / 2,
            };
            const bend = {
              x: (start.x + end.x) / 2 + (end.y - start.y) * 0.25,
              y: (start.y + end.y) / 2 - (end.x - start.x) * 0.25,
            };
            const lead = tag.curved
              ? `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`
              : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
            return (
              <g
                key={tag.id}
                className={`source-overlay-tag is-${tag.tone}${tag.quiet ? ' is-quiet' : ''}`}
                style={sequence.size && (tag.tone === 'route' || atGoal(tag.anchor)) ? { animationDelay: routeDone } : undefined}
              >
                <path
                  d={lead}
                  className="source-overlay-leader"
                  pathLength={1}
                  markerEnd={tag.curved ? 'url(#source-overlay-arrow)' : undefined}
                  style={sequence.size && (tag.tone === 'route' || atGoal(tag.anchor)) ? { animationDelay: routeDone } : undefined}
                />
                {!tag.curved && <circle cx={end.x} cy={end.y} r={3.2} className="source-overlay-dot" />}
                <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={3} />
                <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={font}>
                  {tag.text}
                </text>
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
          <span className="source-overlay-caption-title">{model.caption.stepLabel}</span>
          {' '}
          {model.caption.text}
        </figcaption>
      )}
    </figure>
  );
}
