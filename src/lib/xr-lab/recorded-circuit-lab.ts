import { DC_UNITS, dcInputSchema, solveDc, type DcProbe, type DcState } from '../domain/dc-circuit';
import {
  circuitCaption,
  circuitObservationCaption,
  circuitQuantity,
} from '../domain/exploration-view';
import recording from '../fixtures/recorded-circuit.json';
import presentation from '../fixtures/recorded-circuit-presentation.json';
import {
  CIRCUIT_LAB_VALUE_RANGES,
  type CircuitLabState,
  type OpenRecordedCircuitLab,
} from './circuit-contract';

const input = dcInputSchema.parse(recording.spec.input);
// Immutable, versioned local fixture: this is the recorded choice, never a new model invocation.
const probe = recording.circuitExperiment as DcProbe;
if (presentation.sourceImageSha256 !== recording.source.imageSha256)
  throw new Error('Circuit presentation does not match the recorded source.');
const nodes = input.nodes.map((node) => {
  const position = presentation.layout.nodes.find(({ nodeId }) => nodeId === node.id);
  if (!position) throw new Error(`Missing recorded position for node ${node.id}.`);
  return { ...node, x: position.x, y: position.y };
});
const parts = input.components.map((part) => {
  const position = presentation.layout.components.find(
    ({ componentId }) => componentId === part.id,
  );
  if (!position) throw new Error(`Missing recorded position for part ${part.id}.`);
  const { x1, y1, x2, y2 } = position;
  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2;
  const vertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
  // The fixture has body alignment but no printed-label positions. Supply deterministic
  // presentation anchors: right of vertical bodies, above horizontal bodies, within the slide.
  return {
    ...part,
    unit: DC_UNITS[part.kind],
    x,
    y,
    labelX: Math.min(1, x + (vertical ? 0.04 : 0)),
    labelY: Math.max(0, y - (vertical ? 0 : 0.04)),
  };
});

function recordedControls(): DcState {
  return {
    open: [...recording.state.disabledEdgeIds],
    shorted: [],
    values: {
      ...('edgeWeights' in recording.state
        ? (recording.state.edgeWeights as Record<string, number>)
        : {}),
    },
  };
}

function computeState(controls: DcState, change: string): CircuitLabState {
  const solution = solveDc(input, controls);
  const result =
    circuitObservationCaption(solution, probe.observe) ??
    circuitCaption(solution, Math.max(0, solution.steps.length - 1));
  return {
    parts: parts.map((part) => ({
      ...part,
      value: solution.state.values[part.id] ?? part.value,
      open: solution.state.open.includes(part.id),
      current: solution.currents[part.id] ?? null,
    })),
    nodes: nodes.map((node) => ({ ...node, voltage: solution.voltages[node.id] ?? null })),
    ground: input.ground,
    status: solution.status,
    reason: solution.reason,
    checks: solution.checks,
    probe,
    caption: `${change ? `${change} ` : ''}Computed now: ${result}`,
    provenance: {
      model: recording.generation.model,
      recordedAt: recording.updatedAt,
      label: `Recorded Muse Spark 1.3 run, ${recording.updatedAt.slice(0, 10)}; results computed now.`,
      results: 'computed-now',
      solver: solution.modelId,
      solverVersion: solution.modelVersion,
      layout: 'recorded-alignment-with-derived-labels',
    },
  };
}

/** Isolated local replay: recording supplies the reading/probe, exact nodal analysis supplies results. */
export const openRecordedCircuitLab: OpenRecordedCircuitLab = () => {
  let controls = recordedControls();
  let current = computeState(controls, '');
  const state = () => structuredClone(current);
  function update(next: DcState, change: string): CircuitLabState {
    const computed = computeState(next, change);
    controls = next;
    current = computed;
    return state();
  }
  function findPart(id: string) {
    const part = current.parts.find((part) => part.id === id);
    if (!part) throw new Error(`Unknown lab part: ${id}.`);
    return part;
  }
  return {
    state,
    togglePart(id) {
      const part = findPart(id);
      if (part.kind !== 'resistor') throw new Error('Only resistors can be opened or closed.');
      const open = part.open
        ? controls.open.filter((partId) => partId !== id)
        : [...controls.open, id];
      return update({ ...controls, open }, `${part.open ? 'Closed' : 'Opened'} ${part.label}.`);
    },
    setValue(id, value) {
      const part = findPart(id);
      if (!Number.isFinite(value)) throw new Error('A lab value must be finite.');
      const range = CIRCUIT_LAB_VALUE_RANGES[part.kind];
      const nextValue = Math.max(range.min, Math.min(range.max, value));
      return update(
        { ...controls, values: { ...controls.values, [id]: nextValue } },
        `${part.label} set to ${circuitQuantity(nextValue, part.unit)}.`,
      );
    },
    reset() {
      return update(recordedControls(), 'Reset to the recorded circuit.');
    },
  };
};
