import { describe, expect, it } from 'vitest';
import {
  checkExploration,
  type ExplorationSpec,
  type BfsInput,
} from '../../src/lib/domain/exploration';
import {
  applyGraphControls,
  defaultGraphControls,
  graphControlsSchema,
  validateGraphControls,
  type GraphControls,
} from '../../src/lib/domain/graph-state';
import {
  comparisonExecution,
  explorationExecution,
  explorationInputsChanged,
  explorationNarration,
  graphExperimentActive,
  initialExplorationState,
} from '../../src/lib/domain/exploration-view';

// Hand-worked routes: A-C-D-F costs 7; A-C-E-F costs 9. D-F ties at 5.
function graphSpec(): Extract<ExplorationSpec, { mode: 'checked-bfs' | 'checked-dijkstra' }> {
  const input: BfsInput = {
    algorithm: 'dijkstra',
    directed: false,
    start: 'a',
    goal: 'f',
    nodes: ['a', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id.toUpperCase() })),
    neighborOrder: ['a', 'c', 'd', 'e', 'f'],
    edges: [
      { id: 'ac', from: 'a', to: 'c', weight: 1 },
      { id: 'cd', from: 'c', to: 'd', weight: 3 },
      { id: 'df', from: 'd', to: 'f', weight: 3 },
      { id: 'ce', from: 'c', to: 'e', weight: 4 },
      { id: 'ef', from: 'e', to: 'f', weight: 4 },
      { id: 'af', from: 'a', to: 'f', weight: 12 },
    ],
  };
  return {
    schemaVersion: 'exploration-v1',
    id: 'graph',
    version: 1,
    title: 'Route experiment',
    objective: 'Compare the routes.',
    sources: [{ observationId: 'source', version: 1, region: null }],
    assumptions: [],
    uncertainty: [],
    unsupportedClaims: [],
    mode: 'checked-dijkstra',
    modelId: 'dijkstra-nonnegative',
    modelVersion: 'dijkstra-nonnegative-v1',
    input,
    comparison: {
      label: 'BFS on the same graph',
      input: { ...structuredClone(input), algorithm: 'bfs' },
    },
    controls: [
      'step',
      'replay',
      'set-start',
      'set-goal',
      'toggle-edge',
      'reverse-neighbor-order',
      'set-weight',
    ],
    scene: {
      layout: 'diagram-sidebar',
      panels: [
        {
          id: 'primary',
          kind: 'graph',
          execution: 'primary',
          title: 'Current experiment',
          placement: { column: 1, row: 1, columnSpan: 1 },
          positions: input.nodes.map((node, i) => ({
            nodeId: node.id,
            x: i * 0.2,
            y: i % 2 ? 0.2 : 0.8,
          })),
        },
        {
          id: 'compare',
          kind: 'graph',
          execution: 'comparison',
          title: 'BFS comparison',
          placement: { column: 2, row: 1, columnSpan: 1 },
          positions: input.nodes.map((node, i) => ({
            nodeId: node.id,
            x: i * 0.2,
            y: i % 2 ? 0.2 : 0.8,
          })),
        },
        {
          id: 'frontier',
          kind: 'frontier',
          execution: 'primary',
          title: 'Priority frontier',
          placement: { column: 1, row: 2, columnSpan: 1 },
        },
      ],
    },
    steps: [
      {
        id: 'first',
        caption: 'A begins the search.',
        narration: 'Words for the active experiment.',
        execution: 'primary',
        executionStep: 0,
        highlightIds: ['a'],
      },
    ],
    followups: [],
  };
}
function withControls(spec: ReturnType<typeof graphSpec>, controls: Partial<GraphControls>) {
  return { ...defaultGraphControls(spec.input), ...controls };
}

describe('graph source and explanation experiment remain distinct', () => {
  it('retains source cost 3, computes changed cost 7.5, and restores source route 7', () => {
    const spec = graphSpec();
    spec.writtenFor = withControls(spec, { edgeWeights: { df: 7.5 } });
    const checked = checkExploration(spec);
    const active = { ...initialExplorationState(spec), ...spec.writtenFor };
    expect(checked.spec).toEqual(spec);
    expect(spec.input.edges.find((edge) => edge.id === 'df')!.weight).toBe(3);
    expect(spec.comparison!.input.edges.find((edge) => edge.id === 'df')!.weight).toBe(3);
    expect(checked.executions!.primary.path).toEqual(['a', 'c', 'e', 'f']);
    expect(checked.executions!.primary.steps.at(-1)!.distances.f).toBe(9);
    expect(explorationExecution(spec, active)).toEqual(checked.executions!.primary);
    expect(comparisonExecution(spec, active)).toEqual(checked.executions!.comparison);
    expect(explorationInputsChanged(spec, active)).toBe(false);
    expect(graphExperimentActive(spec, active)).toBe(true);
    expect(explorationNarration(spec, active)).toBe('Words for the active experiment.');
    const reset = initialExplorationState(spec);
    expect(explorationExecution(spec, reset)!.path).toEqual(['a', 'c', 'd', 'f']);
    expect(explorationExecution(spec, reset)!.steps.at(-1)!.distances.f).toBe(7);
    expect(graphExperimentActive(spec, reset)).toBe(false);
    expect(explorationInputsChanged(spec, reset)).toBe(true);
    expect(explorationNarration(spec, reset)).not.toBe('Words for the active experiment.');
  });

  it('keeps disabled edges available for re-enabling after serialization and a second reply', () => {
    const spec = graphSpec();
    spec.writtenFor = withControls(spec, { disabledEdgeIds: ['df'] });
    const reopened = checkExploration(JSON.parse(JSON.stringify(spec)));
    expect(reopened.executions!.primary.path).toEqual(['a', 'c', 'e', 'f']);
    expect(reopened.spec.mode).toBe('checked-dijkstra');
    if (reopened.spec.mode !== 'checked-dijkstra') throw Error();
    expect(reopened.spec.input.edges.some((edge) => edge.id === 'df')).toBe(true);
    const restored = { ...initialExplorationState(reopened.spec), disabledEdgeIds: [] };
    expect(explorationExecution(reopened.spec, restored)!.path).toEqual(['a', 'c', 'd', 'f']);
    const next = {
      ...reopened.spec,
      version: 2,
      writtenFor: defaultGraphControls(reopened.spec.input),
    };
    expect(checkExploration(next).executions!.primary.path).toEqual(['a', 'c', 'd', 'f']);
    expect(explorationInputsChanged(next, restored)).toBe(false);
  });

  it('preserves changed start, no goal and reversed order on both same-graph searches', () => {
    const spec = graphSpec();
    spec.writtenFor = withControls(spec, {
      start: 'f',
      goal: null,
      reversed: true,
      disabledEdgeIds: ['df'],
      edgeWeights: { ac: 2 },
    });
    const checked = checkExploration(spec);
    for (const run of Object.values(checked.executions!)) {
      expect(run.input).toMatchObject({
        start: 'f',
        goal: null,
        neighborOrder: ['f', 'e', 'd', 'c', 'a'],
      });
      expect(run.input.edges.some((edge) => edge.id === 'df')).toBe(false);
      expect(run.input.edges.find((edge) => edge.id === 'ac')!.weight).toBe(2);
      expect(run.status).toBe('complete');
    }
    expect(spec.input).toMatchObject({
      start: 'a',
      goal: 'f',
      neighborOrder: ['a', 'c', 'd', 'e', 'f'],
    });
  });

  it('keeps a distinct comparison goal and order while sharing matching costs', () => {
    const spec = graphSpec();
    spec.comparison!.input.goal = 'c';
    spec.writtenFor = withControls(spec, {
      start: 'f',
      goal: null,
      reversed: true,
      disabledEdgeIds: ['df'],
      edgeWeights: { ac: 2 },
    });
    const comparison = checkExploration(spec).executions!.comparison!;
    expect(comparison.input).toMatchObject({
      start: 'a',
      goal: 'c',
      neighborOrder: ['a', 'c', 'd', 'e', 'f'],
    });
    expect(comparison.input.edges.some((edge) => edge.id === 'df')).toBe(true);
    expect(comparison.input.edges.find((edge) => edge.id === 'ac')!.weight).toBe(2);
  });

  it('validates authored trace indices against the written experiment, including a shorter trace', () => {
    const spec = graphSpec();
    spec.input.goal = 'a';
    spec.comparison = null;
    spec.scene.panels = spec.scene.panels.filter((panel) => panel.id !== 'compare');
    spec.writtenFor = withControls(spec, { goal: 'f' });
    spec.steps[0].executionStep = 5;
    expect(checkExploration(spec).executions!.primary.path).toEqual(['a', 'c', 'd', 'f']);
    spec.writtenFor.goal = 'a';
    expect(() => checkExploration(spec)).toThrow('unavailable checked state');
  });

  it('keeps legacy graph specs valid with source-default controls and unchanged narration', () => {
    const spec = graphSpec();
    expect(checkExploration(spec).executions!.primary.steps.at(-1)!.distances.f).toBe(7);
    expect(explorationInputsChanged(spec, initialExplorationState(spec))).toBe(false);
    expect(explorationNarration(spec, initialExplorationState(spec))).toBe(
      'Words for the active experiment.',
    );
    expect(checkExploration({ ...spec, writtenFor: null }).executions).toEqual(
      checkExploration(spec).executions,
    );
  });
});

describe('bounded graph explanation controls', () => {
  it.each([
    { start: 'foreign' },
    { goal: 'foreign' },
    { disabledEdgeIds: ['foreign'] },
    { disabledEdgeIds: ['df', 'df'] },
    { edgeWeights: { foreign: 2 } },
    { edgeWeights: { df: -1 } },
    { edgeWeights: { df: 1000001 } },
    { edgeWeights: { df: Infinity } },
    { step: 2 },
    { selectedObjectId: 'df' },
    { spatial: {} },
  ])('rejects foreign, out-of-range or presentation fields: %j', (change) => {
    const spec = graphSpec();
    expect(() =>
      validateGraphControls(spec.input, { ...defaultGraphControls(spec.input), ...change }),
    ).toThrow();
    expect(() =>
      checkExploration({ ...spec, writtenFor: { ...defaultGraphControls(spec.input), ...change } }),
    ).toThrow();
  });

  it.each([
    ['set-start', { start: 'f' }],
    ['set-goal', { goal: null }],
    ['toggle-edge', { disabledEdgeIds: ['df'] }],
    ['reverse-neighbor-order', { reversed: true }],
    ['set-weight', { edgeWeights: { df: 7.5 } }],
  ] as const)('requires the corresponding %s control', (control, change) => {
    const spec = graphSpec();
    spec.controls = spec.controls.filter((item) => item !== control);
    expect(() =>
      checkExploration({ ...spec, writtenFor: { ...defaultGraphControls(spec.input), ...change } }),
    ).toThrow('unavailable interaction');
  });

  it('bounds map size and detaches applied inputs from the source', () => {
    const spec = graphSpec();
    expect(
      graphControlsSchema.safeParse(
        withControls(spec, {
          edgeWeights: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`edge${i}`, 1])),
        }),
      ).success,
    ).toBe(false);
    const effective = applyGraphControls(
      spec.input,
      withControls(spec, { edgeWeights: { df: 7.5 } }),
    );
    effective.nodes[0].label = 'Changed';
    effective.neighborOrder.reverse();
    expect(spec.input.nodes[0].label).toBe('A');
    expect(spec.input.neighborOrder[0]).toBe('a');
    expect(spec.input.edges.find((edge) => edge.id === 'df')!.weight).toBe(3);
  });
});
