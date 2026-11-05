import { useMemo } from 'react';
import type { ExplorationSpec } from '@/lib/domain/exploration';
import {
  circuitQuantity,
  circuitSolution,
  comparisonExecution,
  explorationExecution,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';

function checkedValues(
  spec: ExplorationSpec,
  state: ExplorationViewState,
  which: 'primary' | 'comparison',
) {
  if (spec.mode === 'checked-circuit') {
    const solution = circuitSolution(spec, state);
    if (!solution || solution.status !== 'solved') return null;
    const step = solution.steps[Math.min(state.step, solution.steps.length - 1)];
    const ground = spec.input.nodes.find((node) => node.id === spec.input.ground)!.label;
    return {
      title: 'Node voltages',
      label: 'Current node voltages',
      note: `Relative to ${ground} (ground)`,
      entries: spec.input.nodes.map((node) => {
        const value = solution.voltages[node.id];
        return {
          id: node.id,
          label: node.label,
          value: !step.revealedNodes.includes(node.id)
            ? 'Not revealed'
            : value === null
              ? 'Cut off from ground'
              : circuitQuantity(value, 'V'),
        };
      }),
    };
  }
  const execution =
    which === 'comparison' ? comparisonExecution(spec, state) : explorationExecution(spec, state);
  if (!execution) return null;
  const step = execution.steps[Math.min(state.step, execution.steps.length - 1)];
  const weighted = execution.modelId === 'dijkstra-nonnegative';
  let tentative = false;
  const entries = execution.input.nodes.map((node) => {
    const distance = step.distances[node.id];
    if (!Number.isFinite(distance)) return { id: node.id, label: node.label, value: 'Unreached' };
    const pending =
      weighted && node.id !== execution.input.start && !step.expanded.includes(node.id);
    tentative ||= pending;
    return { id: node.id, label: node.label, value: `${pending ? '≤ ' : ''}${distance}` };
  });
  const title = weighted ? 'Dijkstra distances' : 'BFS hop distances';
  return { title, label: `Current ${title}`, note: tentative ? '≤ tentative' : null, entries };
}

/** A text companion to both height renderers, using the same checked reveal state. */
export default function SpatialHeightReadout({
  spec,
  state,
  which,
}: {
  spec: ExplorationSpec;
  state: ExplorationViewState;
  which: 'primary' | 'comparison';
}) {
  // Camera, separation and selection must not trigger another numerical solve.
  const computationKey = JSON.stringify([
    state.step,
    state.start,
    state.goal,
    state.disabledEdgeIds,
    state.reversed,
    state.edgeWeights,
  ]);
  const readout = useMemo(() => checkedValues(spec, state, which), [spec, computationKey, which]);
  if (!readout) return null;
  return (
    <div className="spatial-height-readout" role="group" aria-label={readout.label}>
      <p>
        {readout.title}
        {readout.note && <span>{readout.note}</span>}
      </p>
      <dl>
        {readout.entries.map((entry) => (
          <div key={entry.id} data-height-node={entry.id}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
