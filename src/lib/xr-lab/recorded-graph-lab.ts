import { bfsInputSchema, runDijkstra } from '../domain/graph-search';
import {
  applyGraphControls,
  defaultGraphControls,
  type GraphControls,
} from '../domain/graph-state';
import recordedGraph from '../fixtures/recorded-graph.json';
import presentation from '../fixtures/recorded-graph-presentation.json';
import { LAB_COST_RANGE, type LabState, type OpenRecordedGraphLab } from './contract';

const input = bfsInputSchema.parse(recordedGraph.spec.input);
const { edgeId, originalCost, criticalCost } = recordedGraph.experiment;
const probe = { edgeId, originalCost, criticalCost };
const recordedAt = recordedGraph.updatedAt;
const provenance = {
  model: recordedGraph.generation.model,
  recordedAt,
  label: `Recorded Muse Spark 1.3 run, ${recordedAt.slice(0, 10)}`,
};

const nodePositions = new Map(
  presentation.layout.nodes.map(({ nodeId, x, y }) => [nodeId, { x, y }]),
);
const labelPositions = new Map(
  presentation.layout.edgeLabels.map(({ edgeId, x, y }) => [edgeId, { x, y }]),
);
const nodes = input.nodes.map((node) => {
  const position = nodePositions.get(node.id);
  if (!position) throw new Error(`Missing recorded position for node ${node.id}.`);
  return { ...node, ...position };
});
const edges = input.edges.map(({ id, from, to, weight }) => {
  const position = labelPositions.get(id);
  if (!position) throw new Error(`Missing recorded label position for edge ${id}.`);
  return {
    id,
    from,
    to,
    cost: weight ?? 1,
    labelX: position.x,
    labelY: position.y,
  };
});
const labels = new Map(nodes.map(({ id, label }) => [id, label]));
const nodeLabel = (id: string) => labels.get(id) ?? id;

function computeState(controls: GraphControls, change: string): LabState {
  const execution = runDijkstra(applyGraphControls(input, controls));
  const { path, status } = execution;
  const { start, goal } = execution.input;
  const finalStep = execution.steps.at(-1);
  const totalCost =
    status === 'found' && goal !== null ? (finalStep?.distances[goal] ?? null) : null;
  const route = path ?? [];
  const result = path
    ? `Computed shortest route: ${path.map(nodeLabel).join(' → ')} (cost ${totalCost}).`
    : goal !== null
      ? `Computed result: no route from ${nodeLabel(start)} to ${nodeLabel(goal)}.`
      : 'Computed result: all reachable nodes explored; no goal selected.';
  const enabledIds = new Set(execution.input.edges.map(({ id }) => id));

  return {
    nodes,
    edges: edges.map((edge) => {
      const enabled = enabledIds.has(edge.id);
      return {
        ...edge,
        enabled,
        cost: controls.edgeWeights[edge.id] ?? edge.cost,
        onPath:
          enabled &&
          route.some((from, index) => {
            const to = route[index + 1];
            return (
              (edge.from === from && edge.to === to) ||
              (!input.directed && edge.from === to && edge.to === from)
            );
          }),
      };
    }),
    start,
    goal,
    path,
    totalCost,
    status,
    probe,
    caption: change ? `${change} ${result}` : result,
    provenance,
  };
}

/** Open an isolated replay. The recording selects the experiment; Dijkstra computes each result. */
export const openRecordedGraphLab: OpenRecordedGraphLab = () => {
  let controls = defaultGraphControls(input);
  let current = computeState(controls, '');
  const state = () => structuredClone(current);

  function update(next: GraphControls, change: string): LabState {
    current = computeState(next, change);
    controls = next;
    return state();
  }

  function findEdge(id: string) {
    const edge = current.edges.find((edge) => edge.id === id);
    if (!edge) throw new Error(`Unknown lab edge: ${id}.`);
    return edge;
  }

  return {
    state,
    toggleEdge(id) {
      const edge = findEdge(id);
      const disabledEdgeIds = edge.enabled
        ? [...controls.disabledEdgeIds, id]
        : controls.disabledEdgeIds.filter((edgeId) => edgeId !== id);
      return update(
        { ...controls, disabledEdgeIds },
        `${edge.enabled ? 'Cut' : 'Restored'} ${nodeLabel(edge.from)}–${nodeLabel(edge.to)}.`,
      );
    },
    setCost(id, cost) {
      const edge = findEdge(id);
      const nextCost = Math.max(LAB_COST_RANGE.min, Math.min(LAB_COST_RANGE.max, cost));
      const name = `${nodeLabel(edge.from)}–${nodeLabel(edge.to)}`;
      return update(
        {
          ...controls,
          edgeWeights: { ...controls.edgeWeights, [id]: nextCost },
        },
        edge.cost === nextCost
          ? `${name} cost stayed at ${nextCost}.`
          : `${name} cost changed from ${edge.cost} to ${nextCost}.`,
      );
    },
    reset() {
      return update(defaultGraphControls(input), 'Reset to the recorded graph.');
    },
  };
};
