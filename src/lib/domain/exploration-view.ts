import type { SpatialView } from './spatial-schema';
import { runBfs, type BfsInput, type BfsExecution, type ExplorationSpec } from './exploration';
import { solveDc, type DcInput, type DcObservation, type DcSolution } from './dc-circuit';
import { defaultGraphControls, applyGraphControls, applyComparisonGraphControls, graphControlsEqual, type GraphControls } from './graph-state';

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
  return runBfs(applyGraphControls(spec.input, graphViewControls(spec.input, state)));
}
/** Resolve legacy nullable starts and omitted costs without accepting presentation fields. */
function graphViewControls(input: BfsInput, state: ExplorationViewState): GraphControls {
  return { start: state.start ?? input.start, goal: state.goal, disabledEdgeIds: state.disabledEdgeIds,
    reversed: state.reversed, edgeWeights: state.edgeWeights ?? {} };
}
/** Source/experiment labeling is independent of whether the authored words match this state. */
export function graphExperimentActive(spec: ExplorationSpec, state: ExplorationViewState): boolean {
  return (spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
    !graphControlsEqual(graphViewControls(spec.input, state), defaultGraphControls(spec.input));
}
/** The circuit under the learner's experiment: open parts are `disabledEdgeIds`, changed
 * values are `edgeWeights`, so the same view state and controls serve both families. */
export function circuitSolution(spec: ExplorationSpec, state: ExplorationViewState): DcSolution | null {
  if (spec.mode !== 'checked-circuit') return null;
  return solveDc(spec.input, { open: state.disabledEdgeIds, values: state.edgeWeights ?? {} });
}
export function explorationInputsChanged(spec: ExplorationSpec, state: ExplorationViewState) {
  // A circuit's words may be written for an experiment (a follow-up asked with a part open);
  // they apply exactly when the view shows that experiment.
  if (spec.mode === 'checked-circuit') {
    const written = spec.writtenFor ?? { open: [], values: {} };
    const same = (a: Record<string, number>, b: Record<string, number>) =>
      Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([id, v]) => Object.hasOwn(b, id) && b[id] === v);
    return (
      [...state.disabledEdgeIds].sort().join() !== [...written.open].sort().join() ||
      !same(state.edgeWeights ?? {}, written.values)
    );
  }
  return (
    (spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
    !graphControlsEqual(graphViewControls(spec.input, state), spec.writtenFor ?? defaultGraphControls(spec.input))
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
/** Numbers as a learner reads them: exact values plainly, others to four figures with ≈. */
export function circuitQuantity(value: number, unit: string) {
  const plain = Number(value.toPrecision(4));
  return `${plain !== value ? '≈ ' : ''}${String(plain).replace('-', '−')} ${unit}`;
}
/** The solver's exact fraction beside its rounded decimal, "12/29 A ≈ 0.4138 A", when the
 * value is not a whole number; otherwise the plain quantity. */
export function circuitExactQuantity(exact: string | null | undefined, value: number, unit: string, magnitude = false) {
  if (!exact?.includes('/')) return circuitQuantity(magnitude ? Math.abs(value) : value, unit);
  const fraction = (magnitude ? exact.replace('-', '') : exact).replace('-', '−');
  return `${fraction} ${unit} ${circuitQuantity(magnitude ? Math.abs(value) : value, unit).replace(/^(?!≈)/, '= ')}`;
}
const circuitName = (input: DcInput, id: string) =>
  input.nodes.find((n) => n.id === id)?.label ?? input.components.find((c) => c.id === id)?.label ?? id;
/** The selected experiment's consequence, without repeating every newly revealed part.
 * Decline when the observation is unavailable so the full circuit caption keeps its context. */
export function circuitObservationCaption(solution: DcSolution, observation: DcObservation): string | null {
  if (solution.status !== 'solved') return null;
  const { input } = solution;
  const voltageAt = (id: string) => {
    const v = solution.voltages[id];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  if (observation.kind === 'voltage') {
    const node = input.nodes.find((n) => n.id === observation.nodeId), v = voltageAt(observation.nodeId);
    return node && v !== null
      ? `${node.label} is at ${circuitQuantity(v, 'V')} relative to ${circuitName(input, input.ground)} (ground).`
      : null;
  }
  const c = input.components.find((part) => part.id === observation.componentId);
  if (!c) return null;
  const fromVoltage = voltageAt(c.from), toVoltage = voltageAt(c.to);
  if (fromVoltage === null || toVoltage === null) return null;
  if (observation.kind === 'power') {
    const power = solution.power[c.id];
    return Number.isFinite(power)
      ? `${c.label} ${power < 0 ? 'supplies' : 'absorbs'} ${circuitQuantity(Math.abs(power), 'W')}.`
      : null;
  }
  const current = solution.currents[c.id];
  if (!Number.isFinite(current)) return null;
  if (solution.state.open.includes(c.id)) return `${c.label} is open, so it carries 0 A.`;
  if (current === 0)
    return c.kind === 'resistor' && solution.drops[c.id] === 0
      ? `${c.label} carries 0 A: both ends are at ${circuitQuantity(fromVoltage, 'V')}.`
      : `${c.label} carries 0 A.`;
  const [from, to] = current > 0 ? [c.from, c.to] : [c.to, c.from];
  const contrast = c.kind === 'resistor'
    ? ` ${circuitName(input, c.from)} is at ${circuitQuantity(fromVoltage, 'V')}; ${circuitName(input, c.to)} is at ${circuitQuantity(toVoltage, 'V')}.`
    : '';
  return `${c.label} carries ${circuitQuantity(Math.abs(current), 'A')} from ${circuitName(input, from)} to ${circuitName(input, to)}.${contrast}`;
}
/** Whether a part's two ends are still joined through the other connected parts. */
function connectedWithout(solution: DcSolution, id: string) {
  const { input, state } = solution;
  const part = input.components.find((c) => c.id === id)!;
  const reached = new Set([part.from]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of input.components)
      if (c.id !== id && !state.open.includes(c.id) && reached.has(c.from) !== reached.has(c.to)) {
        reached.add(c.from).add(c.to);
        grew = true;
      }
  }
  return reached.has(part.to);
}
/** One computed sentence per reveal step: the node it fixes, then what each newly known part
 * carries, with the current's direction in the circuit's own node names. */
export function circuitCaption(solution: DcSolution, index: number): string {
  const { input } = solution;
  if (solution.status !== 'solved') return solution.reason ?? 'This change leaves the circuit without one solution.';
  const step = solution.steps[Math.min(index, solution.steps.length - 1)];
  const before = index > 0 ? solution.steps[Math.min(index, solution.steps.length - 1) - 1] : null;
  const fresh = step.revealedComponents.filter((id) => !before?.revealedComponents.includes(id));
  const parts: string[] = [];
  if (!step.node) parts.push(`${circuitName(input, input.ground)} is the 0 V reference; every voltage is measured from it.`);
  else {
    const v = solution.voltages[step.node];
    parts.push(
      v === null
        ? `${circuitName(input, step.node)} is cut off from ${circuitName(input, input.ground)}, so it has no voltage of its own.`
        : `${circuitName(input, step.node)} sits at ${circuitQuantity(v, 'V')}.`,
    );
  }
  for (const id of fresh) {
    const c = input.components.find((x) => x.id === id)!;
    const current = solution.currents[id];
    if (solution.state.open.includes(id)) parts.push(`${c.label} is open, so it carries nothing.`);
    else if (current === 0)
      parts.push(
        c.kind === 'resistor'
          ? `${c.label} carries no current: both its ends are at the same voltage.`
          : (solution.state.values[c.id] ?? c.value) === 0
            ? `${c.label} is set to 0, so it drives no current.`
            : !connectedWithout(solution, c.id)
              ? `${c.label} carries no current: no closed path runs through it.`
              : `${c.label} carries no current: the rest of the circuit balances it.`,
      );
    else {
      const [a, b] = current > 0 ? [c.from, c.to] : [c.to, c.from];
      const amount = circuitQuantity(Math.abs(current), 'A');
      parts.push(
        c.kind === 'resistor'
          ? `${c.label} carries ${amount} from ${circuitName(input, a)} to ${circuitName(input, b)}, dropping ${circuitQuantity(Math.abs(solution.drops[id] ?? 0), 'V')}.`
          : `${c.label} drives ${amount} out of its ${current > 0 ? '+' : '−'} terminal.`,
      );
    }
  }
  if (step.status === 'complete' && solution.checks.kcl)
    parts.push('At every junction, the current in equals the current out.');
  return parts.join(' ');
}
/** The inspected search's step in one sentence; the journal shows only this. */
export function explorationStepCaption(spec: ExplorationSpec, state: ExplorationViewState): string {
  if (spec.mode === 'clarify') return spec.question;
  const circuit = circuitSolution(spec, state);
  if (circuit) return circuitCaption(circuit, state.step);
  const execution = explorationExecution(spec, state);
  if (!execution) return spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)].caption;
  return executionCaption(execution, state.step);
}
export function explorationVisibleCaption(
  spec: ExplorationSpec,
  state: ExplorationViewState,
): string {
  if (spec.mode === 'clarify') return spec.question;
  const circuit = circuitSolution(spec, state);
  if (circuit) return circuitCaption(circuit, state.step);
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
export function captionIsGrounded(caption: string, executions: (BfsExecution | null)[], circuit: DcSolution | null = null) {
  const allowed = new Set<string>();
  const add = (n: number) => allowed.add(String(Number(n.toFixed(2))));
  if (circuit) {
    // Voltages, currents, drops, power and values in their units, plus labels' own digits
    // (R1, 12 V battery) and the parts of exact fractions (1/3 A).
    const numbers = [
      ...Object.values(circuit.voltages).filter((v): v is number => v !== null),
      ...Object.values(circuit.currents),
      ...Object.values(circuit.drops).filter((v): v is number => v !== null),
      ...Object.values(circuit.power),
      ...circuit.input.components.map((c) => circuit.state.values[c.id] ?? c.value),
    ];
    for (const n of numbers) {
      add(n);
      add(Math.abs(n));
      add(Math.abs(n) * 1000);
    }
    for (const text of [...circuit.input.nodes, ...circuit.input.components].map((x) => x.label))
      (text.match(/\d+(?:\.\d+)?/g) ?? []).forEach((d) => add(Number(d)));
    for (const exact of [...Object.values(circuit.exact.voltages), ...Object.values(circuit.exact.currents)])
      (exact?.match(/\d+/g) ?? []).forEach((d) => add(Number(d)));
    for (let i = 0; i <= circuit.steps.length; i++) add(i);
    add(circuit.input.nodes.length);
    add(circuit.input.components.length);
    add(0);
  }
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
  if (spec.mode === 'checked-circuit') {
    const steps = circuitSolution(spec, state)!.steps.length;
    if (state.step + 1 >= steps) return null;
    const step = state.step + 1,
      authored = spec.steps.findIndex((item) => item.execution === 'primary' && item.executionStep === step);
    return { ...state, step, ...(authored >= 0 ? { explanationStep: authored } : {}) };
  }
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
  return runBfs(applyComparisonGraphControls(spec.input, spec.comparison.input, graphViewControls(spec.input, state)));
}
