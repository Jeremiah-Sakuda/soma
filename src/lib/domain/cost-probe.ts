import { runBfs, runDijkstra, bfsInputSchema, type BfsInput } from './graph-search';
export type CostProbe = {
  version: 'cost-probe-v1';
  edgeId: string;
  originalCost: number;
  criticalCost: number | null;
  /** Cheapest route with this connection removed. */
  alternativeCost?: number | null;
  alternativePath?: string[] | null;
  /** Muse's one-sentence reason for choosing this connection for the learner's question. */
  rationale?: string | null;
  note: string;
  cases: {
    value: number;
    bfsCost: number | null;
    dijkstraCost: number | null;
    bfsPath: string[] | null;
    dijkstraPath: string[] | null;
  }[];
};
export function routeCost(input: BfsInput, path: string[] | null): number | null {
  if (!path) return null;
  return path.slice(1).reduce((sum, to, i) => {
    const from = path[i],
      edge = input.edges.find(
        (e) =>
          (e.from === from && e.to === to) || (!input.directed && e.to === from && e.from === to),
      );
    if (!edge) throw new Error('Path edge missing');
    return sum + (edge.weight ?? 1);
  }, 0);
}
/** Shortest distances from one node over the given edges (reversed for distances *to* it). */
function distancesFrom(input: BfsInput, from: string, reverse = false) {
  const edges = reverse && input.directed ? input.edges.map((e) => ({ ...e, from: e.to, to: e.from })) : input.edges;
  const run = runDijkstra({ ...input, algorithm: 'dijkstra', edges, start: from, goal: null });
  return run.steps.at(-1)?.distances ?? {};
}

/** Checked cost interventions on one connection, with the exact cost at which the cheapest
 * route starts or stops using it. Any connection qualifies, not only a direct start-goal one:
 * a route through it costs (best distance to one end) + cost + (best distance from the other
 * end), both measured without it, and it competes with the best route avoiding it. */
export function probeEdgeCost(raw: unknown, edgeId: string, rationale: string | null = null): CostProbe {
  const input = bfsInputSchema.parse(raw),
    edge = input.edges.find((e) => e.id === edgeId);
  if (!edge || !input.goal) throw new Error('Select an existing edge and goal.');
  const goal = input.goal;
  const originalCost = edge.weight ?? 1;
  const without = { ...input, edges: input.edges.filter((e) => e.id !== edgeId) };
  const alternative = runDijkstra({ ...without, algorithm: 'dijkstra' }),
    alternativeCost = routeCost(alternative.input, alternative.path);
  const fromStart = distancesFrom(without, input.start),
    toGoal = distancesFrom(without, goal, true);
  const via = (a: string, b: string) =>
    fromStart[a] === undefined || toGoal[b] === undefined ? Infinity : fromStart[a] + toGoal[b];
  const through = Math.min(via(edge.from, edge.to), input.directed ? Infinity : via(edge.to, edge.from));
  const raw0 = alternativeCost === null || through === Infinity ? null : alternativeCost - through;
  const criticalCost = raw0 !== null && raw0 >= 0 && raw0 <= 1000000 ? Number(raw0.toFixed(6)) : null;
  const name = (id: string) => input.nodes.find((n) => n.id === id)?.label ?? id;
  const link = `${name(edge.from)}–${name(edge.to)}`;
  const values = [
    0,
    originalCost,
    Math.min(1000000, originalCost * 2 + 1),
    ...(criticalCost !== null
      ? [Math.max(0, criticalCost - 1), criticalCost, Math.min(1000000, criticalCost + 1)]
      : []),
  ];
  const cases = [...new Set(values)]
    .sort((a, b) => a - b)
    .map((value) => {
      const changed = {
        ...input,
        edges: input.edges.map((e) => (e.id === edgeId ? { ...e, weight: value } : e)),
      };
      const bfs = runBfs({ ...changed, algorithm: 'bfs' }),
        dijkstra = runDijkstra({ ...changed, algorithm: 'dijkstra' });
      return {
        value,
        bfsCost: routeCost(changed, bfs.path),
        dijkstraCost: routeCost(changed, dijkstra.path),
        bfsPath: bfs.path,
        dijkstraPath: dijkstra.path,
      };
    });
  const note =
    criticalCost === 0 && originalCost > 0
      ? `Even at cost 0, a route through ${link} only ties the best route avoiding it, so raising its cost never brings it onto the route.`
      : criticalCost !== null
      ? originalCost < criticalCost
        ? `The cheapest route uses ${link} while it costs less than ${criticalCost}. At ${criticalCost} the best route avoiding it costs the same; above that, the route avoids it.`
        : `The cheapest route avoids ${link} until it costs less than ${criticalCost}. At ${criticalCost} both routes cost the same; below that, the route uses it.`
      : through === Infinity
        ? `No route from ${name(input.start)} to ${name(goal)} can use ${link}, so its cost never changes the route.`
        : alternativeCost === null
          ? `Every route from ${name(input.start)} to ${name(goal)} needs ${link}; its cost changes the total but never the route.`
          : `Even at cost 0, a route through ${link} costs more than the best route avoiding it, so it never changes the route.`;
  return {
    version: 'cost-probe-v1',
    edgeId,
    originalCost,
    criticalCost,
    alternativeCost,
    alternativePath: alternative.path,
    rationale,
    note: `${note} Ties can choose different equal-cost paths.`,
    cases,
  };
}
