'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ExplorationSearchStage } from './exploration-search-stage';
import { useExplorationMotion } from './exploration-motion';
import { diagramLayout, diagramEdgeLabels } from '@/lib/domain/exploration-layout';
import { routeCost } from '@/lib/domain/cost-probe';
import { beatProgress } from '@/lib/domain/exploration-motion';
import {
  runBfs,
  type BfsInput,
  type BfsExecution,
  type BfsStep,
  type ExplorationPanel,
  type ExplorationSpec,
} from '@/lib/domain/exploration';

export {
  initialExplorationState,
  explorationExecution,
  explorationInputsChanged,
  explorationVisibleCaption,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';
import {
  comparisonExecution,
  explorationExecution,
  explorationInputsChanged,
  explorationVisibleCaption,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';
const nodeName = (input: BfsInput, id: string | null) =>
  input.nodes.find((node) => node.id === id)?.label ?? 'None';

function DiagramPanel({
  panel,
  selected,
  onSelect,
  highlights,
  progress,
}: {
  panel: Extract<ExplorationPanel, { kind: 'diagram' }>;
  selected: string | null;
  onSelect: (id: string) => void;
  highlights: string[];
  progress: number;
}) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const layout = diagramLayout(panel, compact, availableWidth);
  const edgeLabels = diagramEdgeLabels(panel, layout);
  const markerId = useId().replace(/[^a-z0-9]/gi, '');
  const nodes = panel.objects.filter(
    (object) => object.kind === 'node' || object.kind === 'block',
  );
  const pos = (id: string) => layout.positions.find((node) => node.id === id)!;
  return (
    <div ref={container} className="exploration-diagram-container">
      <svg
        className="exploration-graph"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        data-diagram-progress={progress.toFixed(3)}
        role="img"
        aria-label={`${panel.title}. Select labeled objects below to ask a follow-up.`}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {panel.objects
          .filter((object) => object.kind === 'edge')
          .map((edge) => {
            const from = pos(edge.from),
              to = pos(edge.to),
              dx = to.x - from.x,
              dy = to.y - from.y,
              length = Math.hypot(dx, dy) || 1,
              ux = dx / length,
              uy = dy / length;
            const inset = (id: string) =>
              nodes.find((node) => node.id === id)?.kind === 'block'
                ? Math.min(
                    layout.cardWidth / 2 / (Math.abs(ux) || 0.0001),
                    layout.cardHeight / 2 / (Math.abs(uy) || 0.0001),
                  ) + 4
                : 1 /
                    Math.sqrt(
                      Math.max(
                        0.000001,
                        (ux / (layout.cardWidth / 2)) ** 2 +
                          (uy / (layout.cardHeight / 2)) ** 2,
                      ),
                    ) +
                  4;
            const start = inset(edge.from),
              end = inset(edge.to);
            const loop = edge.from === edge.to;
            return (
              <g key={edge.id}>
                <path
                  fill="none"
                  data-diagram-edge={edge.id}
                  className={`exploration-edge ${highlights.includes(edge.id) ? 'is-highlighted' : ''}`}
                  d={
                    loop
                      ? `M ${from.x - 32} ${from.y - 34} C ${from.x - 85} ${from.y - 82},${from.x + 85} ${from.y - 82},${from.x + 32} ${from.y - 34}`
                      : `M ${from.x + ux * start} ${from.y + uy * start} L ${to.x - ux * end} ${to.y - uy * end}`
                  }
                  markerEnd={edge.directed ? `url(#${markerId})` : undefined}
                />
                {highlights.includes(edge.id) && progress > 0 && progress < 1 && !loop && (
                  <circle
                    data-diagram-signal={edge.id}
                    cx={
                      from.x +
                      ux * start +
                      (to.x - ux * end - from.x - ux * start) *
                        beatProgress(progress, 0.08, 0.92)
                    }
                    cy={
                      from.y +
                      uy * start +
                      (to.y - uy * end - from.y - uy * start) *
                        beatProgress(progress, 0.08, 0.92)
                    }
                    r="5"
                    fill="var(--accent)"
                  />
                )}
              </g>
            );
          })}
        {edgeLabels
          .filter((label) => !label.legend)
          .map((label) => (
            <g key={label.id} data-diagram-label={label.id}>
              <rect
                x={label.x - label.width / 2}
                y={label.y - 12}
                width={label.width}
                height="24"
                rx="7"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">
                {label.text}
              </text>
            </g>
          ))}
        {nodes.map((node) => {
          const point = pos(node.id);
          return (
            <g
              key={node.id}
              opacity="1"
              transform={`translate(${point.x},${point.y})`}
              className={`exploration-node ${selected === node.id || highlights.includes(node.id) ? 'is-selected' : ''}`}
              onClick={() => onSelect(node.id)}
            >
              {node.kind === 'block' ? (
                <rect
                  x={-layout.cardWidth / 2}
                  y={-layout.cardHeight / 2}
                  width={layout.cardWidth}
                  height={layout.cardHeight}
                  rx="10"
                />
              ) : (
                <ellipse rx={layout.cardWidth / 2} ry={layout.cardHeight / 2} />
              )}
              <foreignObject
                x={-layout.cardWidth / 2 + 6}
                y={-layout.cardHeight / 2 + 6}
                width={layout.cardWidth - 12}
                height={layout.cardHeight - 12}
              >
                <div className="exploration-diagram-label">{node.label}</div>
              </foreignObject>
            </g>
          );
        })}
        {layout.notes.map((object) => (
          <foreignObject
            key={object.id}
            x="20"
            y={object.y}
            width={layout.width - 40}
            height={object.height}
          >
            <div className="exploration-diagram-note">{object.text}</div>
          </foreignObject>
        ))}
      </svg>
      {edgeLabels.some((label) => label.legend) && (
        <ul className="exploration-diagram-label-legend" aria-label="Diagram connection labels">
          {edgeLabels
            .filter((label) => label.legend)
            .map((label) => {
              const edge = panel.objects.find((o) => o.id === label.id);
              return (
                <li key={label.id}>
                  {edge?.kind === 'edge'
                    ? nodes.find((n) => n.id === edge.from)?.label +
                      ' → ' +
                      nodes.find((n) => n.id === edge.to)?.label +
                      ': '
                    : ''}
                  {label.text}
                </li>
              );
            })}
        </ul>
      )}
      <details className="exploration-diagram-inspector">
        <summary>Inspect diagram</summary>
        <div className="exploration-object-buttons" aria-label="Select a diagram object">
          {nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              aria-pressed={selected === node.id}
              onClick={() => onSelect(node.id)}
            >
              {node.label}
            </button>
          ))}
        </div>
        <details>
          <summary>Diagram in words</summary>
          <ul>
            {panel.objects.map((object) => (
              <li key={object.id}>
                {object.kind === 'node' || object.kind === 'block'
                  ? object.label
                  : object.kind === 'text'
                    ? object.text
                    : `${nodes.find((node) => node.id === object.from)?.label} ${object.directed ? 'points to' : 'connects to'} ${nodes.find((node) => node.id === object.to)?.label}${object.label ? `: ${object.label}` : ''}`}
              </li>
            ))}
          </ul>
        </details>
      </details>
    </div>
  );
}

function StateTable({ execution, step }: { execution: BfsExecution; step: BfsStep }) {
  return (
    <div className="exploration-table-scroll">
      <table className="exploration-state-table">
        <caption>State after step {step.index}</caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">State</th>
            <th scope="col">Distance</th>
            <th scope="col">Parent</th>
          </tr>
        </thead>
        <tbody>
          {execution.input.nodes.map((node) => (
            <tr key={node.id}>
              <th scope="row">{node.label}</th>
              <td>
                {step.current === node.id
                  ? 'Current'
                  : step.queue.includes(node.id)
                    ? 'In queue'
                    : step.expanded.includes(node.id)
                      ? 'Expanded'
                      : 'Not reached'}
              </td>
              <td>{step.distances[node.id] ?? '—'}</td>
              <td>{nodeName(execution.input, step.parents[node.id] ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExplorationScene({
  spec,
  state,
  onChange,
  playing = false,
  spokenProgress = null,
  experiment,
  experimentInline = false,
}: {
  experiment?: ReactNode;
  experimentInline?: boolean;
  spec: ExplorationSpec;
  state: ExplorationViewState;
  onChange: (next: ExplorationViewState) => void;
  playing?: boolean;
  spokenProgress?: number | null;
}) {
  const [compact, setCompact] = useState(false),
    [activeGraph, setActiveGraph] = useState<'primary' | 'comparison'>('primary');
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const { selectedObjectId: _selected, ...motionState } = state;
  const motionKey = JSON.stringify([spec.id, spec.version, motionState]);
  const progress = useExplorationMotion(motionKey, playing, spokenProgress);
  if (spec.mode === 'clarify')
    return (
      <div className="exploration-clarify">
        <h3>A little more context</h3>
        <p>{spec.question}</p>
      </div>
    );
  const execution = explorationExecution(spec, state),
    comparison = comparisonExecution(spec, state);
  const step = execution?.steps[Math.min(state.step, execution.steps.length - 1)],
    explanation = spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)];
  const changed = explorationInputsChanged(spec, state),
    highlights = changed
      ? []
      : spec.mode === 'explanation'
        ? explanation.highlightIds
        : (spec.steps.find(
            (item) => item.execution !== null && item.executionStep === state.step,
          )?.highlightIds ?? []);
  const authoredStep = !changed
    ? spec.steps.find(
        (item) => item.execution === 'primary' && item.executionStep === state.step,
      )
    : undefined;
  const finalStep = Math.max(execution?.steps.length ?? 1, comparison?.steps.length ?? 1) - 1;
  const select = (selectedObjectId: string) => onChange({ ...state, selectedObjectId });
  const panels = spec.scene.panels;
  const heroDiagram =
    spec.mode === 'explanation' ? panels.find((panel) => panel.kind === 'diagram') : undefined;
  const graphs = panels.filter((panel) => panel.kind === 'graph');
  const singleSearch = compact || spec.mode === 'checked-dijkstra';
  const graphSummary = (which: 'primary' | 'comparison', computed: BfsExecution) => {
    const current = computed.steps[Math.min(state.step, computed.steps.length - 1)];
    return (
      <button
        type="button"
        aria-pressed={activeGraph === which}
        onClick={() => setActiveGraph(which)}
      >
        <strong>
          {computed.modelId === 'dijkstra-nonnegative' ? 'Dijkstra' : 'BFS'} ·{' '}
          {routeCost(computed.input, computed.path) ?? 'unreachable'}
        </strong>
        <span className="meta">
          {current.status === 'found' ? (
            <span role="status">
              Route: {computed.path?.map((id) => nodeName(computed.input, id)).join(' → ')} ·
              total cost {routeCost(computed.input, computed.path)} ·{' '}
              {computed.path!.length - 1} edges
            </span>
          ) : computed.modelId === 'dijkstra-nonnegative' ? (
            'Full route · lowest cost'
          ) : (
            'Full route · fewest edges'
          )}
        </span>
      </button>
    );
  };
  const experimentRow = Math.max(...graphs.map((panel) => panel.placement.row), 0) + 1;
  const renderPanel = (panel: ExplorationPanel) => {
    const computation =
      panel.kind === 'graph' || panel.kind === 'frontier' || panel.kind === 'state-table'
        ? panel.execution === 'comparison'
          ? comparison
          : execution
        : null;
    const current = computation?.steps[Math.min(state.step, computation.steps.length - 1)];
    const combined =
      panel.kind === 'frontier' && graphs.some((graph) => graph.execution === panel.execution);
    const mainGraph = panel.kind === 'graph' && (graphs.length === 1 || singleSearch);
    return (
      <section
        key={panel.id}
        className={`${combined ? 'sr-only' : ''} exploration-panel exploration-panel-${panel.kind} ${highlights.includes(panel.id) ? 'is-highlighted' : ''}`}
        style={{
          gridColumn:
            mainGraph || panel === heroDiagram
              ? '1 / span 2'
              : `${panel.placement.column} / span ${panel.placement.columnSpan}`,
          gridRow:
            panel === heroDiagram
              ? 'auto'
              : experiment && panel.placement.row >= experimentRow
                ? panel.placement.row + 1
                : panel.placement.row,
        }}
        aria-label={panel.title}
      >
        <h3>{panel.title}</h3>
        {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
          ['sequence', 'matrix', 'diagram', 'callout'].includes(panel.kind) && (
            <p className="meta">
              Illustration for this explanation. The search controls update the graph and
              frontier.
            </p>
          )}
        {panel.kind === 'sequence' && (
          <ol className="exploration-tiles" aria-label={panel.title}>
            {panel.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={state.selectedObjectId === item.id}
                  className={highlights.includes(item.id) ? 'is-highlighted' : ''}
                  onClick={() => select(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        )}
        {panel.kind === 'matrix' && (
          <div className="exploration-table-scroll">
            <table className="exploration-matrix">
              <caption>{panel.title}</caption>
              <tbody>
                {panel.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {panel.kind === 'callout' && (
          <aside className={`exploration-callout ${panel.tone}`}>
            <span className="overline">
              {panel.tone === 'idea' ? 'Key idea' : 'Assumption'}
            </span>
            <p>{panel.text}</p>
          </aside>
        )}
        {panel.kind === 'graph' && computation && (
          <ExplorationSearchStage
            progress={state.step >= computation.steps.length ? 1 : progress}
            panel={panel}
            execution={computation}
            index={state.step}
            selected={state.selectedObjectId}
            onSelect={select}
            highlights={highlights}
          />
        )}
        {panel.kind === 'diagram' && (
          <DiagramPanel
            progress={progress}
            panel={panel}
            selected={state.selectedObjectId}
            onSelect={select}
            highlights={highlights}
          />
        )}
        {panel.kind === 'frontier' && computation && current && (
          <>
            <p className="meta">
              {computation.modelId === 'dijkstra-nonnegative'
                ? 'Lowest tentative cost first'
                : 'First in → first out'}
            </p>
            <ol className="exploration-frontier" aria-label={`${panel.title} queue`}>
              {current.queue.map((id, index) => (
                <li key={id}>
                  <span>{index === 0 ? 'Next' : index + 1}</span>
                  <strong>{nodeName(computation.input, id)}</strong>
                </li>
              ))}
            </ol>
            {!current.queue.length && <p>Queue empty</p>}
          </>
        )}
        {panel.kind === 'state-table' &&
          computation &&
          current &&
          (experiment ? (
            <details>
              <summary>Inspect checked node costs</summary>
              <StateTable execution={computation} step={current} />
            </details>
          ) : (
            <StateTable execution={computation} step={current} />
          ))}
        {panel.kind === 'text' && <p>{panel.text}</p>}
        {panel.kind === 'steps' &&
          (changed ? (
            <p>
              The inputs changed. The queue and captions now show the recomputed search; the
              original authored steps are paused.
            </p>
          ) : (
            <ol className="exploration-explanation-steps">
              {spec.steps.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={state.explanationStep === index ? 'step' : undefined}
                    onClick={() =>
                      onChange({
                        ...state,
                        explanationStep: index,
                        ...(item.executionStep !== null ? { step: item.executionStep } : {}),
                      })
                    }
                  >
                    {item.caption}
                  </button>
                </li>
              ))}
            </ol>
          ))}
      </section>
    );
  };
  return (
    <>
      {spec.mode === 'explanation' && (
        <div className="exploration-explanation-navigation">
          <div className="exploration-step-bar">
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                disabled={state.explanationStep === 0}
                onClick={() =>
                  onChange({
                    ...state,
                    explanationStep: state.explanationStep - 1,
                  })
                }
              >
                Previous explanation
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={state.explanationStep >= spec.steps.length - 1}
                onClick={() =>
                  onChange({
                    ...state,
                    explanationStep: state.explanationStep + 1,
                  })
                }
              >
                Next explanation
              </button>
            </div>
          </div>
          <p
            className="exploration-active-explanation"
            role="status"
            aria-live={playing ? 'off' : 'polite'}
          >
            <span className="overline">
              Explanation {state.explanationStep + 1} of {spec.steps.length}
            </span>
            {spec.steps[state.explanationStep].narration ||
              spec.steps[state.explanationStep].caption}
          </p>
        </div>
      )}
      {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
        execution &&
        spec.controls.includes('step') && (
          <div className="exploration-step-bar">
            <div className="action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={state.step <= 0}
                onClick={() => onChange({ ...state, step: Math.max(0, state.step - 1) })}
              >
                Previous explanation
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={state.step >= finalStep}
                onClick={() => onChange({ ...state, step: state.step + 1 })}
              >
                Next step
              </button>
              <span className="meta">
                Step {Math.min(state.step, finalStep)} / {finalStep}
              </span>
              {singleSearch && experimentInline && experiment}
            </div>
          </div>
        )}
      {singleSearch && execution && comparison && (
        <div className="exploration-comparison-switch" aria-label="Choose search to inspect">
          {graphSummary('primary', execution)}
          {graphSummary('comparison', comparison)}
        </div>
      )}
      <div
        className={`exploration-scene exploration-layout-${spec.scene.layout}`}
        aria-label="Generated visual composition"
      >
        {heroDiagram ? (
          <>
            {renderPanel(heroDiagram)}
            <details className="exploration-supporting-panels">
              <summary>Steps, numbers & context</summary>
              <div className="exploration-scene">
                {panels.filter((panel) => panel !== heroDiagram).map(renderPanel)}
              </div>
            </details>
          </>
        ) : singleSearch && execution ? (
          <>
            {graphs
              .filter((panel) => panel.execution === (comparison ? activeGraph : 'primary'))
              .map(renderPanel)}
            {experiment && !experimentInline && (
              <div className="exploration-experiment-slot">{experiment}</div>
            )}
            <details className="exploration-scene-details">
              <summary>Explanation & checked state</summary>
              <div className="exploration-scene">
                {panels
                  .filter((panel) => panel.kind !== 'graph' && panel.kind !== 'frontier')
                  .map(renderPanel)}
              </div>
            </details>
          </>
        ) : experiment ? (
          <>
            {graphs.map(renderPanel)}
            <div
              className="exploration-experiment-slot"
              style={{ gridColumn: '1 / -1', gridRow: experimentRow }}
            >
              {experiment}
            </div>
            {panels.filter((panel) => panel.kind !== 'graph').map(renderPanel)}
          </>
        ) : (
          panels.map(renderPanel)
        )}
      </div>
      {execution && (
        <div className="exploration-caption" aria-live="polite">
          <span className="overline">
            {execution
              ? `Search step ${step?.index ?? 0}`
              : `Explanation ${state.explanationStep + 1} of ${spec.steps.length}`}
          </span>
          <p>{explorationVisibleCaption(spec, state)}</p>
          {authoredStep && (
            <p className="exploration-authored-caption">
              Soma’s explanation: {authoredStep.caption}
            </p>
          )}
        </div>
      )}
      {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') && execution && (
        <details className="exploration-controls-disclosure" open={!compact}>
          <summary>Change the experiment</summary>
          <div className="exploration-controls" aria-label="Search controls">
            {spec.controls.includes('replay') && (
              <button
                className="text-button"
                type="button"
                onClick={() => onChange({ ...state, step: 0, explanationStep: 0 })}
              >
                Restart search
              </button>
            )}
            <div className="exploration-inputs">
              {spec.controls.includes('set-start') && (
                <label>
                  Start node
                  <select
                    value={state.start ?? spec.input.start}
                    onChange={(event) =>
                      onChange({
                        ...state,
                        start: event.target.value,
                        step: 0,
                      })
                    }
                  >
                    {spec.input.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {spec.controls.includes('set-goal') && (
                <label>
                  Goal node
                  <select
                    value={state.goal ?? ''}
                    onChange={(event) =>
                      onChange({
                        ...state,
                        goal: event.target.value || null,
                        step: 0,
                      })
                    }
                  >
                    <option value="">Explore every reachable node</option>
                    {spec.input.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {spec.controls.includes('reverse-neighbor-order') && (
              <button
                className="secondary-button"
                type="button"
                aria-pressed={state.reversed}
                onClick={() => onChange({ ...state, reversed: !state.reversed, step: 0 })}
              >
                Reverse neighbor order
              </button>
            )}
            {spec.controls.includes('toggle-edge') && (
              <details>
                <summary>Change a connection</summary>
                <p className="meta">Recomputes this experiment. Your source stays unchanged.</p>
                <div className="exploration-edge-controls">
                  {spec.input.edges.map((edge) => (
                    <label key={edge.id}>
                      <input
                        type="checkbox"
                        checked={!state.disabledEdgeIds.includes(edge.id)}
                        onChange={() =>
                          onChange({
                            ...state,
                            step: 0,
                            disabledEdgeIds: state.disabledEdgeIds.includes(edge.id)
                              ? state.disabledEdgeIds.filter((id) => id !== edge.id)
                              : [...state.disabledEdgeIds, edge.id],
                          })
                        }
                      />
                      {nodeName(spec.input, edge.from)} {spec.input.directed ? '→' : '—'}{' '}
                      {nodeName(spec.input, edge.to)}
                    </label>
                  ))}
                </div>
              </details>
            )}
            <details>
              <summary>Search state in a table</summary>
              <StateTable execution={execution} step={step!} />
            </details>
            <p className="meta">
              {spec.mode === 'checked-dijkstra'
                ? 'Nonnegative weighted graph · settle lowest tentative cost · stop when goal is settled.'
                : 'Unweighted graph · visited when added to queue · stop when goal leaves queue.'}
            </p>
          </div>
        </details>
      )}
    </>
  );
}
