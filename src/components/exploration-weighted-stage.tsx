'use client';

import { useId, useMemo } from 'react';
import type { BfsExecution, ExplorationPanel } from '@/lib/domain/exploration';
import { beatProgress, easeMotion, weightedMotionFrame } from '@/lib/domain/exploration-motion';
import { weightedGraphLayout } from '@/lib/domain/weighted-graph-layout';
import { routeCost } from '@/lib/domain/cost-probe';

export function ExplorationWeightedStage({
  panel,
  execution,
  index,
  selected,
  onSelect,
  width,
  progress,
  compact,
}: {
  panel: Extract<ExplorationPanel, { kind: 'graph' }>;
  execution: BfsExecution;
  index: number;
  selected: string | null;
  onSelect: (id: string) => void;
  width: number;
  progress: number;
  compact: boolean;
}) {
  // The animation clock changes every frame; geometry only changes with inputs.
  const geometryKey = JSON.stringify([panel.positions, execution.input, width]);
  const layout = useMemo(() => weightedGraphLayout(panel, execution.input, width), [geometryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const marker = useId().replace(/[^a-z0-9]/gi, '');
  const frame = weightedMotionFrame(execution, index, progress);
  const { step } = frame;
  const weighted = execution.modelId === 'dijkstra-nonnegative';
  const name = (id: string) => execution.input.nodes.find((n) => n.id === id)?.label ?? id;
  const onPath = (from: string, to: string) =>
    frame.path?.some(
      (id, i) =>
        i < frame.path!.length - 1 &&
        ((id === from && frame.path![i + 1] === to) ||
          (!execution.input.directed && id === to && frame.path![i + 1] === from)),
    );
  return (
    <>
      <p className="exploration-weighted-caption" aria-live="off">
        {frame.caption}
      </p>
      <svg
        className="exploration-graph exploration-weighted-stage"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`${panel.title}. ${weighted ? 'Lowest tentative cost' : 'FIFO ignoring weights'}. ${frame.caption}`}
        data-motion-progress={progress.toFixed(3)}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-2)" />
          </marker>
        </defs>
        {layout.edges.map((edge) => {
          const path = Boolean(onPath(edge.from, edge.to));
          const cue = frame.cues.find(
            (c) =>
              (c.from === edge.from && c.id === edge.to) ||
              (!execution.input.directed && c.from === edge.to && c.id === edge.from),
          );
          const trace = path
            ? beatProgress(progress, 0.85, 1)
            : cue
              ? beatProgress(progress, cue.start, cue.end)
              : 0;
          const reverse = path
            ? frame.path!.some((id, i) => id === edge.to && frame.path![i + 1] === edge.from)
            : cue?.from === edge.to;
          return (
            <g key={edge.id} data-edge={edge.id} data-in-path={path}>
              <path
                d={edge.path}
                fill="none"
                stroke="var(--ink-2)"
                strokeWidth="2"
                data-arrowhead={execution.input.directed ? edge.id : undefined}
                markerEnd={execution.input.directed ? `url(#${marker})` : undefined}
              />
              {trace > 0 && (
                <path
                  d={reverse ? edge.reversePath : edge.path}
                  fill="none"
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset={1 - trace}
                  stroke={path ? 'var(--success-fg)' : 'var(--accent)'}
                  strokeWidth="4"
                  data-weighted-trace={edge.id}
                />
              )}
            </g>
          );
        })}
        {layout.labels
          .filter((label) => !label.legend)
          .map((label) => (
            <g key={label.id} data-cost-label={label.id}>
              <line
                x1={label.anchor.x}
                y1={label.anchor.y}
                x2={label.x}
                y2={label.y}
                stroke="var(--control-border)"
                strokeWidth="1"
              />
              <rect
                x={label.x - label.width / 2}
                y={label.y - 11}
                width={label.width}
                height="22"
                rx="7"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">
                {label.text}
              </text>
            </g>
          ))}
        {layout.nodes.map((node) => {
          const current = frame.current === node.id,
            expanded = frame.expanded.includes(node.id);
          return (
            <g key={node.id} data-weighted-node={node.id} onClick={() => onSelect(node.id)}>
              <rect
                x={node.x - node.width / 2}
                y={node.y - node.height / 2}
                width={node.width}
                height={node.height}
                rx="12"
                fill={
                  current ? 'var(--accent-soft)' : expanded ? 'var(--success-bg)' : 'var(--surface)'
                }
                stroke={current || selected === node.id ? 'var(--accent)' : 'var(--control-border)'}
                strokeWidth={current ? 3 : 1.5}
              />
              <foreignObject
                x={node.x - node.width / 2 + 4}
                y={node.y - node.height / 2 + 4}
                width={node.width - 8}
                height={node.height - 8}
              >
                <div className="exploration-weighted-node-label">
                  <strong>{node.label}</strong>
                  <span>
                    {weighted ? 'cost' : 'hops'}: {frame.distances[node.id] ?? '∞'}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      {layout.labels.some((label) => label.legend) && (
        <ul className="exploration-edge-legend" aria-label="Crowded connection costs">
          {layout.labels
            .filter((label) => label.legend)
            .map((label) => {
              const edge = layout.edges.find((edge) => edge.id === label.id)!;
              return (
                <li key={label.id}>
                  {name(edge.from)} {execution.input.directed ? '→' : '—'} {name(edge.to)}:{' '}
                  {label.text}
                </li>
              );
            })}
        </ul>
      )}
      <p className="meta exploration-queue-kind">
        {weighted ? 'Priority queue · lowest tentative cost first' : 'FIFO queue · ignores costs'}
      </p>
      <ol
        className="exploration-frontier exploration-weighted-frontier"
        aria-label={`${panel.title} queue`}
      >
        {step.queue.map((id, i) => {
          const old = frame.previous.queue.indexOf(id),
            move = easeMotion(beatProgress(progress, 0.28, 0.9));
          return (
            <li
              key={id}
              style={{
                transform: `translateX(${old < 0 ? 0 : (old - i) * 80 * (1 - move)}px)`,
                opacity: old < 0 ? move : 1,
              }}
            >
              <strong>{name(id)}</strong>
              <span>{weighted ? (frame.distances[id] ?? '∞') : ''}</span>
            </li>
          );
        })}
      </ol>
      {step.status === 'found' && (
        <p className="exploration-stage-route">
          Route: {execution.path?.map(name).join(' → ')} · total cost{' '}
          {routeCost(execution.input, execution.path)} · {execution.path!.length - 1} edges
        </p>
      )}
      <details className="exploration-graph-details" open={!compact}>
        <summary>Select a node</summary>
        <div className="exploration-object-buttons">
          {execution.input.nodes.map((n) => (
            <button
              type="button"
              key={n.id}
              aria-pressed={selected === n.id}
              onClick={() => onSelect(n.id)}
            >
              Node {n.label}
            </button>
          ))}
        </div>
        <ul className="exploration-edge-legend" aria-label="Connections and costs">
          {layout.edges.map((edge) => (
            <li key={edge.id}>
              {name(edge.from)} {execution.input.directed ? '→' : '—'} {name(edge.to)}:{' '}
              {edge.weight ?? 1}
              {layout.labels.find((l) => l.id === edge.id)?.legend
                ? ' (cost shown here to avoid a crowded label)'
                : ''}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
