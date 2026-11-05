import { z } from 'zod';

export const BFS_MODEL_ID = 'bfs-unweighted' as const;
export const BFS_MODEL_VERSION = 'bfs-unweighted-v1' as const;
// IDs key plain objects, so none may name an inherited member (toString, valueOf, ...).
const RESERVED_IDS = new Set([
  'prototype',
  '__proto__',
  ...Object.getOwnPropertyNames(Object.prototype),
]);
export const sceneIdSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/)
  .refine((value) => !RESERVED_IDS.has(value), 'Reserved object ID.');
const label = z.string().trim().min(1).max(80);
export const bfsInputSchema = z
  .strictObject({
    nodes: z
      .array(z.strictObject({ id: sceneIdSchema, label }))
      .min(1)
      .max(12),
    edges: z
      .array(
        z.strictObject({
          id: sceneIdSchema,
          from: sceneIdSchema,
          to: sceneIdSchema,
          weight: z.number().finite().min(0).max(1000000).nullish(),
        }),
      )
      .max(24),
    algorithm: z.enum(['bfs', 'dijkstra']).nullish(),
    directed: z.boolean(),
    start: sceneIdSchema,
    goal: sceneIdSchema.nullable(),
    neighborOrder: z.array(sceneIdSchema).min(1).max(12),
  })
  .superRefine((input, ctx) => {
    const ids = input.nodes.map((node) => node.id),
      nodeIds = new Set(ids),
      allIds = new Set(ids),
      pairs = new Set<string>();
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (nodeIds.size !== ids.length) issue('Node IDs must be unique.');
    if (!nodeIds.has(input.start) || (input.goal !== null && !nodeIds.has(input.goal)))
      issue('Start and goal must name graph nodes.');
    if (
      input.neighborOrder.length !== ids.length ||
      new Set(input.neighborOrder).size !== ids.length ||
      input.neighborOrder.some((id) => !nodeIds.has(id))
    )
      issue('Neighbor order must be an exact node permutation.');
    for (const edge of input.edges) {
      if (allIds.has(edge.id)) issue('Object IDs must be unique.');
      allIds.add(edge.id);
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to))
        issue('Edge endpoints must name graph nodes.');
      const pair = JSON.stringify(
        input.directed ? [edge.from, edge.to] : [edge.from, edge.to].sort(),
      );
      if (pairs.has(pair)) issue('Duplicate edges are unsupported.');
      pairs.add(pair);
    }
  })
  .transform((value) => {
    const { algorithm, ...rest } = value;
    return {
      ...rest,
      ...(algorithm ? { algorithm } : {}),
      edges: value.edges.map((edge) => {
        const { weight, ...rest } = edge;
        return { ...rest, ...(weight != null ? { weight } : {}) };
      }),
    };
  });
export type BfsInput = z.infer<typeof bfsInputSchema>;
export type BfsStep = {
  index: number;
  current: string | null;
  queue: string[];
  discovered: string[];
  visited: string[];
  expanded: string[];
  parents: Record<string, string | null>;
  distances: Record<string, number>;
  status: 'ready' | 'searching' | 'found' | 'unreachable' | 'complete';
};
export type BfsExecution = {
  modelId: typeof BFS_MODEL_ID | 'dijkstra-nonnegative';
  modelVersion: typeof BFS_MODEL_VERSION | 'dijkstra-nonnegative-v1';
  input: BfsInput;
  steps: BfsStep[];
  visitOrder: string[];
  path: string[] | null;
  status: 'found' | 'unreachable' | 'complete';
};
/** FIFO frontier; visited on enqueue; goal termination on dequeue. Unit-cost
 * graph edges only. All snapshots are detached, including the validated input. */
export function runBfs(raw: unknown): BfsExecution {
  const input = bfsInputSchema.parse(raw);
  if (input.algorithm === 'dijkstra') return runDijkstra(input);
  if (input.edges.some((e) => (e.weight ?? 1) !== 1) && input.algorithm !== 'bfs')
    throw new Error('Weighted edges require an explicit algorithm.');
  const queue = [input.start],
    visited = [input.start],
    expanded: string[] = [],
    dequeued: string[] = [],
    seen = new Set(visited);
  const parents: Record<string, string | null> = Object.create(null),
    distances: Record<string, number> = Object.create(null);
  parents[input.start] = null;
  distances[input.start] = 0;
  const steps: BfsStep[] = [];
  const snapshot = (current: string | null, discovered: string[], status: BfsStep['status']) => {
    steps.push({
      index: steps.length,
      current,
      queue: [...queue],
      discovered: [...discovered],
      visited: [...visited],
      expanded: [...expanded],
      parents: { ...parents },
      distances: { ...distances },
      status,
    });
  };
  snapshot(null, [input.start], 'ready');
  let status: BfsExecution['status'] = 'complete';
  let path: string[] | null = null;
  while (queue.length) {
    const current = queue.shift()!;
    dequeued.push(current);
    if (current === input.goal) {
      status = 'found';
      const reversed: string[] = [];
      for (let node: string | null = current; node !== null; node = parents[node])
        reversed.push(node);
      path = reversed.reverse();
      snapshot(current, [], 'found');
      break;
    }
    expanded.push(current);
    const adjacent = new Set(
      input.edges.flatMap((edge) =>
        edge.from === current
          ? [edge.to]
          : !input.directed && edge.to === current
            ? [edge.from]
            : [],
      ),
    );
    const discovered = input.neighborOrder.filter((id) => adjacent.has(id) && !seen.has(id));
    for (const id of discovered) {
      seen.add(id);
      visited.push(id);
      queue.push(id);
      parents[id] = current;
      distances[id] = distances[current] + 1;
    }
    const stepStatus = queue.length
      ? 'searching'
      : input.goal !== null
        ? 'unreachable'
        : 'complete';
    snapshot(current, discovered, stepStatus);
  }
  if (input.goal !== null && status !== 'found') status = 'unreachable';
  return {
    modelId: BFS_MODEL_ID,
    modelVersion: BFS_MODEL_VERSION,
    input,
    steps,
    visitOrder: [...dequeued],
    path,
    status,
  };
}

/** Nonnegative Dijkstra; settle once, relax tentative costs, deterministic tie order. */
export function runDijkstra(raw: unknown): BfsExecution {
  const input = bfsInputSchema.parse(raw),
    queue = [input.start],
    expanded: string[] = [],
    parents: Record<string, string | null> = Object.create(null),
    distances: Record<string, number> = Object.create(null),
    steps: BfsStep[] = [];
  parents[input.start] = null;
  distances[input.start] = 0;
  const snapshot = (current: string | null, discovered: string[], status: BfsStep['status']) =>
    steps.push({
      index: steps.length,
      current,
      queue: [...queue],
      discovered: [...discovered],
      visited: Object.keys(distances),
      expanded: [...expanded],
      parents: { ...parents },
      distances: { ...distances },
      status,
    });
  snapshot(null, [input.start], 'ready');
  let status: BfsExecution['status'] = 'complete',
    path: string[] | null = null;
  while (queue.length) {
    queue.sort(
      (a, b) =>
        distances[a] - distances[b] ||
        input.neighborOrder.indexOf(a) - input.neighborOrder.indexOf(b),
    );
    const current = queue.shift()!;
    expanded.push(current);
    if (current === input.goal) {
      status = 'found';
      const reversed: string[] = [];
      for (let n: string | null = current; n !== null; n = parents[n]) reversed.push(n);
      path = reversed.reverse();
      snapshot(current, [], 'found');
      break;
    }
    const discovered: string[] = [];
    for (const next of input.neighborOrder) {
      if (expanded.includes(next)) continue;
      const edge = input.edges.find(
        (e) =>
          (e.from === current && e.to === next) ||
          (!input.directed && e.to === current && e.from === next),
      );
      if (!edge) continue;
      const candidate = distances[current] + (edge.weight ?? 1);
      if (distances[next] === undefined || candidate < distances[next]) {
        distances[next] = candidate;
        parents[next] = current;
        if (!queue.includes(next)) {
          queue.push(next);
          discovered.push(next);
        }
      }
    }
    queue.sort(
      (a, b) =>
        distances[a] - distances[b] ||
        input.neighborOrder.indexOf(a) - input.neighborOrder.indexOf(b),
    );
    snapshot(
      current,
      discovered,
      queue.length ? 'searching' : input.goal === null ? 'complete' : 'unreachable',
    );
  }
  if (input.goal !== null && status !== 'found') status = 'unreachable';
  return {
    modelId: 'dijkstra-nonnegative',
    modelVersion: 'dijkstra-nonnegative-v1',
    input,
    steps,
    visitOrder: [...expanded],
    path,
    status,
  };
}
