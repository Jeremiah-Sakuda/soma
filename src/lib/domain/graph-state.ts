import { z } from 'zod';
import { bfsInputSchema, sceneIdSchema, type BfsInput } from './graph-search';

/** Scientific controls only. A reply's trace position, selection and camera are separate. */
export const graphControlsSchema = z.strictObject({
  start: sceneIdSchema,
  goal: sceneIdSchema.nullable(),
  disabledEdgeIds: z.array(sceneIdSchema).max(24),
  reversed: z.boolean(),
  edgeWeights: z
    .record(sceneIdSchema, z.number().finite().min(0).max(1000000))
    .refine((values) => Object.keys(values).length <= 24, 'At most 24 edge costs are supported.'),
});
export type GraphControls = z.infer<typeof graphControlsSchema>;

export function defaultGraphControls(input: BfsInput): GraphControls {
  return {
    start: input.start,
    goal: input.goal,
    disabledEdgeIds: [],
    reversed: false,
    edgeWeights: {},
  };
}

/** Validate against the retained base graph, including edges currently switched off. */
export function validateGraphControls(
  input: BfsInput,
  raw: unknown,
  allowedControls?: readonly string[],
): GraphControls {
  const controls = graphControlsSchema.parse(raw);
  const nodes = new Set(input.nodes.map((node) => node.id));
  const edges = new Set(input.edges.map((edge) => edge.id));
  if (
    !nodes.has(controls.start) ||
    (controls.goal !== null && !nodes.has(controls.goal)) ||
    new Set(controls.disabledEdgeIds).size !== controls.disabledEdgeIds.length ||
    controls.disabledEdgeIds.some((id) => !edges.has(id)) ||
    Object.keys(controls.edgeWeights).some((id) => !edges.has(id))
  )
    throw new Error('Graph controls reference an unavailable node or edge.');
  if (
    allowedControls &&
    ((controls.start !== input.start && !allowedControls.includes('set-start')) ||
      (controls.goal !== input.goal && !allowedControls.includes('set-goal')) ||
      (controls.disabledEdgeIds.length > 0 && !allowedControls.includes('toggle-edge')) ||
      (controls.reversed && !allowedControls.includes('reverse-neighbor-order')) ||
      (Object.keys(controls.edgeWeights).length > 0 &&
        (input.algorithm !== 'dijkstra' || !allowedControls.includes('set-weight'))))
  )
    throw new Error('Graph controls require an unavailable interaction.');
  return controls;
}

/** Materialize a checked execution input without replacing or mutating the base graph. */
export function applyGraphControls(input: BfsInput, raw: GraphControls): BfsInput {
  const controls = validateGraphControls(input, raw);
  return bfsInputSchema.parse({
    ...input,
    start: controls.start,
    goal: controls.goal,
    edges: input.edges
      .filter((edge) => !controls.disabledEdgeIds.includes(edge.id))
      .map((edge) =>
        controls.edgeWeights[edge.id] !== undefined
          ? { ...edge, weight: controls.edgeWeights[edge.id] }
          : edge,
      ),
    neighborOrder: controls.reversed ? [...input.neighborOrder].reverse() : input.neighborOrder,
  });
}

/** A same-graph BFS/Dijkstra comparison shares controls; other comparisons retain
 * their declared start, goal, edges and order, sharing only matching edge costs. */
export function applyComparisonGraphControls(
  primary: BfsInput,
  comparison: BfsInput,
  raw: GraphControls,
): BfsInput {
  const controls = validateGraphControls(primary, raw);
  const sameWeightedGraph =
    primary.algorithm === 'dijkstra' &&
    JSON.stringify({ ...comparison, algorithm: primary.algorithm }) === JSON.stringify(primary);
  if (sameWeightedGraph) return applyGraphControls(comparison, controls);
  return bfsInputSchema.parse({
    ...comparison,
    edges: comparison.edges.map((edge) =>
      controls.edgeWeights[edge.id] !== undefined
        ? { ...edge, weight: controls.edgeWeights[edge.id] }
        : edge,
    ),
  });
}

export function graphControlsEqual(a: GraphControls, b: GraphControls): boolean {
  return (
    a.start === b.start &&
    a.goal === b.goal &&
    a.reversed === b.reversed &&
    [...a.disabledEdgeIds].sort().join() === [...b.disabledEdgeIds].sort().join() &&
    Object.keys(a.edgeWeights).length === Object.keys(b.edgeWeights).length &&
    Object.entries(a.edgeWeights).every(
      ([id, value]) => Object.hasOwn(b.edgeWeights, id) && b.edgeWeights[id] === value,
    )
  );
}
