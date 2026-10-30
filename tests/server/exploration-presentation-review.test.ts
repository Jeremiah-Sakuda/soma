import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createExplorationService,
  explanationAuthorSceneSchema,
  needsExplorationReview,
} from '../../src/lib/server/exploration';
import {
  closeExplorationStore,
  explorationStore,
} from '../../src/lib/server/exploration-store';
import { MetaClientError, type MetaResult } from '../../src/lib/server/meta-client';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

// Retain the actual pre-fix model error as a regression input, never a correct lesson.
const fixtures = JSON.parse(readFileSync('tests/fixtures/visual-polish-scenes.json', 'utf8'));
const owner: ExplorationPrincipal = {
  kind: 'guest',
  id: 'a'.repeat(64),
  workspaceId: 'a'.repeat(64),
  generation: 'a'.repeat(64),
  key: `guest-${'a'.repeat(64)}`,
};
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-visual-review-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'explore.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const result = (name: string, value: unknown): MetaResult => ({
  status: 'completed',
  tools: [
    {
      type: 'function_call',
      name,
      arguments: JSON.stringify(value),
      parsedArguments: value as Record<string, unknown>,
      call_id: randomUUID(),
    },
  ],
  usage: { input_tokens: 100, output_tokens: 200 },
});
function harness(review: (request: any) => Promise<MetaResult>) {
  let composed = 0;
  const request = vi.fn(async (request: any) => {
    if (!request.instructions.includes('Required spec id='))
      return result('inspect_source', {
        summary:
          'L(w)=(w-3)^2; gradient 2(w-3); start w=0; step size 0.25. Two updates yield 1.5 and 2.25.',
        uncertainty: [],
        graph: null,
      });
    composed++;
    const context = JSON.parse(request.input[0].content),
      binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(request.instructions)!;
    const spec = structuredClone(fixtures.gradient);
    spec.id = binding[1];
    spec.version = Number(binding[2]);
    spec.sources = [
      {
        observationId: context.source.observationId,
        version: context.source.version,
        region: null,
      },
    ];
    if (composed > 1)
      for (const panel of spec.scene.panels)
        if (panel.kind === 'diagram')
          for (const object of panel.objects)
            if (object.label?.includes('minimum')) object.label = 'w2 = 2.25; L = 0.5625';
    return result('compose_exploration', { spec });
  });
  const settle = vi.fn(async (_id: string, _cost: number, _certain: boolean) => {});
  const service = createExplorationService({
    request: request as never,
    review,
    reviewEnabled: () => true,
    upperBound: () => 0.03,
    reserve: async () => randomUUID(),
    settle,
    enabled: () => true,
    revalidate: async () => {},
  });
  return { service, request, settle };
}
const generate = () => ({
  action: 'generate',
  requestId: randomUUID(),
  question: 'Visualize both updates',
  source: {
    kind: 'example',
    label: 'Original synthetic gradient',
    capturedAt: new Date().toISOString(),
  },
});

it('reviews explanatory arrows, carries defects into one repair, and requires re-review before publication', async () => {
  const review = vi.fn(async (_request: any) =>
    result(
      'review_exploration',
      review.mock.calls.length === 1
        ? {
            verdict: 'revise',
            findings: ['The +0.75 arrow must end at w2=2.25, not at the minimum w=3.'],
          }
        : { verdict: 'approve', findings: [] },
    ),
  );
  const { service, request } = harness(review);
  await service.initialize(owner);
  const artifact = (await service.generate(owner, generate())).artifact;
  expect(artifact.generation.calls).toBe(5);
  expect(review).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(request.mock.calls.at(-1))).toContain('must end at w2=2.25');
  expect(JSON.stringify(artifact.spec)).toContain('w2 = 2.25; L = 0.5625');
  expect(artifact.generation.audit.map((item) => item.event)).toEqual(
    expect.arrayContaining(['review-rejected', 'review-approved', 'scene-validated']),
  );
  expect((await explorationStore.read(owner))!.artifacts).toHaveLength(1);
});

it.each(['transport', 'malformed'] as const)(
  'retains the original and does not buy another author call after %s review failure',
  async (failure) => {
    const review = vi.fn(async () => {
      if (failure === 'transport') throw new MetaClientError('timeout', null, true);
      return result('wrong_tool', {});
    });
    const { service, request, settle } = harness(review);
    await service.initialize(owner);
    const original = (await service.example(owner)).artifact;
    await expect(service.generate(owner, generate())).rejects.toMatchObject({
      code: 'review_unavailable',
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(1);
    expect((await service.read(owner, original.id)).active).toEqual(original);
    expect((await explorationStore.read(owner))!.artifacts).toHaveLength(1);
    if (failure === 'transport') expect(settle.mock.calls.at(-1)?.[2]).toBe(false);
  },
);

it('preserves cancellation during a late review instead of mislabeling it as an outage', async () => {
  const turn = generate();
  const review = vi.fn(async () => {
    await service.cancel(owner, turn.requestId);
    return result('review_exploration', { verdict: 'approve', findings: [] });
  });
  const { service, request } = harness(review);
  await service.initialize(owner);
  const original = (await service.example(owner)).artifact;
  await expect(service.generate(owner, turn)).rejects.toMatchObject({ code: 'cancelled' });
  expect(request).toHaveBeenCalledTimes(2);
  expect((await service.read(owner, original.id)).active).toEqual(original);
  expect(
    (await explorationStore.read(owner))!.runs.find((run) => run.requestId === turn.requestId)
      ?.status,
  ).toBe('cancelled');
});

it('binds new explanatory authoring to the valid ordinary grid without relaxing stored scene validation', () => {
  const scene = fixtures.gradient.scene;
  expect(
    explanationAuthorSceneSchema.safeParse({
      ...scene,
      layout: 'diagram-sidebar',
    }).success,
  ).toBe(true);
  expect(explanationAuthorSceneSchema.safeParse({ ...scene, layout: 'stack' }).success).toBe(
    false,
  );
  expect(() =>
    checkExploration({
      ...fixtures.gradient,
      scene: { ...scene, layout: 'stack' },
    }),
  ).toThrow();
  expect(needsExplorationReview(checkExploration(fixtures.gradient).spec)).toBe(true);
  expect(needsExplorationReview(createExampleExploration())).toBe(false);
  expect(needsExplorationReview(createExampleExploration(), true)).toBe(true);
});
