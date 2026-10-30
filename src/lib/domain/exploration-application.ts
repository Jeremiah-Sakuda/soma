import {
  runBfs,
  checkExploration,
  type BfsInput,
  type ExplorationSpec,
  type SourceObservationRef,
} from './exploration';
import type { ExplorationViewState } from './exploration-view';

/** Fresh practice, not an assertion of independent understanding. The reference
 * exploration remains available; solution exposure is recorded separately. */
export type ExplorationApplication = {
  id: string;
  artifactId: string;
  version: number;
  sourceObservationId: string;
  sourceVersion: number;
  state: ExplorationViewState;
  savedAt: string;
  createdAt: string;
  previousAttemptAt: string | null;
  input: BfsInput;
  prompt: string;
  unit: 'cost' | 'connections';
  modelVersion: string;
  expected: number;
  path: string[];
  hintedAt: string | null;
  revealedAt: string | null;
  answer: {
    value: number;
    reason: string;
    recordedAt: string;
    matches: boolean;
    assistance: 'none' | 'hint';
  } | null;
  explorationId: string | null;
  exposure: 'fresh-problem-reference-available';
};
export type PublicExplorationApplication = Omit<ExplorationApplication, 'expected' | 'path'> & {
  solution?: { value: number; path: string[] };
};
export function publicApplication(record: ExplorationApplication): PublicExplorationApplication {
  const { expected, path, ...rest } = record;
  return {
    ...rest,
    ...(record.answer || record.revealedAt ? { solution: { value: expected, path } } : {}),
  };
}

/** Bounded original variations within the same checked algorithm family. These
 * are application-created exercises, never newly extracted source facts. */
export function freshApplicationQuestion(spec: ExplorationSpec, seed: string) {
  if (spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') return null;
  let entropy = 2166136261;
  for (const c of seed) entropy = Math.imul(entropy ^ c.charCodeAt(0), 16777619) >>> 0;
  const next = (max: number) => {
    entropy ^= entropy << 13;
    entropy ^= entropy >>> 17;
    entropy ^= entropy << 5;
    return (entropy >>> 0) % max;
  };
  const weighted = spec.mode === 'checked-dijkstra';
  const count = 5 + next(2);
  const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const start = ids[0],
    goal = ids.at(-1)!;
  const interior = ids.slice(1, -1);
  for (let i = interior.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [interior[i], interior[j]] = [interior[j], interior[i]];
  }
  const [a, b, c, d] = interior;
  const pairs: [string, string][] = [
    [start, a],
    [a, goal],
    [start, b],
    [b, c],
    [c, goal],
  ];
  // The shorter route varies; a direct edge is not always present.
  if (next(2)) pairs.push([start, goal]);
  else pairs.push([a, c]);
  if (!weighted) {
    // Avoid a trivial direct one-hop answer; vary two- versus three-layer routes.
    pairs.splice(
      0,
      pairs.length,
      [start, a],
      [start, b],
      [b, c],
      [c, goal],
      next(2) ? [a, goal] : [a, c],
    );
  }
  if (count === 6) pairs.push([b, d], [d, goal]);
  const edges = pairs.map(([from, to], i) => ({
    id: `f${i + 1}`,
    from,
    to,
    ...(weighted ? { weight: 1 + next(12) } : {}),
  }));
  const input: BfsInput = {
    algorithm: weighted ? 'dijkstra' : 'bfs',
    directed: spec.input.directed,
    nodes: ids.map((id, i) => ({ id, label: `P${i + 1}` })),
    edges,
    start,
    goal,
    neighborOrder: next(2) ? ids : [start, ...ids.slice(1).reverse()],
  };
  const checked = runBfs(input);
  if (!checked.path) throw new Error('Fresh practice must have a reachable goal.');
  return {
    input: checked.input,
    prompt: weighted
      ? `What is the lowest total cost from P1 to P${count}?`
      : `What is the fewest number of connections from P1 to P${count}?`,
    unit: weighted ? ('cost' as const) : ('connections' as const),
    modelVersion: checked.modelVersion,
    expected: checked.steps.at(-1)!.distances[goal],
    path: checked.path,
  };
}
export function applicationHint(record: Pick<ExplorationApplication, 'unit'>) {
  return record.unit === 'cost'
    ? 'Add the costs along each complete route. Fewer connections need not mean lower cost.'
    : 'Count connections, not nodes. Breadth-first search explores one distance layer at a time.';
}
/** A solver-built starting visual after the attempt. Spark can subsequently
 * compose an answer-informed explanation through the normal bounded pipeline. */
export function applicationExploration(
  record: ExplorationApplication,
  ref: SourceObservationRef,
): ExplorationSpec {
  const execution = runBfs(record.input),
    weighted = record.unit === 'cost';
  const spec = {
    schemaVersion: 'exploration-v1',
    id: `practice_${record.id.replaceAll('-', '')}`,
    version: 1,
    mode: weighted ? 'checked-dijkstra' : 'checked-bfs',
    modelId: execution.modelId,
    modelVersion: execution.modelVersion,
    title: 'Explore your fresh example',
    objective: 'Inspect the checked route, then ask Soma to explain your answer.',
    sources: [ref],
    assumptions: [
      'Original practice variation; not a new fact from the captured source.',
      weighted ? 'All connection costs are nonnegative.' : 'Every connection counts as one step.',
    ],
    uncertainty: [],
    unsupportedClaims: ['This practice does not establish mastery or independent understanding.'],
    input: record.input,
    comparison: null,
    scene: {
      layout: 'diagram-sidebar',
      panels: [
        {
          id: 'practice-graph',
          kind: 'graph',
          title: 'Fresh practice graph',
          execution: 'primary',
          placement: { column: 1, row: 1, columnSpan: 1 },
          positions: record.input.nodes.map((node, i) => ({
            nodeId: node.id,
            x:
              i === 0
                ? 0.1
                : i === record.input.nodes.length - 1
                  ? 0.9
                  : 0.35 + ((i - 1) % 2) * 0.3,
            y:
              i === 0 || i === record.input.nodes.length - 1
                ? 0.5
                : 0.2 + Math.floor((i - 1) / 2) * 0.55,
          })),
        },
        {
          id: 'practice-frontier',
          kind: 'frontier',
          title: weighted ? 'Priority frontier' : 'FIFO frontier',
          execution: 'primary',
          placement: { column: 2, row: 1, columnSpan: 1 },
        },
      ],
    },
    steps: execution.steps.map((step, i) => ({
      id: `practice-step-${i}`,
      caption:
        i === 0
          ? 'Start with P1. Step through to inspect the checked search.'
          : step.status === 'found'
            ? `Goal reached. ${weighted ? 'Total cost' : 'Connections'}: ${record.expected}.`
            : `${record.input.nodes.find((n) => n.id === step.current)?.label} ${weighted ? 'is settled' : 'leaves the queue'}.`,
      narration: null,
      highlightIds: step.current ? [step.current] : [],
      execution: 'primary',
      executionStep: i,
    })),
    controls: [
      'step',
      'replay',
      'set-start',
      'set-goal',
      'toggle-edge',
      ...(weighted ? ['set-weight'] : []),
    ],
    followups: ['Explain how the lowest-cost route differs from the fewest connections.'],
  };
  return checkExploration(spec).spec;
}
