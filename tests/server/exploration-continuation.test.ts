import {
  initialExplorationState,
  explorationExecution,
  comparisonExecution,
} from '../../src/lib/domain/exploration-view';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService } from '../../src/lib/server/exploration';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import {
  explorationContinuationSchema,
  continuationSchemaFor,
} from '../../src/lib/server/exploration-continuation';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import type { MetaResult } from '../../src/lib/server/meta-client';

const owner: ExplorationPrincipal = {
  kind: 'guest',
  id: 'c'.repeat(64),
  workspaceId: 'c'.repeat(64),
  generation: 'c'.repeat(64),
  key: `guest-${'c'.repeat(64)}`,
};
const result = (name: string, value: unknown): MetaResult => ({
  status: 'completed',
  tools: [
    {
      type: 'function_call',
      name,
      call_id: randomUUID(),
      arguments: JSON.stringify(value),
      parsedArguments: value as Record<string, unknown>,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 100 },
});
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-continue-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'test.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

async function harness(
  options: {
    explanation?: boolean;
    weighted?: boolean;
    fullScene?: boolean;
    badReference?: boolean;
    reviewReject?: boolean;
    newSource?: boolean;
  } = {},
) {
  const request = vi.fn(async (r: any) => {
    if (!r.instructions.includes('Required spec id='))
      return result('inspect_source', {
        summary: 'An original synthetic graph or explanation fixture',
        uncertainty: [],
        graph: null,
      });
    const c = JSON.parse(r.input[0].content),
      prior = c.previous.spec;
    if (options.fullScene) {
      const spec = structuredClone(prior),
        binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(r.instructions)!;
      spec.id = binding[1];
      spec.version = Number(binding[2]);
      spec.scene.panels.push({
        id: 'additional_context',
        kind: 'text',
        title: 'Source context',
        text: 'This is supporting context for the current explanation.',
        placement: { column: 1, row: 4, columnSpan: 2 },
      });
      return result('compose_exploration', { spec });
    }
    return result('compose_exploration', {
      spec: {
        mode: 'continue',
        title: 'A focused continuation',
        objective: 'Explain the selected part without rewriting the visual.',
        assumptions: prior.assumptions,
        steps: [
          {
            id: 'reply_step',
            caption: 'Follow this existing connection.',
            narration: 'Read the current state before the next step.',
            highlightIds: options.badReference
              ? ['invented_object']
              : prior.mode === 'explanation'
                ? [prior.scene.panels[0].id]
                : [c.graph.nodes[0].id],
            sourceHighlightIds: [],
            execution: prior.mode === 'explanation' ? null : 'primary',
            executionStep: prior.mode === 'explanation' ? null : 0,
          },
        ],
        followups: [],
      },
    });
  });
  const review = vi.fn(async () =>
    result(
      'review_exploration',
      options.reviewReject
        ? { verdict: 'revise', findings: ['The caption is unsupported by the source.'] }
        : { verdict: 'approve', findings: [] },
    ),
  );
  const service = createExplorationService({
    request: request as never,
    review,
    reviewEnabled: () => true,
    enabled: () => true,
    reserve: async () => randomUUID(),
    settle: async () => {},
    upperBound: () => 0.01,
    revalidate: async () => {},
  });
  await service.initialize(owner);
  let a = (await service.example(owner, !!options.weighted)).artifact;
  if (options.explanation) {
    const spec = JSON.parse(
      readFileSync('tests/fixtures/visual-polish-scenes.json', 'utf8'),
    ).gradient;
    spec.id = a.spec.id;
    spec.version = a.version;
    spec.sources = a.spec.sources;
    a = { ...a, ...checkExploration(spec), state: initialExplorationState(spec) };
    await explorationStore.mutate(owner, (s) => {
      s.artifacts = [a];
    });
  }
  const turn = {
    action: 'generate',
    requestId: randomUUID(),
    artifactId: a.id,
    baseVersion: a.version,
    question: 'Explain this current part more simply.',
    intent: 'explain',
    state: {
      ...a.state,
      reversed: !options.explanation,
      disabledEdgeIds: options.explanation ? [] : ['sa'],
    },
    ...(options.newSource
      ? {
          source: {
            kind: 'example',
            label: 'New explicit source',
            capturedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
  return { service, request, review, a, turn };
}

it.each([false, true])(
  'publishes a compact continuation with unchanged source/geometry and actual review: explanation=%s',
  async (explanation) => {
    const h = await harness({ explanation });
    const out = (await h.service.generate(owner, h.turn)).artifact;
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.review).toHaveBeenCalledTimes(explanation ? 1 : 0);
    expect(out.generation.calls).toBe(explanation ? 2 : 1);
    expect(out.spec.mode).toBe(h.a.spec.mode);
    if (out.spec.mode === 'clarify' || h.a.spec.mode === 'clarify') throw Error('fixture');
    expect(out.spec.scene).toEqual({
      ...h.a.spec.scene,
      panels: h.a.spec.scene.panels.map((panel) =>
        panel.kind === 'graph'
          ? {
              ...panel,
              title: panel.execution === 'primary' ? 'Current experiment' : 'Comparison experiment',
            }
          : panel,
      ),
    });
    expect(out.spec.sources).toEqual(h.a.spec.sources);
    expect(out.source).toEqual(h.a.source);
    expect(out.spec.version).toBe(2);
    expect(out.spec.id).toBe(h.a.spec.id);
    expect(out.spec.title).toBe('A focused continuation');
    if (out.spec.mode === 'checked-bfs') {
      expect(out.spec.input.edges.some((e) => e.id === 'sa')).toBe(true);
      expect(out.executions!.primary.input.edges.some((e) => e.id === 'sa')).toBe(false);
      expect(out.spec.writtenFor).toMatchObject({ disabledEdgeIds: ['sa'], reversed: true });
      expect(out.state).toMatchObject({ disabledEdgeIds: ['sa'], reversed: true });
    }
    if (out.spec.mode === 'checked-bfs')
      expect(explorationExecution(out.spec, out.state)?.input).toEqual(
        explorationExecution(h.a.spec, h.turn.state)?.input,
      );
    expect(out.generation.audit.some((e) => e.event === 'scene-continued')).toBe(true);
    expect(checkExploration(out.spec).spec).toEqual(out.spec);
    expect((await h.service.read(owner, h.a.id, 1)).active).toEqual(h.a);
  },
);
it('rejects invented object references and preserves the original rather than publishing a fast invalid answer', async () => {
  const h = await harness({ badReference: true });
  await expect(h.service.generate(owner, h.turn)).rejects.toBeDefined();
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(h.review).not.toHaveBeenCalled();
  expect((await h.service.read(owner, h.a.id)).active).toEqual(h.a);
});
it('does not bypass substantive review for a compact continuation', async () => {
  const h = await harness({ explanation: true, reviewReject: true });
  await expect(h.service.generate(owner, h.turn)).rejects.toMatchObject({
    code: 'generation_invalid',
  });
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(h.review).toHaveBeenCalledTimes(2);
  expect((await h.service.read(owner, h.a.id)).active).toEqual(h.a);
});
it('does not accept the compact branch when a new source needs full composition', async () => {
  const h = await harness({ explanation: true, newSource: true });
  await expect(h.service.generate(owner, h.turn)).rejects.toBeDefined();
  expect(h.review).not.toHaveBeenCalled();
  expect((await h.service.read(owner, h.a.id)).active).toEqual(h.a);
});
it('cannot sneak source, geometry or graph edits through the compact contract', () => {
  const spec = createExampleExploration();
  if (spec.mode === 'clarify') throw Error('fixture');
  const valid = {
    mode: 'continue',
    title: 'One connection',
    objective: 'Use the existing visual.',
    assumptions: [],
    steps: spec.steps.slice(0, 1),
    followups: [],
  };
  expect(explorationContinuationSchema.safeParse(valid).success).toBe(true);
  for (const extra of [
    { sources: [] },
    { scene: spec.scene },
    { input: {} },
    { controls: [] },
    { mode: 'explanation' },
  ])
    expect(explorationContinuationSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
});

it('preserves changed weights, disabled connections, no goal and the paired comparison in a weighted continuation', async () => {
  const h = await harness({ weighted: true });
  h.turn.state.goal = null;
  const turn = { ...h.turn, state: { ...h.turn.state, edgeWeights: { sg: 2 } } };
  const out = (await h.service.generate(owner, turn)).artifact;
  if (out.spec.mode !== 'checked-dijkstra' || h.a.spec.mode !== 'checked-dijkstra')
    throw Error('Expected weighted source');
  expect(out.spec.input).toEqual(h.a.spec.input);
  expect(out.spec.comparison?.input).toEqual(h.a.spec.comparison?.input);
  expect(out.spec.input.goal).toBe('g');
  expect(out.spec.input.edges.find((e) => e.id === 'sg')?.weight).toBe(10);
  expect(out.spec.input.edges.some((e) => e.id === 'sa')).toBe(true);
  expect(out.executions!.primary.input).toEqual(explorationExecution(h.a.spec, turn.state)?.input);
  expect(out.executions!.comparison?.input).toEqual(
    comparisonExecution(h.a.spec, turn.state)?.input,
  );
  expect(out.spec.writtenFor).toEqual({
    start: turn.state.start,
    goal: null,
    disabledEdgeIds: ['sa'],
    reversed: true,
    edgeWeights: { sg: 2 },
  });
  expect(out.state).toMatchObject(turn.state);
  expect(explorationExecution(out.spec, out.state)).toEqual(out.executions!.primary);
  expect(comparisonExecution(out.spec, out.state)).toEqual(out.executions!.comparison);
  expect(h.review).toHaveBeenCalledTimes(1);
  expect(out.generation.calls).toBe(2);
});

it('keeps full scene generation available for a follow-up that needs new visual context', async () => {
  const h = await harness({ explanation: true, fullScene: true });
  const out = (await h.service.generate(owner, h.turn)).artifact;
  if (out.spec.mode !== 'explanation') throw Error('Expected explanation');
  expect(out.spec.scene.panels.some((p) => p.id === 'additional_context')).toBe(true);
  expect(out.source).toEqual(h.a.source);
  expect(out.generation.audit.some((e) => e.event === 'scene-continued')).toBe(false);
  expect(h.review).toHaveBeenCalledTimes(1);
  expect(checkExploration(out.spec).spec).toEqual(out.spec);
});

it('binds a checked compact answer to one current primary snapshot, while ordinary explanations keep their own step contract', () => {
  const spec = createExampleExploration();
  if (spec.mode === 'clarify') throw Error('fixture');
  const reply = {
    mode: 'continue',
    title: 'Current state',
    objective: 'Explain now.',
    assumptions: [],
    followups: [],
    steps: [
      {
        id: 'now',
        caption: 'This is the current queue.',
        narration: 'Read this current snapshot.',
        highlightIds: ['s'],
        sourceHighlightIds: [],
        execution: 'primary',
        executionStep: 2,
      },
    ],
  };
  const contract = continuationSchemaFor(spec, 2);
  expect(contract.safeParse(reply).success).toBe(true);
  expect(
    contract.safeParse({ ...reply, steps: [{ ...reply.steps[0], executionStep: 3 }] }).success,
  ).toBe(false);
  expect(
    contract.safeParse({ ...reply, steps: [{ ...reply.steps[0], execution: 'comparison' }] })
      .success,
  ).toBe(false);
  expect(contract.safeParse({ ...reply, steps: [...reply.steps, ...reply.steps] }).success).toBe(
    false,
  );
});
