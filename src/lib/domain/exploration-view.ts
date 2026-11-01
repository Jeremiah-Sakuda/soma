import type { SpatialView } from './spatial-schema';
import { runBfs, type BfsInput, type BfsExecution, type ExplorationSpec } from './exploration';

export type ExplorationViewState = {
  step: number;
  explanationStep: number;
  start: string | null;
  goal: string | null;
  disabledEdgeIds: string[];
  reversed: boolean;
  selectedObjectId: string | null;
  edgeWeights?: Record<string, number>;
  spatial?: SpatialView;
};
export function initialExplorationState(spec: ExplorationSpec): ExplorationViewState {
  return {
    step: 0,
    explanationStep: 0,
    start:
      spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra' ? spec.input.start : null,
    goal: spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra' ? spec.input.goal : null,
    disabledEdgeIds: [],
    reversed: false,
    selectedObjectId: null,
  };
}
export function explorationExecution(
  spec: ExplorationSpec,
  state: ExplorationViewState,
): BfsExecution | null {
  if (spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') return null;
  return runBfs({
    ...spec.input,
    start: state.start ?? spec.input.start,
    goal: state.goal,
    edges: spec.input.edges
      .filter((edge) => !state.disabledEdgeIds.includes(edge.id))
      .map((edge) =>
        state.edgeWeights?.[edge.id] !== undefined
          ? { ...edge, weight: state.edgeWeights[edge.id] }
          : edge,
      ),
    neighborOrder: state.reversed
      ? [...spec.input.neighborOrder].reverse()
      : spec.input.neighborOrder,
  });
}
export function explorationInputsChanged(spec: ExplorationSpec, state: ExplorationViewState) {
  return (
    (spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
    ((state.start ?? spec.input.start) !== spec.input.start ||
      state.goal !== spec.input.goal ||
      state.disabledEdgeIds.length > 0 ||
      state.reversed ||
      Object.keys(state.edgeWeights ?? {}).length > 0)
  );
}
function executionCaption(execution: BfsExecution, index: number) {
  const step = execution.steps[Math.min(index, execution.steps.length - 1)];
  if (!step.current)
    return `${nodeName(execution.input, execution.input.start)} starts in the queue. No node has been expanded yet.`;
  // A cheaper route to a node that was already waiting is a checked change worth saying.
  const before = execution.steps[Math.max(0, Math.min(index, execution.steps.length - 1) - 1)];
  const cheaper =
    execution.modelId === 'dijkstra-nonnegative'
      ? Object.keys(step.distances).filter(
          (id) =>
            !step.discovered.includes(id) &&
            before.distances[id] !== undefined &&
            step.distances[id] < before.distances[id],
        )
      : [];
  return `${nodeName(execution.input, step.current)} ${execution.modelId === 'dijkstra-nonnegative' ? `is settled at cost ${step.distances[step.current]}` : 'leaves the front of the queue'}.${step.discovered.length ? ` Added ${step.discovered.map((id) => nodeName(execution.input, id)).join(', ')}.` : cheaper.length ? '' : ' No new nodes added.'}${cheaper.map((id) => ` ${nodeName(execution.input, id)} drops from ${before.distances[id]} to ${step.distances[id]}.`).join('')}${step.status === 'found' ? ' Goal reached.' : step.status === 'unreachable' ? ' The queue is empty; the goal is unreachable with these connections.' : step.status === 'complete' ? ' All reachable nodes have been explored.' : ''}`;
}
/** The inspected search's step in one sentence; the journal shows only this. */
export function explorationStepCaption(spec: ExplorationSpec, state: ExplorationViewState): string {
  if (spec.mode === 'clarify') return spec.question;
  const execution = explorationExecution(spec, state);
  if (!execution) return spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)].caption;
  return executionCaption(execution, state.step);
}
export function explorationVisibleCaption(
  spec: ExplorationSpec,
  state: ExplorationViewState,
): string {
  if (spec.mode === 'clarify') return spec.question;
  const execution = explorationExecution(spec, state);
  if (!execution) return spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)].caption;
  if ((spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') && spec.comparison)
  {
    const comparison = comparisonExecution(spec, state)!;
    const name = (computed: BfsExecution) =>
      computed.modelId === 'dijkstra-nonnegative' ? 'Dijkstra' : 'BFS';
    const [first, second] =
      name(execution) === name(comparison) ? ['This search', 'Comparison'] : [name(execution), name(comparison)];
    return `${first}: ${executionCaption(execution, state.step)} ${second}: ${executionCaption(comparison, state.step)}`;
  }
  return executionCaption(execution, state.step);
}

/** True when every number in an authored caption is one the solver produced for this run:
 * a distance at any step, an edge cost, the route's cost or length, or a step count. A
 * caption with any other number is replaced by the computed caption where it is drawn. */
export function captionIsGrounded(caption: string, executions: (BfsExecution | null)[]) {
  const allowed = new Set<string>();
  const add = (n: number) => allowed.add(String(Number(n.toFixed(2))));
  for (const run of executions) {
    if (!run) continue;
    for (const step of run.steps) Object.values(step.distances).forEach(add);
    run.input.edges.forEach((edge) => add(edge.weight ?? 1));
    for (let i = 0; i <= run.steps.length; i++) add(i);
    add(run.input.nodes.length);
    add(run.input.edges.length);
  }
  return (caption.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(String(Number(Number(n).toFixed(2)))));
}

const nodeName = (input: BfsInput, id: string | null) =>
  input.nodes.find((node) => node.id === id)?.label ?? 'None';

export function explorationNarration(spec: ExplorationSpec, state: ExplorationViewState): string {
  if (spec.mode === 'clarify') return spec.question;
  const authored =
    spec.mode === 'explanation'
      ? spec.steps[state.explanationStep]
      : !explorationInputsChanged(spec, state)
        ? spec.steps.find(
            (step) => step.execution === 'primary' && step.executionStep === state.step,
          )
        : undefined;
  return authored?.narration || explorationVisibleCaption(spec, state);
}
export function nextPlaybackState(
  spec: ExplorationSpec,
  state: ExplorationViewState,
): ExplorationViewState | null {
  if (spec.mode === 'clarify') return null;
  if (spec.mode === 'explanation')
    return state.explanationStep + 1 < spec.steps.length
      ? { ...state, explanationStep: state.explanationStep + 1 }
      : null;
  const execution = explorationExecution(spec, state)!;
  if (
    state.step + 1 >=
    Math.max(
      execution.steps.length,
      spec.comparison ? comparisonExecution(spec, state)!.steps.length : 0,
    )
  )
    return null;
  const step = state.step + 1,
    authored = spec.steps.findIndex(
      (item) => item.execution === 'primary' && item.executionStep === step,
    );
  return { ...state, step, ...(authored >= 0 ? { explanationStep: authored } : {}) };
}

export function comparisonExecution(
  spec: ExplorationSpec,
  state: ExplorationViewState,
): BfsExecution | null {
  if ((spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') || !spec.comparison)
    return null;
  const sameWeightedGraph =
    spec.mode === 'checked-dijkstra' &&
    JSON.stringify({ ...spec.comparison.input, algorithm: spec.input.algorithm }) ===
      JSON.stringify(spec.input);
  const input = spec.comparison.input;
  return runBfs({
    ...input,
    ...(sameWeightedGraph
      ? {
          start: state.start ?? input.start,
          goal: state.goal,
          neighborOrder: state.reversed ? [...input.neighborOrder].reverse() : input.neighborOrder,
        }
      : {}),
    edges: input.edges
      .filter((e) => !sameWeightedGraph || !state.disabledEdgeIds.includes(e.id))
      .map((e) =>
        state.edgeWeights?.[e.id] !== undefined ? { ...e, weight: state.edgeWeights[e.id] } : e,
      ),
  });
}
