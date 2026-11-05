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
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
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
  vi.useRealTimers();
  vi.restoreAllMocks();
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
function harness(
  review: (request: any) => Promise<MetaResult>,
  invalidAuthors: number[] = [],
  overlap = false,
  options: { authorUsage?: MetaResult['usage']; authorUpperBound?: number } = {},
) {
  let composed = 0;
  const authorResult = (name: string, value: unknown): MetaResult => ({
    ...result(name, value),
    usage: options.authorUsage ?? { input_tokens: 100, output_tokens: 200 },
  });
  const request = vi.fn(async (request: any) => {
    if (!request.instructions.includes('Required spec id='))
      return authorResult('inspect_source', {
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
    if (invalidAuthors.includes(composed)) spec.version = 0;
    if (overlap) spec.scene.panels[1].placement = { ...spec.scene.panels[0].placement };
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
    return authorResult('compose_exploration', { spec });
  });
  const settle = vi.fn(async (_id: string, _cost: number, _certain: boolean) => {});
  const service = createExplorationService({
    request: request as never,
    review,
    reviewEnabled: () => true,
    upperBound: () => options.authorUpperBound ?? 0.03,
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
  expect(artifact.generation.audit.some((item) => item.event === 'review-transport-retried')).toBe(
    false,
  );
  expect(review.mock.calls[0][0].input).not.toEqual(review.mock.calls[1][0].input);
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

it.each(['network', 'http-503'] as const)(
  'retries one %s review on the same candidate and retains unknown billing',
  async (failure) => {
    const review = vi.fn(async (_request: any) => {
      if (review.mock.calls.length === 1)
        throw new MetaClientError(
          failure === 'network' ? 'network' : 'http',
          null,
          true,
          failure === 'http-503' ? 503 : undefined,
        );
      return result('review_exploration', { verdict: 'approve', findings: [] });
    });
    const h = harness(review);
    await h.service.initialize(owner);
    const turn = generate();
    const artifact = (await h.service.generate(owner, turn)).artifact;
    expect(h.request).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(2);
    expect(review.mock.calls[1][0].input).toEqual(review.mock.calls[0][0].input);
    expect(review.mock.calls.map(([request]) => request.maxOutputTokens)).toEqual([1536, 1536]);
    expect(artifact.generation.calls).toBe(4);
    expect(
      artifact.generation.audit.filter((item) => item.event === 'review-transport-retried'),
    ).toHaveLength(1);
    const stored = await explorationStore.read(owner);
    expect(stored?.runs.find((run) => run.requestId === turn.requestId)).toMatchObject({
      status: 'published',
      calls: 4,
      usageCertain: false,
      reservedUsd: 0.35,
    });
    expect(h.settle.mock.calls.at(-1)?.[2]).toBe(false);
  },
);

it.each(['http-401', 'http-429', 'timeout'] as const)(
  'does not retry %s or publish an unreviewed candidate',
  async (failure) => {
    const review = vi.fn(async () => {
      throw new MetaClientError(
        failure === 'timeout' ? 'timeout' : 'http',
        null,
        true,
        failure === 'http-401' ? 401 : failure === 'http-429' ? 429 : undefined,
      );
    });
    const h = harness(review);
    await h.service.initialize(owner);
    const original = (await h.service.example(owner)).artifact;
    await expect(h.service.generate(owner, generate())).rejects.toMatchObject({
      code: 'review_unavailable',
    });
    expect(h.request).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(1);
    const stored = await explorationStore.read(owner);
    expect(stored?.artifacts).toEqual([original]);
    expect(stored?.runs.at(-1)?.failure?.issues).toEqual([
      {
        code: failure === 'timeout' ? 'provider_timeout' : 'provider_http',
        path:
          failure === 'timeout' ? ['provider'] : ['provider', failure === 'http-401' ? 401 : 429],
      },
    ]);
    expect(
      stored?.runs.at(-1)?.audit?.some((item) => item.event === 'review-transport-retried'),
    ).toBe(false);
    expect(h.settle.mock.calls.at(-1)?.[2]).toBe(false);
  },
);

it('does not admit a transient review retry whose unknown billing could exceed the turn reservation', async () => {
  const review = vi.fn(async () => {
    throw new MetaClientError('network', null, true);
  });
  const h = harness(review, [], false, {
    authorUsage: { input_tokens: 96000, output_tokens: 0 },
    authorUpperBound: 0.13,
  });
  await h.service.initialize(owner);
  const original = (await h.service.example(owner)).artifact;
  await expect(h.service.generate(owner, generate())).rejects.toMatchObject({ code: 'capacity' });
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(review).toHaveBeenCalledTimes(1);
  const stored = await explorationStore.read(owner);
  expect(stored?.artifacts).toEqual([original]);
  expect(stored?.runs.at(-1)).toMatchObject({
    calls: 3,
    costUsd: 0.24,
    usageCertain: false,
    reservedUsd: 0.35,
  });
  expect(
    stored?.runs.at(-1)?.audit?.some((item) => item.event === 'review-transport-retried'),
  ).toBe(false);
  expect(h.settle.mock.calls.at(-1)?.[2]).toBe(false);
});

it.each(['incomplete', 'malformed'] as const)(
  'shares the one same-candidate retry between transport and %s recovery',
  async (failure) => {
    const review = vi.fn(async () => {
      if (review.mock.calls.length === 1) throw new MetaClientError('network', null, true);
      return failure === 'incomplete'
        ? {
            status: 'incomplete' as const,
            tools: [],
            usage: { input_tokens: 100, output_tokens: 1536 },
          }
        : result('review_exploration', { verdict: 'revise', findings: '["Wrong endpoint"]' });
    });
    const h = harness(review);
    await h.service.initialize(owner);
    const original = (await h.service.example(owner)).artifact;
    await expect(h.service.generate(owner, generate())).rejects.toMatchObject({
      code: 'review_unavailable',
    });
    expect(review).toHaveBeenCalledTimes(2);
    expect(h.request).toHaveBeenCalledTimes(2);
    const stored = await explorationStore.read(owner);
    expect(stored?.artifacts).toEqual([original]);
    expect(
      stored?.runs.at(-1)?.audit?.some((item) => item.event === 'review-incomplete-retried'),
    ).toBe(false);
    expect(stored?.runs.at(-1)?.audit?.some((item) => item.event === 'review-format-retried')).toBe(
      false,
    );
    expect(h.settle.mock.calls.at(-1)?.[2]).toBe(false);
  },
);

it.each([
  { elapsed: 0, allowance: 40000 },
  { elapsed: 65000, allowance: 25000 },
])(
  'allows $allowance ms for review after $elapsed ms of the 90-second turn',
  async ({ elapsed, allowance }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const started = Date.now();
    const review = vi.fn(async (_request: any) =>
      result('review_exploration', { verdict: 'approve', findings: [] }),
    );
    const h = harness(review);
    const author = h.request.getMockImplementation()!;
    h.request.mockImplementation(async (request) => {
      const response = await author(request);
      if (request.instructions.includes('Required spec id=')) vi.setSystemTime(started + elapsed);
      return response;
    });
    await h.service.initialize(owner);
    const turn = generate();
    await h.service.generate(owner, turn);
    expect(review).toHaveBeenCalledTimes(1);
    expect(review.mock.calls[0][0].deadlineMs).toBe(allowance);
    const stored = await explorationStore.read(owner);
    expect(Date.parse(stored!.runs.find((run) => run.requestId === turn.requestId)!.deadline)).toBe(
      started + 90000,
    );
  },
);

it('rejects a late approval after the whole-turn deadline without publishing or extending it', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const started = Date.now();
  const review = vi.fn(async (_request: any) => {
    vi.setSystemTime(started + 90001);
    return result('review_exploration', { verdict: 'approve', findings: [] });
  });
  const h = harness(review);
  await h.service.initialize(owner);
  const original = (await h.service.example(owner)).artifact;
  await expect(h.service.generate(owner, generate())).rejects.toMatchObject({ code: 'timeout' });
  expect(review.mock.calls[0][0].deadlineMs).toBe(40000);
  expect(review).toHaveBeenCalledTimes(1);
  expect((await explorationStore.read(owner))?.artifacts).toEqual([original]);
});

it('preserves an abort during the longer review and never retries or publishes after cancellation', async () => {
  const controller = new AbortController();
  const review = vi.fn(async (request: any) => {
    expect(request.signal).toBe(controller.signal);
    expect(request.deadlineMs).toBe(40000);
    controller.abort();
    throw new MetaClientError('timeout', null, true);
  });
  const h = harness(review);
  await h.service.initialize(owner);
  const original = (await h.service.example(owner)).artifact;
  await expect(h.service.generate(owner, generate(), controller.signal)).rejects.toMatchObject({
    code: 'cancelled',
  });
  expect(review).toHaveBeenCalledTimes(1);
  const stored = await explorationStore.read(owner);
  expect(stored?.artifacts).toEqual([original]);
  expect(stored?.runs.at(-1)).toMatchObject({
    status: 'cancelled',
    usageCertain: false,
    reservedUsd: 0.35,
  });
  expect(h.settle.mock.calls.at(-1)?.[2]).toBe(false);
});

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
  expect(review).toHaveBeenCalledTimes(1);
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
      panels: scene.panels
        .filter(
          (p: { kind: string }) => !['steps', 'graph', 'frontier', 'state-table'].includes(p.kind),
        )
        .slice(0, 3),
    }).success,
  ).toBe(true);
  expect(explanationAuthorSceneSchema.safeParse({ ...scene, layout: 'stack' }).success).toBe(false);
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

it('retries only an incomplete critic once on the unchanged candidate with bounded extra headroom', async () => {
  const review = vi.fn(async (_request: any) =>
    review.mock.calls.length === 1
      ? {
          status: 'incomplete' as const,
          tools: [],
          usage: { input_tokens: 100, output_tokens: 1536 },
        }
      : result('review_exploration', { verdict: 'approve', findings: [] }),
  );
  const h = harness(review);
  await h.service.initialize(owner);
  const a = (await h.service.generate(owner, generate())).artifact;
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(review).toHaveBeenCalledTimes(2);
  expect(review.mock.calls[0][0].input).toEqual(review.mock.calls[1][0].input);
  expect(review.mock.calls.map((c) => c[0].maxOutputTokens)).toEqual([1536, 2048]);
  expect(a.generation.calls).toBe(4);
  expect(a.generation.audit.some((e) => e.event === 'review-incomplete-retried')).toBe(true);
});

it('does not publish or retry indefinitely when the critic stays incomplete', async () => {
  const review = vi.fn(async () => ({
    status: 'incomplete' as const,
    tools: [],
    usage: { input_tokens: 100, output_tokens: 1536 },
  }));
  const h = harness(review);
  await h.service.initialize(owner);
  const original = (await h.service.example(owner)).artifact;
  await expect(h.service.generate(owner, generate())).rejects.toMatchObject({
    code: 'review_unavailable',
  });
  expect(review).toHaveBeenCalledTimes(2);
  expect(h.request).toHaveBeenCalledTimes(2);
  const s = await explorationStore.read(owner);
  expect(s?.artifacts).toEqual([original]);
  expect(s?.runs.at(-1)?.failure?.issues).toEqual([
    { code: 'review_incomplete', path: ['review'] },
  ]);
});

it('repairs an unusable review format once without losing its criticism or changing the candidate', async () => {
  const review = vi.fn(async (_request: any) =>
    review.mock.calls.length === 1
      ? {
          status: 'completed' as const,
          tools: [],
          structured: {
            verdict: 'revise',
            findings: '["The endpoint must be w2=2.25, not the minimum."]',
          },
          usage: { input_tokens: 100, output_tokens: 100 },
        }
      : result(
          'review_exploration',
          review.mock.calls.length === 2
            ? {
                verdict: 'revise',
                findings: ['The endpoint must be w2=2.25, not the minimum.'],
              }
            : { verdict: 'approve', findings: [] },
        ),
  );
  const h = harness(review);
  await h.service.initialize(owner);
  const a = (await h.service.generate(owner, generate())).artifact;
  expect(review).toHaveBeenCalledTimes(3);
  expect(h.request).toHaveBeenCalledTimes(3);
  expect(a.generation.calls).toBe(6);
  expect(review.mock.calls[1][0].input[0]).toEqual(review.mock.calls[0][0].input[0]);
  expect(JSON.stringify(review.mock.calls[1][0].input.at(-1))).toContain('endpoint');
  expect(a.generation.audit.some((e) => e.event === 'review-format-retried')).toBe(true);
  expect(a.generation.audit.some((e) => e.event === 'review-rejected')).toBe(true);
});

it.each([{ invalidAuthors: [1] }, { invalidAuthors: [2] }])(
  'separates one contract repair from one factual repair within six total calls: $invalidAuthors',
  async ({ invalidAuthors }) => {
    const review = vi.fn(async () =>
      result(
        'review_exploration',
        review.mock.calls.length === 1
          ? {
              verdict: 'revise',
              findings: ['Keep the numerical arrow endpoint consistent with the checked update.'],
            }
          : { verdict: 'approve', findings: [] },
      ),
    );
    const h = harness(review, invalidAuthors);
    await h.service.initialize(owner);
    const out = await h.service.generate(owner, generate());
    expect(out.artifact.generation.calls).toBe(6);
    expect(h.request).toHaveBeenCalledTimes(4);
    expect(review).toHaveBeenCalledTimes(2);
    expect(
      out.artifact.generation.audit.filter((a) => a.event === 'repair-requested'),
    ).toHaveLength(1);
    expect(out.artifact.generation.audit.filter((a) => a.event === 'review-rejected')).toHaveLength(
      1,
    );
    expect(checkExploration(out.artifact.spec).spec).toEqual(out.artifact.spec);
  },
);
it('never buys repeated factual repairs after a contract repair', async () => {
  const review = vi.fn(async () =>
    result('review_exploration', {
      verdict: 'revise',
      findings: ['Source qualifier is still missing.'],
    }),
  );
  const h = harness(review, [1]);
  await h.service.initialize(owner);
  const original = (await h.service.example(owner)).artifact;
  await expect(h.service.generate(owner, generate())).rejects.toMatchObject({
    code: 'generation_invalid',
  });
  expect(h.request).toHaveBeenCalledTimes(4);
  expect(review).toHaveBeenCalledTimes(2);
  expect((await h.service.read(owner, original.id)).active).toEqual(original);
});
it('never buys repeated application repairs before review', async () => {
  const review = vi.fn(async () =>
    result('review_exploration', { verdict: 'approve', findings: [] }),
  );
  const h = harness(review, [1, 2]);
  await h.service.initialize(owner);
  await expect(h.service.generate(owner, generate())).rejects.toBeDefined();
  expect(h.request).toHaveBeenCalledTimes(3);
  expect(review).not.toHaveBeenCalled();
});

it('publishes a reflowed explanation after ordinary checks and review without buying a layout repair', async () => {
  const review = vi.fn(async () =>
    result('review_exploration', { verdict: 'approve', findings: [] }),
  );
  const h = harness(review, [], true);
  await h.service.initialize(owner);
  const artifact = (await h.service.generate(owner, generate())).artifact;
  expect(artifact.generation.calls).toBe(3);
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(review).toHaveBeenCalledTimes(1);
  expect(artifact.generation.audit.map((a) => a.event)).toEqual(
    expect.arrayContaining(['scene-layout-adjusted', 'review-approved', 'scene-validated']),
  );
  expect(artifact.generation.audit.some((a) => a.event === 'repair-requested')).toBe(false);
  expect(artifact.spec.mode).toBe('explanation');
  if (artifact.spec.mode !== 'explanation') throw new Error('Expected explanation');
  expect(artifact.spec.scene.panels.map(({ placement, ...content }) => content)).toEqual(
    fixtures.gradient.scene.panels.map(({ placement, ...content }: any) => content),
  );
  expect(checkExploration(artifact.spec).spec).toEqual(artifact.spec);
  expect((await h.service.read(owner, artifact.id)).active).toEqual(artifact);
});
