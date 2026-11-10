import graphRecording from '../../src/lib/fixtures/recorded-graph.json';
import circuitRecording from '../../src/lib/fixtures/recorded-circuit.json';
import { LAB_COST_RANGE, type Lab, type LabState } from '../../src/lib/xr-lab/contract';
import {
  CIRCUIT_LAB_VALUE_RANGES,
  type CircuitLab,
  type CircuitLabState,
} from '../../src/lib/xr-lab/circuit-contract';
import { openRecordedGraphLab } from '../../src/lib/xr-lab/recorded-graph-lab';
import { openRecordedCircuitLab } from '../../src/lib/xr-lab/recorded-circuit-lab';

export type LabId = 'graph' | 'circuit';
export type Finding = { baseline: string; result: string; caption: string; replay?: unknown };

type ControlEdit = { id: string; value: number; enabled: boolean };
type Recipe = { version: 1; lab: LabId; source: string; edits: ControlEdit[] };
export type ReplayedLab = { id: 'graph'; lab: Lab } | { id: 'circuit'; lab: CircuitLab };

const sourceKey = (recording: typeof graphRecording | typeof circuitRecording) =>
  `${recording.spec.id}:${recording.spec.version}:${recording.source.imageSha256}`;
const sources = { graph: sourceKey(graphRecording), circuit: sourceKey(circuitRecording) };

export function graphRecipe(initial: LabState, state: LabState): Recipe {
  const edits = state.edges.flatMap(({ id, cost, enabled }, i) =>
    cost !== initial.edges[i].cost || enabled !== initial.edges[i].enabled
      ? [{ id, value: cost, enabled }]
      : [],
  );
  return { version: 1, lab: 'graph', source: sources.graph, edits };
}

export function circuitRecipe(initial: CircuitLabState, state: CircuitLabState): Recipe {
  const edits = state.parts.flatMap(({ id, value, open }, i) =>
    value !== initial.parts[i].value || open !== initial.parts[i].open
      ? [{ id, value, enabled: !open }]
      : [],
  );
  return { version: 1, lab: 'circuit', source: sources.circuit, edits };
}

/** Treat local storage as input. Rebuild in a fresh lab so invalid/stale data cannot partially
 * overwrite an active experiment. The stored caption and result are never read by a solver. */
export function replayFinding(id: LabId, raw: unknown): ReplayedLab | null {
  if (!raw || typeof raw !== 'object') return null;
  const recipe = raw as Partial<Recipe>;
  if (recipe.version !== 1 || recipe.lab !== id || recipe.source !== sources[id]) return null;
  if (!Array.isArray(recipe.edits) || !recipe.edits.length || recipe.edits.length > 24) return null;
  const seen = new Set<string>();
  const graph = id === 'graph' ? openRecordedGraphLab() : null;
  const circuit = id === 'circuit' ? openRecordedCircuitLab() : null;
  const edges = graph?.state().edges;
  const parts = circuit?.state().parts;
  for (const edit of recipe.edits) {
    if (
      !edit ||
      typeof edit.id !== 'string' ||
      seen.has(edit.id) ||
      !Number.isFinite(edit.value) ||
      typeof edit.enabled !== 'boolean'
    )
      return null;
    seen.add(edit.id);
    if (graph) {
      const edge = edges?.find((entry) => entry.id === edit.id);
      if (!edge) return null;
      // The original recording may contain an as-read cost outside the XR edit range.
      if (edit.value !== edge.cost) {
        if (edit.value < LAB_COST_RANGE.min || edit.value > LAB_COST_RANGE.max) return null;
        graph.setCost(edit.id, edit.value);
      }
      if (edit.enabled !== edge.enabled) graph.toggleEdge(edit.id);
    } else if (circuit) {
      const part = parts?.find((entry) => entry.id === edit.id);
      if (!part) return null;
      const range = CIRCUIT_LAB_VALUE_RANGES[part.kind];
      if (edit.value !== part.value) {
        if (edit.value < range.min || edit.value > range.max) return null;
        circuit.setValue(edit.id, edit.value);
      }
      if (edit.enabled === part.open) {
        if (part.kind !== 'resistor') return null;
        circuit.togglePart(edit.id);
      }
    }
  }
  if (graph) return { id: 'graph', lab: graph };
  return circuit ? { id: 'circuit', lab: circuit } : null;
}
