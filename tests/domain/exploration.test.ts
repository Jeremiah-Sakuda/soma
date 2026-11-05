import { describe, it, expect } from 'vitest';
import {
  bfsInputSchema,
  runBfs,
  checkExploration,
  validateExplorationSpec,
  createExampleExploration,
  type BfsInput,
} from '../../src/lib/domain/exploration';
const originalGraph: BfsInput = {
  nodes: ['s', 'a', 'b', 'c', 'd', 'g', 'x'].map((id) => ({ id, label: id.toUpperCase() })),
  edges: [
    ['s', 'a'],
    ['s', 'b'],
    ['a', 'c'],
    ['a', 'd'],
    ['b', 'd'],
    ['c', 's'],
    ['d', 'g'],
    ['g', 'b'],
  ].map(([from, to], index) => ({ id: `edge-${index}`, from, to })),
  directed: true,
  start: 's',
  goal: 'g',
  neighborOrder: ['s', 'a', 'b', 'c', 'd', 'g', 'x'],
};
const mutate = (change: (spec: any) => void) => {
  const spec = createExampleExploration();
  change(spec);
  return spec;
};
const trace = (input: BfsInput) =>
  runBfs(input).steps.map((step) => ({
    current: step.current,
    queue: step.queue,
    discovered: step.discovered,
    status: step.status,
  }));
describe('checked BFS — independent hand-worked references', () => {
  it('matches a cyclic reconverging graph without enqueuing a previously discovered node twice', () => {
    expect(trace(originalGraph)).toEqual([
      { current: null, queue: ['s'], discovered: ['s'], status: 'ready' },
      { current: 's', queue: ['a', 'b'], discovered: ['a', 'b'], status: 'searching' },
      { current: 'a', queue: ['b', 'c', 'd'], discovered: ['c', 'd'], status: 'searching' },
      { current: 'b', queue: ['c', 'd'], discovered: [], status: 'searching' },
      { current: 'c', queue: ['d'], discovered: [], status: 'searching' },
      { current: 'd', queue: ['g'], discovered: ['g'], status: 'searching' },
      { current: 'g', queue: [], discovered: [], status: 'found' },
    ]);
    const result = runBfs(originalGraph);
    expect(result.path).toEqual(['s', 'a', 'd', 'g']);
    expect(result.steps.at(-1)?.distances).toEqual({ s: 0, a: 1, b: 1, c: 2, d: 2, g: 3 });
    expect(result.steps.at(-1)?.parents).toEqual({
      s: null,
      a: 's',
      b: 's',
      c: 'a',
      d: 'a',
      g: 'd',
    });
    expect(result.steps.at(-1)?.expanded).toEqual(['s', 'a', 'b', 'c', 'd']); // goal dequeued, not successor-expanded
    expect(result.visitOrder).toEqual(['s', 'a', 'b', 'c', 'd', 'g']);
  });
  it('uses declared neighbor order independently of edge storage order and node geometry', () => {
    const result = runBfs({ ...originalGraph, neighborOrder: ['g', 'x', 'd', 'c', 'b', 'a', 's'] });
    expect(result.visitOrder).toEqual(['s', 'b', 'a', 'd', 'c', 'g']);
    expect(result.path).toEqual(['s', 'b', 'd', 'g']);
    const reordered = runBfs({
      ...originalGraph,
      edges: [...originalGraph.edges].reverse(),
      nodes: [...originalGraph.nodes].reverse(),
    });
    expect(reordered.steps).toEqual(runBfs(originalGraph).steps);
  });
  it('checks goal on dequeue, including start equals goal, and does not expand past it', () => {
    const result = runBfs({ ...originalGraph, goal: 's' });
    expect(result.path).toEqual(['s']);
    expect(result.visitOrder).toEqual(['s']);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]).toMatchObject({
      queue: [],
      visited: ['s'],
      discovered: [],
      expanded: [],
      distances: { s: 0 },
      status: 'found',
    });
  });
  it('reports a disconnected goal honestly and traverses only the reachable component', () => {
    const result = runBfs({ ...originalGraph, goal: 'x' });
    expect(result.status).toBe('unreachable');
    expect(result.path).toBeNull();
    expect(result.visitOrder).toEqual(['s', 'a', 'b', 'c', 'd', 'g']);
    expect(result.steps.at(-1)).toMatchObject({ queue: [], status: 'unreachable' });
    expect(result.steps.at(-1)?.distances).not.toHaveProperty('x');
  });
  it('supports full traversal without a goal and the single-node boundary', () => {
    const result = runBfs({ ...originalGraph, goal: null });
    expect(result.status).toBe('complete');
    expect(result.path).toBeNull();
    expect(result.steps.at(-1)?.status).toBe('complete');
    expect(
      trace({
        nodes: [{ id: 'only', label: 'Only' }],
        edges: [],
        directed: false,
        start: 'only',
        goal: null,
        neighborOrder: ['only'],
      }),
    ).toEqual([
      { current: null, queue: ['only'], discovered: ['only'], status: 'ready' },
      { current: 'only', queue: [], discovered: [], status: 'complete' },
    ]);
  });
  it('honors direction and undirected reverse adjacency while terminating self-loops', () => {
    const input: BfsInput = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bc', from: 'b', to: 'c' },
        { id: 'loop', from: 'b', to: 'b' },
      ],
      directed: true,
      start: 'c',
      goal: 'a',
      neighborOrder: ['a', 'b', 'c'],
    };
    expect(runBfs(input).status).toBe('unreachable');
    const result = runBfs({ ...input, directed: false });
    expect(result.path).toEqual(['c', 'b', 'a']);
    expect(result.visitOrder).toEqual(['c', 'b', 'a']);
  });
  it('executes the positive 12-node and 24-edge bounds with a bounded trace', () => {
    const nodes = Array.from({ length: 12 }, (_, index) => ({
      id: `n${index}`,
      label: `N${index}`,
    }));
    const chain: BfsInput = {
      nodes,
      edges: nodes
        .slice(1)
        .map((node, index) => ({ id: `chain${index}`, from: nodes[index].id, to: node.id })),
      directed: true,
      start: 'n0',
      goal: 'n11',
      neighborOrder: nodes.map((node) => node.id),
    };
    const result = runBfs(chain);
    expect(result.path).toEqual(nodes.map((node) => node.id));
    expect(result.steps).toHaveLength(13);
    expect(result.steps.at(-1)?.distances.n11).toBe(11);
    const edges = nodes.flatMap((node, index) =>
      [1, 2].map((offset) => ({
        id: `dense${index}-${offset}`,
        from: node.id,
        to: nodes[(index + offset) % 12].id,
      })),
    );
    const dense = runBfs({ ...chain, edges, goal: null });
    expect(edges).toHaveLength(24);
    expect(dense.visitOrder).toHaveLength(12);
    expect(dense.steps).toHaveLength(13);
  });
  it('detaches validated input and every trace snapshot', () => {
    const raw = structuredClone(originalGraph),
      result = runBfs(raw);
    raw.nodes[0].label = 'changed';
    raw.neighborOrder.reverse();
    result.steps[0].queue.push('x');
    result.steps[0].parents.a = 'x';
    result.steps[0].distances.s = 900;
    expect(result.input.nodes[0].label).toBe('S');
    expect(result.input.neighborOrder).toEqual(originalGraph.neighborOrder);
    expect(result.steps[1].queue).toEqual(['a', 'b']);
    expect(result.steps[1].parents.a).toBe('s');
    expect(result.steps[1].distances.s).toBe(0);
  });
  it('matches independent all-pairs shortest-distance references on 48 bounded graphs', () => {
    // Floyd–Warshall computes distances independently of the FIFO traversal.
    let random = 4381;
    const next = () => {
      random = (random * 1664525 + 1013904223) >>> 0;
      return random;
    };
    for (let trial = 0; trial < 48; trial++) {
      const count = 1 + (next() % 8),
        nodes = Array.from({ length: count }, (_, index) => ({
          id: `n${index}`,
          label: `Node ${index}`,
        })),
        directed = trial % 2 === 0;
      const edges: BfsInput['edges'] = [];
      for (let from = 0; from < count; from++)
        for (let to = directed ? 0 : from; to < count; to++)
          if (next() % 4 === 0 && edges.length < 24)
            edges.push({ id: `e${edges.length}`, from: nodes[from].id, to: nodes[to].id });
      const distances = Array.from({ length: count }, (_, i) =>
        Array.from({ length: count }, (_, j) => (i === j ? 0 : Infinity)),
      );
      for (const edge of edges) {
        const i = nodes.findIndex((n) => n.id === edge.from),
          j = nodes.findIndex((n) => n.id === edge.to);
        distances[i][j] = Math.min(distances[i][j], 1);
        if (!directed) distances[j][i] = Math.min(distances[j][i], 1);
      }
      for (let k = 0; k < count; k++)
        for (let i = 0; i < count; i++)
          for (let j = 0; j < count; j++)
            distances[i][j] = Math.min(distances[i][j], distances[i][k] + distances[k][j]);
      const start = next() % count,
        goal = next() % count,
        result = runBfs({
          nodes,
          edges,
          directed,
          start: nodes[start].id,
          goal: nodes[goal].id,
          neighborOrder: nodes.map((n) => n.id),
        });
      const expected = distances[start][goal];
      expect(result.status).toBe(Number.isFinite(expected) ? 'found' : 'unreachable');
      expect(result.path === null ? Infinity : result.path.length - 1).toBe(expected);
      if (result.path)
        for (let i = 1; i < result.path.length; i++)
          expect(
            edges.some(
              (edge) =>
                (edge.from === result.path![i - 1] && edge.to === result.path![i]) ||
                (!directed && edge.to === result.path![i - 1] && edge.from === result.path![i]),
            ),
          ).toBe(true);
      expect(new Set(result.visitOrder).size).toBe(result.visitOrder.length);
      expect(result.steps.length).toBeLessThanOrEqual(count + 1);
    }
  });
});
describe('BFS input and bounded generated exploration contracts', () => {
  it.each([
    (v: any) => {
      v.nodes.push({ ...v.nodes[0] });
    },
    (v: any) => {
      v.edges.push({ ...v.edges[0], id: 'other-edge' });
    },
    (v: any) => {
      v.neighborOrder.pop();
    },
    (v: any) => {
      v.neighborOrder[0] = 'unknown';
    },
    (v: any) => {
      v.start = 'unknown';
    },
    (v: any) => {
      v.goal = 'unknown';
    },
    (v: any) => {
      v.edges[0].to = 'unknown';
    },
    (v: any) => {
      v.edges[0].id = 's';
    },
    (v: any) => {
      v.edges[0].weight = 2;
    },
    (v: any) => {
      v.nodes[0].id = 'constructor';
    },
  ])('rejects malformed/weighted graph input %#', (change) => {
    const input = structuredClone(originalGraph);
    change(input);
    expect(() => runBfs(input)).toThrow();
  });
  it('enforces 12 nodes and 24 edges, including reversed duplicates in an undirected graph', () => {
    expect(
      bfsInputSchema.safeParse({
        ...originalGraph,
        nodes: Array.from({ length: 13 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })),
      }).success,
    ).toBe(false);
    const input = {
      ...originalGraph,
      edges: Array.from({ length: 25 }, (_, i) => ({ id: `edge${i}`, from: 's', to: 'a' })),
    };
    expect(() => runBfs(input)).toThrow();
    expect(() =>
      runBfs({
        ...originalGraph,
        directed: false,
        edges: [
          { id: 'sa', from: 's', to: 'a' },
          { id: 'as', from: 'a', to: 's' },
        ],
      }),
    ).toThrow();
  });
  it.each(['diagram-sidebar', 'comparison'] as const)(
    'validates a distinct original authored %s composition and derives checked traces',
    (layout) => {
      const candidate = createExampleExploration(undefined, layout),
        checked = checkExploration(candidate);
      expect(checked.validation.assurance).toBe('checked-bfs');
      expect(checked.executions?.primary.path).toEqual(['s', 'a', 'g']);
      if (layout === 'comparison') {
        expect(checked.executions?.comparison?.path).toEqual(['s', 'b', 'g']);
        expect(
          candidate.mode === 'checked-bfs' &&
            candidate.scene.panels.filter((panel) => panel.kind === 'graph'),
        ).toHaveLength(2);
      } else
        expect(
          candidate.mode === 'checked-bfs' &&
            candidate.scene.panels.filter((panel) => panel.kind === 'graph'),
        ).toHaveLength(1);
    },
  );
  it.each([
    (s: any) => {
      s.modelId = 'a-star';
    },
    (s: any) => {
      s.modelVersion = 'ideal-dc-two-resistor-v1-development';
    },
    (s: any) => {
      s.validation = { status: 'verified' };
    },
    (s: any) => {
      s.executions = { path: ['invented'] };
    },
    (s: any) => {
      s.generation = { model: 'pretend-live' };
    },
    (s: any) => {
      s.scene.panels[0].html = '<script>alert(1)</script>';
    },
    (s: any) => {
      s.scene.panels[0].placement.column = 2;
      s.scene.panels[0].placement.columnSpan = 2;
    },
    (s: any) => {
      s.scene.panels[1].placement = s.scene.panels[0].placement;
    },
    (s: any) => {
      s.scene.panels[0].positions.pop();
    },
    (s: any) => {
      s.scene.panels[0].positions[0].x = Infinity;
    },
    (s: any) => {
      s.scene.panels[0].positions[1] = { ...s.scene.panels[0].positions[0], nodeId: 'a' };
    },
    (s: any) => {
      s.scene.panels[0].positions[0].nodeId = 'unknown';
    },
    (s: any) => {
      s.scene.panels[1].execution = 'comparison';
    },
    (s: any) => {
      s.steps[0].highlightIds = ['unknown'];
    },
    (s: any) => {
      s.steps[0].executionStep = 12;
    },
    (s: any) => {
      s.steps[0].execution = null;
    },
    (s: any) => {
      s.steps[1].id = s.steps[0].id;
    },
    (s: any) => {
      s.sources[0].region = { x: 0.9, y: 0, width: 0.2, height: 1 };
    },
    (s: any) => {
      s.sources.push(s.sources[0]);
    },
  ])('rejects malicious or incoherent scene references %#', (change) => {
    expect(() => checkExploration(mutate(change))).toThrow();
  });
  it('keeps an explanatory diagram explicitly separate from checked simulation', () => {
    const initial = createExampleExploration();
    const common = Object.fromEntries(
      Object.entries(initial).filter(
        ([key]) =>
          ![
            'mode',
            'input',
            'comparison',
            'modelId',
            'modelVersion',
            'controls',
            'scene',
            'steps',
            'followups',
          ].includes(key),
      ),
    );
    const spec = {
      ...common,
      mode: 'explanation',
      scene: {
        layout: 'stack',
        panels: [
          {
            id: 'diagram',
            kind: 'diagram',
            title: 'An illustrative relation',
            placement: { column: 1, row: 1, columnSpan: 2 },
            objects: [
              { id: 'part-a', kind: 'node', label: 'First part', position: { x: 0.2, y: 0.5 } },
              { id: 'part-b', kind: 'node', label: 'Second part', position: { x: 0.8, y: 0.5 } },
              {
                id: 'relation',
                kind: 'edge',
                from: 'part-a',
                to: 'part-b',
                label: 'Illustrative',
                directed: true,
              },
            ],
          },
        ],
      },
      steps: [
        {
          id: 'explain',
          caption: 'This is an explanation, not a computed result.',
          narration: null,
          highlightIds: ['relation'],
          execution: null,
          executionStep: null,
        },
      ],
      followups: [],
    };
    const checked = checkExploration(spec);
    expect(checked.validation.assurance).toBe('explanation-only');
    expect(checked.executions).toBeNull();
    const comparison = {
      ...spec,
      scene: {
        layout: 'comparison',
        panels: [
          { ...spec.scene.panels[0], placement: { column: 1, row: 1, columnSpan: 1 } },
          {
            id: 'comparison-text',
            kind: 'text',
            title: 'A contrasting explanation',
            text: 'A visual comparison can remain explanatory.',
            placement: { column: 2, row: 1, columnSpan: 1 },
          },
        ],
      },
    };
    expect(checkExploration(comparison).validation.assurance).toBe('explanation-only');
    expect(() =>
      checkExploration({
        ...spec,
        scene: {
          ...spec.scene,
          panels: [
            {
              id: 'queue',
              kind: 'frontier',
              title: 'Pretend checked state',
              placement: { column: 1, row: 1, columnSpan: 2 },
              execution: 'primary',
            },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      checkExploration({
        ...spec,
        steps: [{ ...spec.steps[0], execution: 'primary', executionStep: 0 }],
      }),
    ).toThrow();
    expect(() =>
      checkExploration({
        ...spec,
        scene: {
          ...spec.scene,
          panels: [
            {
              ...spec.scene.panels[0],
              objects: [
                {
                  id: 'edge-only',
                  kind: 'edge',
                  from: 'missing',
                  to: 'missing',
                  label: '',
                  directed: true,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });
  it('requests clarification without inventing a checked graph or result', () => {
    const initial = createExampleExploration(),
      common = Object.fromEntries(
        Object.entries(initial).filter(([key]) =>
          [
            'schemaVersion',
            'id',
            'version',
            'title',
            'objective',
            'sources',
            'assumptions',
            'uncertainty',
            'unsupportedClaims',
          ].includes(key),
        ),
      );
    const spec = {
      ...common,
      mode: 'clarify',
      question: 'Is there an arrow from A to B? The selected image is unclear.',
    };
    const checked = checkExploration(spec);
    expect(checked.validation.assurance).toBe('needs-clarification');
    expect(checked.executions).toBeNull();
    expect(() => checkExploration({ ...spec, input: originalGraph })).toThrow();
  });
  it('preserves detached immutable version content and rejects oversized output', () => {
    const raw = createExampleExploration(),
      parsed = validateExplorationSpec(raw);
    raw.title = 'Changed externally';
    expect(parsed.title).not.toBe(raw.title);
    const oversized = mutate((spec: any) => {
      spec.scene.panels = [
        {
          id: 'large',
          kind: 'diagram',
          title: 'Large',
          placement: { column: 1, row: 1, columnSpan: 2 },
          objects: Array.from({ length: 30 }, (_, index) => ({
            id: `text${index}`,
            kind: 'text',
            text: 'x'.repeat(360),
            position: { x: 0.5, y: 0.5 },
          })),
        },
      ];
      spec.scene.layout = 'stack';
      spec.assumptions = Array(6).fill('x'.repeat(360));
      spec.uncertainty = Array(6).fill('x'.repeat(360));
      spec.unsupportedClaims = Array(6).fill('x'.repeat(360));
    });
    expect(() => validateExplorationSpec(oversized)).toThrow();
  });
});
