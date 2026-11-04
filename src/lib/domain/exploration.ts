import { spatialPanelSchema, validateSpatialPanel } from './spatial-schema';
import { z } from 'zod';
import {
  bfsInputSchema,
  runBfs,
  sceneIdSchema,
  BFS_MODEL_ID,
  BFS_MODEL_VERSION,
  type BfsExecution,
  type BfsInput,
} from './graph-search';
import { dcInputSchema, dcValueAllowed, solveDc, DC_MODEL_ID, DC_MODEL_VERSION, type DcInput, type DcSolution } from './dc-circuit';
import { graphControlsSchema, defaultGraphControls, validateGraphControls, applyGraphControls, applyComparisonGraphControls } from './graph-state';
export { bfsInputSchema, runBfs, BFS_MODEL_ID, BFS_MODEL_VERSION } from './graph-search';
export { DC_MODEL_ID, DC_MODEL_VERSION } from './dc-circuit';
export type { DcInput, DcSolution } from './dc-circuit';
export type { BfsInput, BfsExecution, BfsStep } from './graph-search';

const text = z.string().trim().min(1).max(360),
  short = z.string().trim().min(1).max(100);
const point = z.strictObject({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});
const region = z
  .strictObject({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .refine(
    (value) => value.x + value.width <= 1 && value.y + value.height <= 1,
    'Source region must stay inside the capture.',
  );
export const sourceObservationRefSchema = z.strictObject({
  observationId: sceneIdSchema,
  version: z.number().int().positive(),
  region: region.nullable(),
});
const placement = z.strictObject({
  column: z.union([z.literal(1), z.literal(2)]),
  row: z.number().int().min(1).max(4),
  columnSpan: z.union([z.literal(1), z.literal(2)]),
});
const panelBase = { id: sceneIdSchema, title: short, placement };
const execution = z.enum(['primary', 'comparison']);
export const diagramObjectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id: sceneIdSchema, kind: z.literal('block'), label: short, position: point }),
  z.strictObject({ id: sceneIdSchema, kind: z.literal('node'), label: short, position: point }),
  z.strictObject({
    id: sceneIdSchema,
    kind: z.literal('edge'),
    from: sceneIdSchema,
    to: sceneIdSchema,
    label: z.string().max(80),
    directed: z.boolean(),
  }),
  z.strictObject({ id: sceneIdSchema, kind: z.literal('text'), text, position: point }),
]);
export const explorationPanelSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...panelBase,
    kind: z.literal('sequence'),
    items: z
      .array(z.strictObject({ id: sceneIdSchema, label: short }))
      .min(1)
      .max(12),
  }),
  z.strictObject({
    ...panelBase,
    kind: z.literal('matrix'),
    rows: z
      .array(z.array(z.string().max(32)).min(1).max(6))
      .min(1)
      .max(6),
  }),
  z.strictObject({
    ...panelBase,
    kind: z.literal('callout'),
    text,
    tone: z.enum(['idea', 'assumption']),
  }),
  z.strictObject({
    ...panelBase,
    kind: z.literal('graph'),
    execution,
    positions: z
      .array(z.strictObject({ nodeId: sceneIdSchema, ...point.shape }))
      .min(1)
      .max(12),
  }),
  z.strictObject({ ...panelBase, kind: z.literal('frontier'), execution }),
  z.strictObject({ ...panelBase, kind: z.literal('state-table'), execution }),
  z.strictObject({ ...panelBase, kind: z.literal('steps') }),
  z.strictObject({ ...panelBase, kind: z.literal('text'), text }),
  z.strictObject({
    ...panelBase,
    kind: z.literal('diagram'),
    objects: z.array(diagramObjectSchema).min(1).max(30),
  }),
  spatialPanelSchema,
  // Appended last: the server addresses earlier members by position.
  z.strictObject({
    ...panelBase,
    kind: z.literal('circuit'),
    execution: z.literal('primary'),
    positions: z
      .array(z.strictObject({ nodeId: sceneIdSchema, ...point.shape }))
      .min(2)
      .max(10),
  }),
]);
const scene = z.strictObject({
  layout: z.enum(['diagram-sidebar', 'comparison', 'stack']),
  panels: z.array(explorationPanelSchema).min(1).max(6),
});
const step = z.strictObject({
  id: sceneIdSchema,
  caption: text,
  narration: text.nullable(),
  highlightIds: z.array(sceneIdSchema).max(24),
  sourceHighlightIds: z.array(sceneIdSchema).max(6).optional(),
  execution: execution.nullable(),
  executionStep: z.number().int().min(0).max(12).nullable(),
});
const common = {
  schemaVersion: z.literal('exploration-v1'),
  id: sceneIdSchema,
  version: z.number().int().positive(),
  title: short,
  objective: text,
  sources: z.array(sourceObservationRefSchema).min(1).max(4),
  assumptions: z.array(text).max(6),
  uncertainty: z.array(text).max(6),
  unsupportedClaims: z.array(text).max(6),
};
export const explorationSpecSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    ...common,
    mode: z.enum(['checked-bfs', 'checked-dijkstra']),
    modelId: z.enum([BFS_MODEL_ID, 'dijkstra-nonnegative']),
    modelVersion: z.enum([BFS_MODEL_VERSION, 'dijkstra-nonnegative-v1']),
    input: bfsInputSchema,
    comparison: z.strictObject({ label: short, input: bfsInputSchema }).nullable(),
    /** Controls whose effective trace the explanation describes; input remains the base graph. */
    writtenFor: graphControlsSchema.nullable().optional(),
    scene,
    steps: z.array(step).min(1).max(12),
    controls: z
      .array(
        z.enum([
          'step',
          'replay',
          'set-start',
          'set-goal',
          'toggle-edge',
          'reverse-neighbor-order',
          'set-weight',
        ]),
      )
      .min(1)
      .max(7),
    followups: z.array(text).max(4),
  }),
  z.strictObject({
    ...common,
    mode: z.literal('explanation'),
    scene,
    steps: z
      .array(step.extend({ execution: z.null(), executionStep: z.null() }))
      .min(1)
      .max(12),
    followups: z.array(text).max(4),
  }),
  z.strictObject({ ...common, mode: z.literal('clarify'), question: text }),
  // Appended last: the server addresses earlier members by position.
  z.strictObject({
    ...common,
    mode: z.literal('checked-circuit'),
    modelId: z.literal(DC_MODEL_ID),
    modelVersion: z.literal(DC_MODEL_VERSION),
    input: dcInputSchema,
    /** The experiment the words were written for, when a follow-up was asked during one. */
    writtenFor: z
      .strictObject({
        open: z.array(sceneIdSchema).max(16),
        values: z.record(sceneIdSchema, z.number().finite()),
      })
      .nullable()
      .optional(),
    scene,
    steps: z.array(step).min(1).max(12),
    controls: z.array(z.enum(['step', 'replay', 'open-component', 'set-value'])).min(1).max(4),
    followups: z.array(text).max(4),
  }),
]);
export type ExplorationSpec = z.infer<typeof explorationSpecSchema>;
export type ExplorationPanel = z.infer<typeof explorationPanelSchema>;
export type SourceObservationRef = z.infer<typeof sourceObservationRefSchema>;
export type CheckedExploration = {
  spec: ExplorationSpec;
  validation: {
    assurance:
      | 'checked-bfs'
      | 'checked-dijkstra'
      | 'checked-circuit'
      | 'explanation-only'
      | 'needs-clarification';
    modelVersion: typeof BFS_MODEL_VERSION | 'dijkstra-nonnegative-v1' | typeof DC_MODEL_VERSION | null;
    checks: string[];
  };
  executions: { primary: BfsExecution; comparison?: BfsExecution } | null;
  /** The circuit as read, solved; present only for checked circuits. */
  circuit?: DcSolution;
};
/** Structural + cross-reference checks; server must separately bind every
 * source observation/version to the caller and current authorized turn. */
export function validateExplorationSpec(raw: unknown): ExplorationSpec {
  const spec = explorationSpecSchema.parse(raw);
  const reject = (message: string): never => {
    throw new Error(message);
  };
  if (new TextEncoder().encode(JSON.stringify(spec)).byteLength > 16_384)
    reject('Exploration payload exceeds the supported bound.');
  const sources = new Set<string>();
  for (const ref of spec.sources) {
    const id = `${ref.observationId}:${ref.version}`;
    if (sources.has(id)) reject('Source references must be unique.');
    sources.add(id);
  }
  if (spec.mode === 'clarify') return spec;
  if (
    spec.mode === 'checked-dijkstra' &&
    (spec.input.algorithm !== 'dijkstra' ||
      spec.modelId !== 'dijkstra-nonnegative' ||
      spec.modelVersion !== 'dijkstra-nonnegative-v1')
  )
    reject('Dijkstra model binding mismatch.');
  if (
    spec.mode === 'checked-bfs' &&
    (spec.input.algorithm === 'dijkstra' ||
      spec.modelId !== BFS_MODEL_ID ||
      spec.modelVersion !== BFS_MODEL_VERSION)
  )
    reject('BFS model binding mismatch.');
  const ids = new Set<string>(),
    objects = new Map<string, string>(),
    occupied = new Set<string>();
  const addId = (id: string) => {
    if (ids.has(id)) reject('Scene object IDs must be unique.');
    ids.add(id);
  };
  const graphInputs: { primary: BfsInput; comparison?: BfsInput } | null =
    spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra'
      ? { primary: spec.input, ...(spec.comparison ? { comparison: spec.comparison.input } : {}) }
      : null;
  if (graphInputs)
    for (const input of Object.values(graphInputs)) {
      for (const node of input.nodes) {
        const identity = JSON.stringify(['node', node.label]);
        if (objects.has(node.id) && objects.get(node.id) !== identity)
          reject('Stable graph IDs must retain their meaning.');
        objects.set(node.id, identity);
      }
      for (const edge of input.edges) {
        const identity = JSON.stringify(['edge', edge.from, edge.to]);
        if (objects.has(edge.id) && objects.get(edge.id) !== identity)
          reject('Stable graph IDs must retain their meaning.');
        objects.set(edge.id, identity);
      }
    }
  let circuit: DcSolution | null = null;
  if (spec.mode === 'checked-circuit') {
    for (const node of spec.input.nodes) objects.set(node.id, JSON.stringify(['node', node.label]));
    for (const component of spec.input.components) objects.set(component.id, component.kind);
    circuit = solveDc(spec.input);
    if (circuit.status !== 'solved') reject('The circuit as read has no single solution.');
    if (spec.writtenFor) {
      const parts = new Map(spec.input.components.map((c) => [c.id, c]));
      const experiment = solveDc(spec.input, spec.writtenFor);
      if (
        new Set(spec.writtenFor.open).size !== spec.writtenFor.open.length ||
        (spec.writtenFor.open.length && !spec.controls.includes('open-component')) ||
        (Object.keys(spec.writtenFor.values).length && !spec.controls.includes('set-value')) ||
        spec.writtenFor.open.some((id) => !parts.has(id)) ||
        Object.entries(spec.writtenFor.values).some(([id, v]) => !parts.has(id) || !dcValueAllowed(parts.get(id)!.kind, v)) ||
        experiment.status !== 'solved'
      )
        reject('Step references an unavailable checked state.');
      // Steps bind to the experiment's own trace.
      circuit = experiment;
    }
  }
  for (const id of objects.keys()) addId(id);
  const executions: { primary: BfsExecution; comparison?: BfsExecution } | null =
    spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra'
      ? graphExecutions(spec)
      : null;
  if (spec.scene.panels.filter((panel) => panel.kind === 'spatial').length > 1)
    reject('Only one spatial workspace is supported.');
  for (const panel of spec.scene.panels) {
    addId(panel.id);
    if (panel.kind === 'spatial') {
      if (spec.mode !== 'explanation') reject('Spatial schematics require explanation-only mode.');
      validateSpatialPanel(panel, spec.steps);
      for (const object of panel.objects) addId(object.id);
      for (const connection of panel.connections) addId(connection.id);
    }
    const { column, row, columnSpan } = panel.placement;
    if (column + columnSpan > 3) reject('Panel placement exceeds the approved grid.');
    if (spec.scene.layout === 'stack' && (column !== 1 || columnSpan !== 2))
      reject('Stack panels must fill one bounded row.');
    for (let col = column; col < column + columnSpan; col++) {
      const cell = `${row}:${col}`;
      if (occupied.has(cell)) reject('Panel placements overlap.');
      occupied.add(cell);
    }
    if (panel.kind === 'circuit') {
      if (spec.mode !== 'checked-circuit') reject('A circuit panel requires a checked circuit.');
      const input = (spec as { input: DcInput }).input;
      const positions = panel.positions.map((position) => position.nodeId);
      if (
        positions.length !== input.nodes.length ||
        new Set(positions).size !== positions.length ||
        input.nodes.some((node) => !positions.includes(node.id))
      )
        reject('Every circuit node requires one approved position.');
    } else if ('execution' in panel) {
      if (!graphInputs || !Object.hasOwn(graphInputs, panel.execution))
        reject('Panel references an unavailable execution.');
      if (panel.kind === 'graph') {
        const input = graphInputs![panel.execution]!;
        const positions = panel.positions.map((position) => position.nodeId);
        if (
          positions.length !== input.nodes.length ||
          new Set(positions).size !== positions.length ||
          input.nodes.some((node) => !positions.includes(node.id))
        )
          reject('Every graph node requires one approved position.');
        for (let i = 0; i < panel.positions.length; i++)
          for (let j = i + 1; j < panel.positions.length; j++)
            if (
              Math.hypot(
                panel.positions[i].x - panel.positions[j].x,
                panel.positions[i].y - panel.positions[j].y,
              ) < 0.08
            )
              reject('Graph node positions must remain distinguishable.');
      }
    }
    if (panel.kind === 'sequence') for (const item of panel.items) addId(item.id);
    if (panel.kind === 'matrix' && panel.rows.some((row) => row.length !== panel.rows[0].length))
      reject('Matrix rows must have equal length.');
    if (panel.kind === 'diagram') {
      for (const object of panel.objects) addId(object.id);
      const localNodes = new Set(
        panel.objects
          .filter((object) => object.kind === 'node' || object.kind === 'block')
          .map((object) => object.id),
      );
      for (const object of panel.objects)
        if (object.kind === 'edge' && (!localNodes.has(object.from) || !localNodes.has(object.to)))
          reject('Diagram edges must reference nodes in their own panel.');
    }
  }
  if (spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') {
    if (new Set(spec.controls).size !== spec.controls.length) reject('Controls must be unique.');
    if (!spec.scene.panels.some((panel) => panel.kind === 'graph' && panel.execution === 'primary'))
      reject('A checked experiment requires its primary graph.');
    if (
      !spec.scene.panels.some((panel) => panel.kind === 'frontier' || panel.kind === 'state-table')
    )
      reject('A checked graph requires visible algorithm state.');
    if (
      spec.comparison &&
      !spec.scene.panels.some((panel) => panel.kind === 'graph' && panel.execution === 'comparison')
    )
      reject('A checked comparison requires its visible graph.');
    if (spec.scene.layout === 'comparison' && !spec.comparison)
      reject('Comparison layout requires both checked graphs.');
  }
  if (spec.mode === 'checked-circuit') {
    if (new Set(spec.controls).size !== spec.controls.length) reject('Controls must be unique.');
    if (!spec.scene.panels.some((panel) => panel.kind === 'circuit'))
      reject('A checked circuit requires its circuit panel.');
    if (spec.scene.layout === 'comparison') reject('A checked circuit has no comparison.');
  }
  const traces: Record<string, { steps: unknown[] }> | null = circuit
    ? { primary: circuit }
    : executions;
  for (const item of spec.steps) {
    addId(item.id);
    if ((item.execution === null) !== (item.executionStep === null))
      reject('A step binding requires both execution and trace index.');
    if (
      item.execution !== null &&
      (!traces ||
        !Object.hasOwn(traces, item.execution) ||
        item.executionStep! >= traces[item.execution]!.steps.length)
    )
      reject('Step references an unavailable checked state.');
  }
  for (const item of spec.steps)
    if (item.highlightIds.some((id) => !ids.has(id)))
      reject('Highlight references an unknown scene object.');
  return spec;
}
/** The application computes this envelope. Model-supplied validation/results
 * fields are rejected by the strict spec schema and cannot grant assurance. */
export function checkExploration(raw: unknown): CheckedExploration {
  const spec = validateExplorationSpec(raw);
  if (spec.mode === 'clarify')
    return {
      spec,
      validation: {
        assurance: 'needs-clarification',
        modelVersion: null,
        checks: ['schema', 'references'],
      },
      executions: null,
    };
  if (spec.mode === 'explanation')
    return {
      spec,
      validation: {
        assurance: 'explanation-only',
        modelVersion: null,
        checks: ['schema', 'references'],
      },
      executions: null,
    };
  if (spec.mode === 'checked-circuit')
    return {
      spec,
      validation: {
        assurance: 'checked-circuit',
        modelVersion: spec.modelVersion,
        checks: ['schema', 'references', 'circuit-input', 'kirchhoff', 'deterministic-trace'],
      },
      executions: null,
      circuit: solveDc(spec.input),
    };
  return {
    spec,
    validation: {
      assurance: spec.mode,
      modelVersion: spec.modelVersion,
      checks: [
        'schema',
        'references',
        spec.mode === 'checked-dijkstra' ? 'dijkstra-input' : 'bfs-input',
        'deterministic-trace',
      ],
    },
    executions: graphExecutions(spec),
  };
}

function graphExecutions(spec: Extract<ExplorationSpec, { mode: 'checked-bfs' | 'checked-dijkstra' }>) {
  const controls = validateGraphControls(spec.input, spec.writtenFor ?? defaultGraphControls(spec.input), spec.controls);
  return {
    primary: runBfs(applyGraphControls(spec.input, controls)),
    ...(spec.comparison ? { comparison: runBfs(applyComparisonGraphControls(spec.input, spec.comparison.input, controls)) } : {}),
  };
}

/** Original authored development example; it is never live generation or an
 * actual course observation. The caller supplies its authoritative source ref. */
export function createExampleExploration(
  sourceRef: SourceObservationRef = {
    observationId: 'original-bfs-example',
    version: 1,
    region: null,
  },
  layout: 'diagram-sidebar' | 'comparison' = 'diagram-sidebar',
): ExplorationSpec {
  const input: BfsInput = {
    nodes: [
      { id: 's', label: 'S' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'g', label: 'Goal' },
      { id: 'x', label: 'Unconnected X' },
    ],
    edges: [
      { id: 'sa', from: 's', to: 'a' },
      { id: 'sb', from: 's', to: 'b' },
      { id: 'ag', from: 'a', to: 'g' },
      { id: 'bg', from: 'b', to: 'g' },
      { id: 'ac', from: 'a', to: 'c' },
      { id: 'cs', from: 'c', to: 's' },
    ],
    directed: true,
    start: 's',
    goal: 'g',
    neighborOrder: ['s', 'a', 'b', 'c', 'g', 'x'],
  };
  const positions = [
    { nodeId: 's', x: 0.12, y: 0.45 },
    { nodeId: 'a', x: 0.43, y: 0.2 },
    { nodeId: 'b', x: 0.43, y: 0.75 },
    { nodeId: 'c', x: 0.72, y: 0.15 },
    { nodeId: 'g', x: 0.82, y: 0.65 },
    { nodeId: 'x', x: 0.12, y: 0.88 },
  ];
  const panels: ExplorationPanel[] =
    layout === 'comparison'
      ? [
          {
            id: 'graph-primary',
            kind: 'graph',
            title: 'A before B',
            execution: 'primary',
            placement: { column: 1, row: 1, columnSpan: 1 },
            positions,
          },
          {
            id: 'graph-comparison',
            kind: 'graph',
            title: 'B before A',
            execution: 'comparison',
            placement: { column: 2, row: 1, columnSpan: 1 },
            positions,
          },
          {
            id: 'queue-primary',
            kind: 'frontier',
            title: 'Original FIFO frontier',
            execution: 'primary',
            placement: { column: 1, row: 2, columnSpan: 1 },
          },
          {
            id: 'queue-comparison',
            kind: 'frontier',
            title: 'Changed FIFO frontier',
            execution: 'comparison',
            placement: { column: 2, row: 2, columnSpan: 1 },
          },
          {
            id: 'explanation-steps',
            kind: 'steps',
            title: 'What changes?',
            placement: { column: 1, row: 3, columnSpan: 2 },
          },
        ]
      : [
          {
            id: 'graph-primary',
            kind: 'graph',
            title: 'An original unweighted graph',
            execution: 'primary',
            placement: { column: 1, row: 1, columnSpan: 1 },
            positions,
          },
          {
            id: 'queue-primary',
            kind: 'frontier',
            title: 'First in, first out',
            execution: 'primary',
            placement: { column: 2, row: 1, columnSpan: 1 },
          },
          {
            id: 'explanation-steps',
            kind: 'steps',
            title: 'Why this node next?',
            placement: { column: 1, row: 2, columnSpan: 2 },
          },
        ];
  return validateExplorationSpec({
    schemaVersion: 'exploration-v1',
    id: 'original-bfs-exploration',
    version: 1,
    mode: 'checked-bfs',
    title:
      layout === 'comparison'
        ? 'Same shortest distance, different tie order'
        : 'Why does A come before B?',
    objective:
      'Inspect how a FIFO frontier and explicit neighbor order determine breadth-first traversal.',
    sources: [sourceRef],
    assumptions: [
      'Every edge has equal cost.',
      'The graph is directed; arrows define permitted travel.',
      'A node is marked visited when enqueued; the goal stops the search when dequeued.',
    ],
    uncertainty: ['This is an original synthetic example, not a reading of your coursework.'],
    unsupportedClaims: [
      'This model does not solve weighted shortest paths or prove understanding.',
    ],
    modelId: BFS_MODEL_ID,
    modelVersion: BFS_MODEL_VERSION,
    input,
    comparison:
      layout === 'comparison'
        ? {
            label: 'Reverse neighbor order',
            input: { ...input, neighborOrder: [...input.neighborOrder].reverse() },
          }
        : null,
    scene: { layout, panels },
    steps: [
      {
        id: 'step-initial',
        caption: 'The frontier starts with S. No node has been expanded.',
        narration: null,
        highlightIds: ['s'],
        execution: 'primary',
        executionStep: 0,
      },
      {
        id: 'step-neighbors',
        caption: 'After S is removed, A and B join the frontier in the declared neighbor order.',
        narration: null,
        highlightIds: ['s', 'a', 'b', 'sa', 'sb'],
        execution: 'primary',
        executionStep: 1,
      },
      {
        id: 'step-first',
        caption:
          'A is removed next because it entered the FIFO frontier before B, regardless of its position on the drawing.',
        narration: null,
        highlightIds: ['a', 'queue-primary'],
        execution: 'primary',
        executionStep: 2,
      },
    ],
    controls: ['step', 'replay', 'set-start', 'set-goal', 'toggle-edge', 'reverse-neighbor-order'],
    followups: [
      'Show the same graph with a different starting node.',
      'Compare the opposite neighbor order.',
    ],
  });
}

export function createWeightedExample(sourceRef: SourceObservationRef): ExplorationSpec {
  const base = createExampleExploration(sourceRef, 'comparison');
  if (base.mode !== 'checked-bfs' && base.mode !== 'checked-dijkstra') throw new Error();
  const input: BfsInput = {
    ...base.input,
    algorithm: 'dijkstra',
    edges: [
      { id: 'sg', from: 's', to: 'g', weight: 10 },
      { id: 'sa', from: 's', to: 'a', weight: 1 },
      { id: 'ab', from: 'a', to: 'b', weight: 1 },
      { id: 'bg', from: 'b', to: 'g', weight: 1 },
      { id: 'sc', from: 's', to: 'c', weight: 2 },
      { id: 'cg', from: 'c', to: 'g', weight: 6 },
    ],
  };
  return validateExplorationSpec({
    ...base,
    controls: [...base.controls, 'set-weight'],
    mode: 'checked-dijkstra',
    modelId: 'dijkstra-nonnegative',
    modelVersion: 'dijkstra-nonnegative-v1',
    input,
    comparison: { label: 'BFS ignores costs', input: { ...input, algorithm: 'bfs' } },
    title: 'Fewest edges or lowest cost?',
    objective: 'Compare FIFO BFS with Dijkstra on the same weighted graph.',
    assumptions: [
      'Costs are nonnegative.',
      'Dijkstra settles lowest tentative cost; equal costs use declared node order.',
      'BFS deliberately ignores weights in this comparison.',
    ],
    unsupportedClaims: [
      'Negative costs are unsupported. Exploration is not independent understanding.',
    ],
    scene: {
      ...base.scene,
      panels: base.scene.panels.map((p) => ({
        ...p,
        title:
          p.id === 'graph-primary'
            ? 'Dijkstra · lowest cost'
            : p.id === 'graph-comparison'
              ? 'BFS · fewest edges'
              : p.id === 'queue-primary'
                ? 'Priority frontier · cost order'
                : p.id === 'queue-comparison'
                  ? 'FIFO frontier · edge count'
                  : p.title,
      })),
    },
    steps: [
      {
        id: 'weighted-start',
        caption: 'Both searches start at S. Compare their queue rules.',
        narration: null,
        highlightIds: ['s'],
        execution: 'primary',
        executionStep: 0,
      },
    ],
    followups: [
      'Explain why the direct route costs more.',
      'Show how tentative costs improve before a node is settled.',
    ],
  });
}
