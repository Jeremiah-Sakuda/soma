'use client';
import { useEffect, useId, useState } from 'react';
import type { BfsExecution, ExplorationPanel } from '@/lib/domain/exploration';
import { beatProgress, easeMotion, searchMotionFrame } from '@/lib/domain/exploration-motion';
import { ExplorationWeightedStage } from './exploration-weighted-stage';

type Point = { x: number; y: number };
const mix = (from: Point, to: Point, p: number) => ({
  x: from.x + (to.x - from.x) * easeMotion(p),
  y: from.y + (to.y - from.y) * easeMotion(p),
});
export function ExplorationSearchStage({
  panel,
  execution,
  index,
  selected,
  onSelect,
  highlights,
  progress,
}: {
  panel: Extract<ExplorationPanel, { kind: 'graph' }>;
  execution: BfsExecution;
  index: number;
  selected: string | null;
  onSelect: (id: string) => void;
  highlights: string[];
  progress: number;
}) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = matchMedia('(max-width: 760px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const width = compact ? 380 : 640,
    columns = compact ? 4 : 8;
  const marker = useId().replace(/[^a-z0-9]/gi, ''),
    frame = searchMotionFrame(execution, index, progress),
    { plan } = frame;
  if (
    execution.modelId === 'dijkstra-nonnegative' ||
    execution.input.edges.some((e) => (e.weight ?? 1) !== 1)
  )
    return (
      <ExplorationWeightedStage
        panel={panel}
        execution={execution}
        index={index}
        selected={selected}
        onSelect={onSelect}
        width={compact ? 500 : 640}
        compact={compact}
        progress={progress}
      />
    );
  const xs = panel.positions.map((p) => p.x),
    ys = panel.positions.map((p) => p.y),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const name = (id: string) => execution.input.nodes.find((node) => node.id === id)?.label ?? id;
  const short = (id: string) => (name(id).length > 6 ? name(id).slice(0, 4) + '…' : name(id));
  // Nodes are pills sized to their full name; long names widen the node, never truncate.
  const fontSize = compact ? 12 : 14;
  const labelWidth = (id: string) => Math.ceil(name(id).length * fontSize * 0.62) + 22;
  const inset = Math.max(
    55,
    ...execution.input.nodes.map((node) => labelWidth(node.id) / 2 + 6),
  );
  const point = (id: string) => {
    const p = panel.positions.find((p) => p.nodeId === id)!;
    return {
      x: inset + (maxX === minX ? 0.5 : (p.x - minX) / (maxX - minX)) * (width - 2 * inset),
      y: 48 + (maxY === minY ? 0.5 : (p.y - minY) / (maxY - minY)) * 190,
    };
  };
  const slot = (i: number) => ({
    x: 34 + ((i % columns) * (width - 40)) / columns,
    y: 354 + Math.floor(i / columns) * 58,
  });
  const points = execution.input.nodes.map((node) => point(node.id));
  const distances = points.flatMap((p, i) =>
    points.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y)),
  );
  const radius = Math.max(10, Math.min(25, (Math.min(...distances, 100) - 8) / 2));
  const nodeWidth = (id: string) => Math.max(radius * 2, labelWidth(id));
  // Where a connection meets a node: the circle for round nodes, the pill's box otherwise.
  const edgePoint = (center: Point, toward: Point, id: string) => {
    const dx = toward.x - center.x,
      dy = toward.y - center.y,
      length = Math.hypot(dx, dy) || 1;
    const halfWidth = nodeWidth(id) / 2;
    const t =
      halfWidth <= radius
        ? (radius + 5) / length
        : Math.min((halfWidth + 5) / (Math.abs(dx) || 0.001), (radius + 5) / (Math.abs(dy) || 0.001));
    return { x: center.x + dx * Math.min(t, 0.5), y: center.y + dy * Math.min(t, 0.5) };
  };
  const token = (id: string, position: Point, opacity = 1, kind = 'queue') => (
    <g
      key={`${kind}-${id}`}
      className={`exploration-moving-token ${kind}`}
      transform={`translate(${position.x},${position.y})`}
      opacity={opacity}
      data-token={id}
      data-motion={kind}
    >
      <rect x="-28" y="-20" width="56" height="40" rx="12" />
      <text textAnchor="middle" dominantBaseline="middle">
        <title>{name(id)}</title>
        {short(id)}
      </text>
    </g>
  );
  const queuedTokens = plan.retained.map((id, i) =>
    token(id, mix(slot(plan.before.indexOf(id)), slot(i), frame.departProgress)),
  );
  const arrivals = plan.arrivals.map((item) => {
    const p = beatProgress(progress, item.traceEnd, item.end);
    return token(
      item.id,
      mix(point(item.id), slot(item.slot), p),
      progress < item.traceEnd ? 0 : 1,
      'arrival',
    );
  });
  const height =
    332 +
    Math.max(1, Math.ceil(Math.max(plan.step.queue.length, plan.before.length) / columns)) * 58;
  return (
    <>
      <div className="exploration-stage-heading">
        <span className="overline">
          {panel.execution === 'comparison' ? 'Comparison' : 'Search in motion'}
        </span>
        <span className="meta">{progress < 1 ? 'Replaying this step' : 'Checked state'}</span>
      </div>
      <p className="exploration-motion-caption" aria-live="off">
        {frame.caption}
      </p>
      <svg
        className="exploration-graph exploration-search-stage"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${panel.title}. ${frame.caption} Use the object buttons to select a node.`}
        data-motion-progress={progress.toFixed(3)}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {execution.input.edges.map((edge) => {
          const from = point(edge.from),
            to = point(edge.to),
            length = Math.hypot(to.x - from.x, to.y - from.y);
          const start = edgePoint(from, to, edge.from),
            end = edgePoint(to, from, edge.to);
          const loop = from.y < 100 ? 1 : -1;
          const d =
            length === 0
              ? `M ${from.x - 12} ${from.y + loop * 18} C ${from.x - 58} ${from.y + loop * 65},${from.x + 58} ${from.y + loop * 65},${from.x + 12} ${from.y + loop * 18}`
              : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
          const arrival = plan.arrivals.find((item) => item.edgeId === edge.id),
            reverse = arrival && edge.to === arrival.from;
          const pathIndex = plan.path.findIndex(
            (id, i) =>
              i < plan.path.length - 1 &&
              ((edge.from === id && edge.to === plan.path[i + 1]) ||
                (!execution.input.directed && edge.to === id && edge.from === plan.path[i + 1])),
          );
          const trace = arrival
            ? beatProgress(progress, arrival.start, arrival.traceEnd)
            : pathIndex >= 0
              ? beatProgress(
                  progress,
                  0.32 + (pathIndex * 0.5) / Math.max(plan.path.length - 1, 1),
                  0.32 + ((pathIndex + 1) * 0.5) / Math.max(plan.path.length - 1, 1),
                )
              : 0;
          const traceD =
            reverse || (pathIndex >= 0 && edge.to === plan.path[pathIndex])
              ? `M ${end.x} ${end.y} L ${start.x} ${start.y}`
              : d;
          return (
            <g key={edge.id}>
              <path
                d={d}
                className={`exploration-edge ${selected === edge.id || highlights.includes(edge.id) ? 'is-selected' : ''}`}
                markerEnd={execution.input.directed ? `url(#${marker})` : undefined}
              />
              {trace > 0 && (
                <path
                  d={traceD}
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset={1 - trace}
                  className={`exploration-trace ${pathIndex >= 0 ? 'is-path' : ''}`}
                  data-trace={edge.id}
                />
              )}
            </g>
          );
        })}
        {execution.input.nodes.map((node) => {
          const position = point(node.id),
            current = plan.departing === node.id && frame.departProgress > 0.7,
            queued = frame.queue.includes(node.id),
            visited = plan.step.expanded.includes(node.id) && node.id !== plan.departing;
          return (
            <g
              key={node.id}
              transform={`translate(${position.x},${position.y})`}
              className={`exploration-node ${current ? 'is-current' : queued ? 'is-queued' : visited ? 'is-visited' : ''} ${selected === node.id || highlights.includes(node.id) ? 'is-selected' : ''}`}
              onClick={() => onSelect(node.id)}
            >
              {current && (
                <rect
                  className="exploration-focus-ring"
                  x={-nodeWidth(node.id) / 2 - 8}
                  y={-radius - 8}
                  width={nodeWidth(node.id) + 16}
                  height={radius * 2 + 16}
                  rx={radius + 8}
                />
              )}
              <rect
                className="exploration-node-shape"
                x={-nodeWidth(node.id) / 2}
                y={-radius}
                width={nodeWidth(node.id)}
                height={radius * 2}
                rx={radius}
              />
              <text textAnchor="middle" dominantBaseline="middle" style={{ fontSize }}>
                {name(node.id)}
              </text>
              <text className="exploration-node-state" y={radius + 20} textAnchor="middle">
                {current
                  ? plan.step.status === 'found'
                    ? 'Goal'
                    : progress < 1
                      ? 'Expanding'
                      : 'Expanded'
                  : queued
                    ? 'Queued'
                    : visited
                      ? 'Expanded'
                      : ''}
              </text>
            </g>
          );
        })}
        <rect
          className="exploration-queue-track"
          x="5"
          y="298"
          width={width - 10}
          height={height - 303}
          rx="18"
        />
        <text className="exploration-queue-label" x="16" y="320">
          FRONT OF QUEUE
        </text>
        <text className="exploration-queue-label" x={width - 16} y="320" textAnchor="end">
          {compact ? 'JOIN AT BACK' : 'NEW NODES JOIN AT THE BACK'}
        </text>
        {queuedTokens}
        {arrivals}
        {plan.departing &&
          frame.departProgress < 1 &&
          token(
            plan.departing,
            mix(slot(0), point(plan.departing), frame.departProgress),
            1 - beatProgress(frame.departProgress, 0.85, 1),
            'departure',
          )}
        {progress >= 1 && plan.step.queue.length === 0 && (
          <text x={width / 2} y="360" textAnchor="middle" className="exploration-empty-queue">
            Queue empty
          </text>
        )}
      </svg>
      <details className="exploration-graph-details">
        <summary>Select a node & inspect graph</summary>
        <div className="exploration-object-buttons" aria-label="Select a graph object">
          {execution.input.nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              aria-pressed={selected === node.id}
              onClick={() => onSelect(node.id)}
            >
              Node {node.label}
            </button>
          ))}
        </div>
        <p className="exploration-graph-configuration">
          Start: {name(execution.input.start)} · Goal:{' '}
          {execution.input.goal ? name(execution.input.goal) : 'All reachable nodes'}
        </p>
        <p className="exploration-graph-order">
          Neighbor order: {execution.input.neighborOrder.map(name).join(' → ')}
        </p>
      </details>
    </>
  );
}
