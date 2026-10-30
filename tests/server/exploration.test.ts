import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExampleExploration } from '../../src/lib/domain/exploration';
import {
  createExplorationService,
  validateExplorationViewState,
} from '../../src/lib/server/exploration';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import { MetaClientError, type MetaResult } from '../../src/lib/server/meta-client';
import { visionRequestUpperBoundUsd } from '../../src/lib/server/meta-vision';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

const principal = (id = 'a'): ExplorationPrincipal => ({
  kind: 'guest',
  id: id.repeat(64),
  workspaceId: id.repeat(64),
  generation: id.repeat(64),
  key: `guest-${id.repeat(64)}`,
});
const exampleInput = () => {
  const spec = createExampleExploration();
  if (spec.mode !== 'checked-bfs') throw new Error('fixture');
  return spec.input;
};
function result(name: string, value: unknown, index: number): MetaResult {
  return {
    status: 'completed',
    tools: [
      {
        type: 'function_call',
        name,
        arguments: JSON.stringify(value),
        call_id: `call-${index}`,
        parsedArguments: value as Record<string, unknown>,
      },
    ],
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}
function script(
  options: {
    invalidFirst?: boolean;
    invalidAlways?: boolean;
    foreignSource?: boolean;
    comparison?: boolean;
    clarify?: boolean;
  } = {},
) {
  let index = 0;
  return vi.fn(async (request: { instructions: string; input: readonly unknown[] }) => {
    index++;
    if (!request.instructions.includes('Required spec id='))
      return result(
        'inspect_source',
        {
          summary: 'A directed unweighted graph, with a disconnected node and cycle.',
          uncertainty: [],
          graph: options.clarify ? null : exampleInput(),
        },
        index,
      );
    const context = JSON.parse((request.input[0] as { content: string }).content);
    const source = {
      observationId: context.source.observationId,
      version: context.source.version,
      region: null,
    };
    const id = /Required spec id=([^ ]+) and version=(\d+)/.exec(request.instructions)!;
    if (options.clarify)
      return result(
        'compose_exploration',
        {
          spec: {
            schemaVersion: 'exploration-v1',
            id: id[1],
            version: Number(id[2]),
            title: 'Please clarify the arrow',
            objective: 'Avoid inventing an edge.',
            sources: [source],
            assumptions: [],
            uncertainty: ['The arrow direction is unreadable.'],
            unsupportedClaims: [],
            mode: 'clarify',
            question: 'Does this edge point toward S?',
          },
        },
        index,
      );
    const spec = createExampleExploration(
      source,
      options.comparison ? 'comparison' : 'diagram-sidebar',
    );
    spec.id = id[1];
    spec.version = Number(id[2]);
    if (spec.mode === 'checked-bfs' && context.graph) {
      spec.input = context.graph;
      const graphIds = new Set([
        ...spec.input.nodes.map((n: any) => n.id),
        ...spec.input.edges.map((e: any) => e.id),
      ]);
      spec.steps = spec.steps.map((item) => ({
        ...item,
        executionStep:
          item.executionStep === null
            ? null
            : Math.min(item.executionStep, context.checkedExecution.steps.length - 1),
        highlightIds: item.highlightIds.filter((id) => graphIds.has(id)),
      }));
    }
    if (options.foreignSource) spec.sources[0].observationId = 'foreign-source';
    if (options.invalidAlways || (options.invalidFirst && index === 2))
      (spec as unknown as { executions: unknown }).executions = { forged: true };
    return result('compose_exploration', { spec }, index);
  });
}
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-explore-test-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'explore.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});
function harness(request = script()) {
  const settle = vi.fn(async () => {}),
    reserve = vi.fn(async () => randomUUID());
  const service = createExplorationService({
    request: request as never,
    upperBound: () => 0.03,
    reserve,
    settle,
    enabled: () => true,
    validateImage: vi.fn() as never,
    revalidate: async () => {},
  });
  return { service, request, settle, reserve };
}
const generate = (extra: Record<string, unknown> = {}) => ({
  action: 'generate',
  requestId: randomUUID(),
  question: 'Why does A come before B?',
  source: { kind: 'example', label: 'Original example', capturedAt: new Date().toISOString() },
  ...extra,
});

describe('bounded exploration provider and persistence pipeline', () => {
  it('uses an actual computed BFS trace between interpretation and generated scene, preserving immutable versions and source facts', async () => {
    const { service, request, settle } = harness();
    const owner = principal();
    await service.initialize(owner);
    const first = (await service.generate(owner, generate())).artifact;
    expect(first.generation.calls).toBe(2);
    expect(first.validation.assurance).toBe('checked-bfs');
    expect(first.executions?.primary.path).toEqual(['s', 'a', 'g']);
    const context = JSON.parse((request.mock.calls[1][0].input[0] as { content: string }).content);
    expect(context.checkedExecution.path).toEqual(['s', 'a', 'g']);
    expect(context.graph.directed).toBe(true);
    expect(settle).toHaveBeenCalledWith(expect.any(String), 0.00195, true);
    const followScript = script({ comparison: true });
    const follow = createExplorationService({
      request: followScript as never,
      upperBound: () => 0.03,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    const second = (
      await follow.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'Compare reverse neighbor order',
        intent: 'compare',
        artifactId: first.id,
        baseVersion: 1,
        selectedObjectId: 'a',
      })
    ).artifact;
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(second.spec.mode === 'checked-bfs' && second.spec.scene.layout).toBe('comparison');
    expect(second.source).toEqual(first.source);
    const state = await explorationStore.read(owner);
    expect(state!.artifacts[0]).toEqual(first);
    expect(state!.artifacts).toHaveLength(2);
  });
  it('keeps screenshot bytes transient and sends them only to the interpretation call', async () => {
    const { service, request } = harness();
    await service.initialize(principal());
    const image = 'data:image/png;base64,SYNTHETIC_IMAGE_CANARY';
    await service.generate(
      principal(),
      generate({
        source: {
          kind: 'screenshot',
          dataUrl: image,
          label: 'Selected synthetic image',
          capturedAt: new Date().toISOString(),
        },
      }),
    );
    expect(JSON.stringify(request.mock.calls[0])).toContain(image);
    expect(JSON.stringify(request.mock.calls[1])).not.toContain(image);
    expect(JSON.stringify(await explorationStore.read(principal()))).not.toContain(image);
    expect(readFileSync(join(directory, 'explore.sqlite')).includes(Buffer.from(image))).toBe(
      false,
    );
  });
  it('repairs one rejected scene with application feedback and preserves failed attempts in audit facts', async () => {
    const { service, request } = harness(script({ invalidFirst: true }));
    await service.initialize(principal());
    const artifact = (await service.generate(principal(), generate())).artifact;
    expect(request).toHaveBeenCalledTimes(3);
    expect(artifact.generation.audit.map((item) => item.event)).toContain('repair-requested');
    expect(JSON.stringify(request.mock.calls[2][0].input)).toContain('accepted');
    expect(artifact).not.toHaveProperty('executions.forged');
  });
  it('rejects a twice-invalid generated scene and retains the prior valid artifact', async () => {
    const { service } = harness(script({ invalidAlways: true }));
    await service.initialize(principal());
    const original = (await service.example(principal())).artifact;
    await expect(service.generate(principal(), generate())).rejects.toMatchObject({
      code: 'generation_invalid',
    });
    const session = await explorationStore.read(principal());
    expect(session!.artifacts).toEqual([original]);
    expect(session!.runs.at(-1)).toMatchObject({
      status: 'failed',
      calls: 3,
      code: 'generation_invalid',
    });
  });
  it('rejects foreign source references even when the graph and scene validate', async () => {
    const { service } = harness(script({ foreignSource: true }));
    await service.initialize(principal());
    await expect(service.generate(principal(), generate())).rejects.toMatchObject({
      code: 'generation_invalid',
    });
    expect((await explorationStore.read(principal()))!.artifacts).toEqual([]);
  });
  it('publishes model-requested clarification without inventing a checked graph', async () => {
    const { service } = harness(script({ clarify: true }));
    await service.initialize(principal());
    const artifact = (await service.generate(principal(), generate())).artifact;
    expect(artifact.validation.assurance).toBe('needs-clarification');
    expect(artifact.executions).toBeNull();
    expect(artifact.spec.mode).toBe('clarify');
  });
  it('accepts only the observed exact no-graph string sentinel without granting checked assurance', async () => {
    const base = script({ clarify: true });
    let calls = 0;
    const request = vi.fn(async (args) => {
      const response = await base(args);
      if (++calls === 1) {
        response.tools[0].parsedArguments.graph = 'null';
        response.tools[0].arguments = JSON.stringify(response.tools[0].parsedArguments);
      }
      return response;
    });
    const { service } = harness(request as never);
    await service.initialize(principal());
    const artifact = (await service.generate(principal(), generate())).artifact;
    expect(artifact.spec.mode).toBe('clarify');
    expect(artifact.executions).toBeNull();
    expect(artifact.validation.assurance).toBe('needs-clarification');
    expect(artifact.generation.audit[0].detail).toContain('normalized to JSON null');
  });
  it.each(['arbitrary graph string', ' null ', 'NULL', '{"nodes":[]}'])(
    'rejects any other graph string rather than coercing graph semantics: %s',
    async (graph) => {
      const request = vi.fn(async () =>
        result(
          'inspect_source',
          { summary: 'Untrusted graph transport.', uncertainty: [], graph },
          1,
        ),
      );
      const { service } = harness(request as never);
      await service.initialize(principal());
      await expect(service.generate(principal(), generate())).rejects.toMatchObject({
        code: 'generation_invalid',
      });
      expect(request).toHaveBeenCalledTimes(1);
      expect((await explorationStore.read(principal()))!.artifacts).toEqual([]);
    },
  );
  it('rejects foreign artifacts, stale versions and unknown selected objects before paying for a call', async () => {
    const { service, reserve } = harness();
    await service.initialize(principal());
    await service.initialize(principal('b'));
    const artifact = (await service.example(principal())).artifact;
    await expect(
      service.generate(principal('b'), generate({ artifactId: artifact.id, baseVersion: 1 })),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      service.generate(principal(), generate({ artifactId: artifact.id, baseVersion: 3 })),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    await expect(
      service.generate(
        principal(),
        generate({ artifactId: artifact.id, baseVersion: 1, selectedObjectId: 'unknown' }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(reserve).not.toHaveBeenCalled();
  });
  it('cancels a pending provider response without late publication while retaining actual late usage facts', async () => {
    let finish!: (value: MetaResult) => void;
    const pending = vi.fn(
      () =>
        new Promise<MetaResult>((resolve) => {
          finish = resolve;
        }),
    );
    const { service, settle } = harness(pending as never);
    await service.initialize(principal());
    const original = (await service.example(principal())).artifact;
    const body = generate();
    const work = service.generate(principal(), body);
    await vi.waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
    await service.cancel(principal(), body.requestId);
    finish(
      result(
        'inspect_source',
        { summary: 'Synthetic graph', uncertainty: [], graph: exampleInput() },
        1,
      ),
    );
    await expect(work).rejects.toMatchObject({ code: 'cancelled' });
    const stored = (await explorationStore.read(principal()))!;
    expect(stored.artifacts).toEqual([original]);
    expect(stored.runs[0]).toMatchObject({
      status: 'cancelled',
      code: 'cancelled',
      calls: 1,
      costUsd: 0.000975,
      usageCertain: true,
      reservedUsd: 0.35,
      usage: { input_tokens: 100, output_tokens: 200 },
    });
    expect(settle).toHaveBeenCalledWith(expect.any(String), 0.000975, true);
  });
  it('persists cancellation before request registration and fences delayed/replayed generation without paying', async () => {
    const { service, request, reserve } = harness();
    await service.initialize(principal());
    const body = generate();
    await service.cancel(principal(), body.requestId);
    closeExplorationStore();
    await expect(service.generate(principal(), body)).rejects.toMatchObject({ code: 'cancelled' });
    expect(request).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    const stored = await explorationStore.read(principal());
    expect(stored!.runs).toHaveLength(1);
    expect(stored!.runs[0]).toMatchObject({
      requestId: body.requestId,
      status: 'cancelled',
      calls: 0,
    });
    await service.cancel(principal(), body.requestId);
    expect((await explorationStore.read(principal()))!.runs).toHaveLength(1);
  });
  it('retains reservation on unknown sent provider usage and marks zero known cost as uncertain', async () => {
    const request = vi.fn(async () => {
      throw new MetaClientError('network', null, true);
    });
    const { service, settle } = harness(request as never);
    await service.initialize(principal());
    await expect(service.generate(principal(), generate())).rejects.toMatchObject({
      code: 'generation_invalid',
    });
    expect(settle).toHaveBeenCalledWith(expect.any(String), 0, false);
    const stored = await explorationStore.read(principal());
    expect(stored!.runs[0]).toMatchObject({
      status: 'failed',
      calls: 1,
      costUsd: 0,
      usageCertain: false,
      reservedUsd: 0.35,
    });
    expect(JSON.stringify(stored)).not.toContain('network');
  });
  it('checks conservative remaining spend before any provider request', async () => {
    const { service, request } = harness();
    const limited = createExplorationService({
      request: request as never,
      upperBound: () => 0.36,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await service.initialize(principal());
    await expect(limited.generate(principal(), generate())).rejects.toMatchObject({
      code: 'capacity',
    });
    expect(request).not.toHaveBeenCalled();
  });
  it('validates every scripted request through the actual multimodal encoder and provider-compatible schema', async () => {
    const request = script({ invalidFirst: true }),
      upperBound = vi.fn(visionRequestUpperBoundUsd);
    const service = createExplorationService({
      request: request as never,
      upperBound,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await service.initialize(principal());
    expect((await service.generate(principal(), generate())).artifact.generation.calls).toBe(3);
    expect(upperBound).toHaveBeenCalledTimes(3);
    expect(
      upperBound.mock.results.every(
        (value) => value.type === 'return' && value.value > 0 && value.value < 0.35,
      ),
    ).toBe(true);
    for (const invocation of request.mock.calls) {
      expect(JSON.stringify((invocation[0] as { tools?: unknown }).tools)).not.toContain('"oneOf"');
    }
    expect(JSON.stringify((request.mock.calls[1][0] as { tools?: unknown }).tools)).toContain(
      '"anyOf"',
    );
  });
  it('sends current unsaved controls and their checked trace into the follow-up decision', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const artifact = (await service.example(principal())).artifact;
    const request = script();
    const follow = createExplorationService({
      request: request as never,
      upperBound: () => 0.03,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await follow.generate(principal(), {
      action: 'generate',
      requestId: randomUUID(),
      question: 'Why can I not reach X?',
      artifactId: artifact.id,
      baseVersion: 1,
      state: {
        ...artifact.state,
        start: 'b',
        goal: 'x',
        disabledEdgeIds: ['sa'],
        reversed: true,
        step: 1,
      },
      selectedObjectId: 'x',
    });
    const context = JSON.parse((request.mock.calls[0][0].input[0] as { content: string }).content);
    expect(context.previous.state.start).toBe('b');
    expect(context.previous.checkedExecution.input.start).toBe('b');
    expect(
      context.previous.checkedExecution.input.edges.some(
        (edge: { id: string }) => edge.id === 'sa',
      ),
    ).toBe(false);
    expect(context.previous.checkedExecution.status).toBe('unreachable');
    expect(context.selectedObjectId).toBe('x');
  });
  it('saves and resumes changed controls exactly without treating exploration as mastery', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const artifact = (await service.example(principal())).artifact;
    const state = {
      step: 1,
      explanationStep: 2,
      start: 'b',
      goal: 'x',
      disabledEdgeIds: ['sa'],
      reversed: true,
      selectedObjectId: 'b',
    };
    await service.save(principal(), artifact.id, 1, state);
    closeExplorationStore();
    const resumed = await service.read(principal(), artifact.id);
    expect(resumed.active!.state).toEqual(state);
    expect(resumed.active!.saved).toBe(true);
    expect(resumed.active!.spec).toEqual(artifact.spec);
    expect(JSON.stringify(resumed)).not.toContain('mastery');
    await expect(service.save(principal('b'), artifact.id, 1, state)).rejects.toMatchObject({
      code: 'session_expired',
    });
  });
  it('resumes a saved older immutable version through explicit bounded history after a newer version publishes', async () => {
    const { service } = harness(script({ comparison: true }));
    await service.initialize(principal());
    const first = (await service.example(principal())).artifact;
    const savedState = { ...first.state, step: 1, selectedObjectId: 'a' };
    await service.save(principal(), first.id, 1, savedState);
    const second = (
      await service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: first.id,
        baseVersion: 1,
        intent: 'compare',
        question: 'Compare reversed order',
      })
    ).artifact;
    expect(second.version).toBe(2);
    closeExplorationStore();
    const old = await service.read(principal(), first.id, 1);
    expect(old.active!.version).toBe(1);
    expect(old.active!.spec).toEqual(first.spec);
    expect(old.active!.state).toEqual(savedState);
    expect(old.versions.map((item) => [item.version, item.saved])).toEqual([
      [2, false],
      [1, true],
    ]);
    expect((await service.read(principal(), first.id)).active!.version).toBe(2);
    await expect(service.read(principal(), first.id, 3)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
  it('preserves a valid comparison step beyond the shorter modified primary trace', () => {
    const spec = createExampleExploration(undefined, 'comparison');
    if (spec.mode !== 'checked-bfs') throw new Error();
    const state = {
      step: 4,
      explanationStep: 0,
      start: 'g',
      goal: 'g',
      disabledEdgeIds: [],
      reversed: false,
      selectedObjectId: null,
    };
    expect(validateExplorationViewState(spec, state)).toEqual(state);
    expect(() => validateExplorationViewState(spec, { ...state, step: 12 })).toThrow();
  });
  it('rejects invalid interaction state and foreign IDs', () => {
    const spec = createExampleExploration();
    expect(() => validateExplorationViewState(spec, { step: 12, start: 's', goal: 'g' })).toThrow();
    expect(() => validateExplorationViewState(spec, { start: 'foreign', goal: 'g' })).toThrow();
    expect(() =>
      validateExplorationViewState(spec, { start: 's', goal: 'g', disabledEdgeIds: ['foreign'] }),
    ).toThrow();
    expect(() =>
      validateExplorationViewState(spec, { start: 's', goal: 'g', selectedObjectId: 'foreign' }),
    ).toThrow();
  });
  it('rejects changed edge meaning under a reused stable ID and returns bounded actionable repair facts', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const original = (await service.example(principal())).artifact;
    let index = 0;
    const request = vi.fn(async (args) => {
      index++;
      const graph = exampleInput();
      graph.edges.find((edge) => edge.id === 'sa')!.to = 'c';
      if (index === 1)
        return result(
          'inspect_source',
          { summary: 'The source proposes a changed edge.', uncertainty: [], graph },
          index,
        );
      const context = JSON.parse(args.input[0].content),
        match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      const spec = createExampleExploration({
        observationId: context.source.observationId,
        version: context.source.version,
        region: null,
      });
      if (spec.mode !== 'checked-bfs') throw new Error();
      spec.id = match[1];
      spec.version = Number(match[2]);
      spec.input = graph;
      return result('compose_exploration', { spec }, index);
    });
    const follow = createExplorationService({
      request: request as never,
      upperBound: () => 0.03,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await expect(
      follow.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        question: 'Compare this change',
        intent: 'compare',
        artifactId: original.id,
        baseVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'generation_invalid' });
    const feedback = request.mock.calls[2][0].input.findLast(
      (item: { type?: string }) => item.type === 'function_call_output',
    );
    expect(JSON.parse(feedback.output).issues).toEqual([{ code: 'stable_object', path: ['spec'] }]);
    expect((await explorationStore.read(principal()))!.artifacts).toEqual([original]);
  });
  it('returns finite layout validation facts without reflecting unknown model keys or values', async () => {
    let index = 0;
    const request = vi.fn(async (args) => {
      index++;
      if (index === 1)
        return result(
          'inspect_source',
          { summary: 'Original graph.', uncertainty: [], graph: exampleInput() },
          index,
        );
      const context = JSON.parse(args.input[0].content),
        match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      const spec = createExampleExploration({
        observationId: context.source.observationId,
        version: 1,
        region: null,
      });
      if (spec.mode !== 'checked-bfs') throw new Error();
      spec.id = match[1];
      spec.version = Number(match[2]);
      if (index === 2) spec.scene.panels[1].placement = { ...spec.scene.panels[0].placement };
      return result('compose_exploration', { spec }, index);
    });
    const { service } = harness(request as never);
    await service.initialize(principal());
    await service.generate(principal(), generate());
    const feedback = request.mock.calls[2][0].input.findLast(
      (item: { type?: string }) => item.type === 'function_call_output',
    );
    expect(JSON.parse(feedback.output).issues).toEqual([{ code: 'panel_overlap', path: ['spec'] }]);
    expect(JSON.parse(feedback.output)).not.toHaveProperty('error');
  });
  it('keeps global concurrency across guest identities and does not release cancelled provider work early', async () => {
    let finish!: (value: MetaResult) => void;
    const pending = vi.fn(
      () =>
        new Promise<MetaResult>((resolve) => {
          finish = resolve;
        }),
    );
    const { service } = harness(pending as never);
    await service.initialize(principal());
    const body = generate(),
      work = service.generate(principal(), body);
    await vi.waitFor(() => expect(pending).toHaveBeenCalled());
    await service.cancel(principal(), body.requestId);
    for (const id of ['b', 'c', 'd']) {
      await service.initialize(principal(id));
      await explorationStore.mutate(principal(id), () => {}, { acquire: randomUUID() });
    }
    await service.initialize(principal('e'));
    await expect(
      explorationStore.mutate(principal('e'), () => {}, { acquire: randomUUID() }),
    ).rejects.toMatchObject({ code: 'busy' });
    finish(
      result('inspect_source', { summary: 'Graph', uncertainty: [], graph: exampleInput() }, 1),
    );
    await expect(work).rejects.toMatchObject({ code: 'cancelled' });
    await explorationStore.mutate(principal('e'), () => {}, { acquire: randomUUID() });
  });
  it('recovers bounded terminal history capacity while retaining cumulative usage facts', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const past = new Date(Date.now() - 300_000).toISOString();
    await explorationStore.mutate(principal(), (session) => {
      session.runs = Array.from({ length: 40 }, () => ({
        requestId: randomUUID(),
        status: 'published',
        startedAt: past,
        deadline: past,
        artifactId: randomUUID(),
        version: 1,
        calls: 2,
        costUsd: 0.01,
        usageCertain: true,
        reservedUsd: 0.35,
      }));
    });
    const artifact = (await service.generate(principal(), generate())).artifact;
    expect(artifact.generation.calls).toBe(2);
    const stored = (await explorationStore.read(principal()))!;
    expect(stored.runs).toHaveLength(1);
    expect(stored.retiredRuns).toMatchObject({
      published: 40,
      failed: 0,
      cancelled: 0,
      calls: 80,
      uncertainUsageRuns: 0,
    });
    expect(stored.retiredRuns!.knownCostUsd).toBeCloseTo(0.4);
    expect(stored.retiredRuns!.reservedUsd).toBeCloseTo(14);
  });
  it('archives missing legacy usage certainty conservatively without treating unknown cost as confirmed zero', async () => {
    const { service, request } = harness();
    await service.initialize(principal());
    const past = new Date(Date.now() - 300_000).toISOString();
    await explorationStore.mutate(principal(), (session) => {
      session.runs = [
        {
          requestId: randomUUID(),
          status: 'cancelled',
          startedAt: past,
          deadline: past,
          artifactId: randomUUID(),
          version: 1,
        },
        {
          requestId: randomUUID(),
          status: 'failed',
          startedAt: past,
          deadline: past,
          artifactId: randomUUID(),
          version: 1,
          calls: 0,
          costUsd: 0,
          usageCertain: true,
          reservedUsd: 0,
        },
        {
          requestId: randomUUID(),
          status: 'failed',
          startedAt: past,
          deadline: past,
          artifactId: randomUUID(),
          version: 1,
          calls: 1,
          costUsd: 0.02,
          usageCertain: false,
          reservedUsd: 0.35,
        },
      ];
    });
    await service.cancel(principal(), randomUUID());
    expect((await explorationStore.read(principal()))!.retiredRuns).toEqual({
      published: 0,
      failed: 2,
      cancelled: 1,
      calls: 1,
      knownCostUsd: 0.02,
      uncertainUsageRuns: 2,
      reservedUsd: 0.35,
    });
    expect(request).not.toHaveBeenCalled();
  });
  it('keeps recent cancel tombstones after pruning expired terminal facts', async () => {
    const { service, request } = harness();
    await service.initialize(principal());
    const cancelled = generate();
    await service.cancel(principal(), cancelled.requestId);
    const past = new Date(Date.now() - 300_000).toISOString();
    await explorationStore.mutate(principal(), (session) => {
      session.runs.push(
        ...Array.from({ length: 39 }, () => ({
          requestId: randomUUID(),
          status: 'failed' as const,
          startedAt: past,
          deadline: past,
          artifactId: randomUUID(),
          version: 1,
          calls: 1,
          costUsd: 0,
          usageCertain: false,
          reservedUsd: 0.35,
        })),
      );
    });
    await service.generate(principal(), generate());
    await expect(service.generate(principal(), cancelled)).rejects.toMatchObject({
      code: 'cancelled',
    });
    const stored = (await explorationStore.read(principal()))!;
    expect(
      stored.runs.some(
        (run) => run.requestId === cancelled.requestId && run.status === 'cancelled',
      ),
    ).toBe(true);
    expect(stored.retiredRuns).toMatchObject({ failed: 39, uncertainUsageRuns: 39 });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('never prunes an old generating request or releases its provider lease when cleaning terminal history', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const active = randomUUID(),
      past = new Date(Date.now() - 300_000).toISOString();
    await explorationStore.mutate(
      principal(),
      (session) => {
        session.activeRequestId = active;
        session.runs = [
          {
            requestId: active,
            status: 'generating',
            startedAt: past,
            deadline: past,
            artifactId: randomUUID(),
            version: 1,
          },
          ...Array.from({ length: 39 }, () => ({
            requestId: randomUUID(),
            status: 'published' as const,
            startedAt: past,
            deadline: past,
            artifactId: randomUUID(),
            version: 1,
          })),
        ];
      },
      { acquire: active },
    );
    for (const id of ['b', 'c', 'd']) {
      await service.initialize(principal(id));
      await explorationStore.mutate(principal(id), () => {}, { acquire: randomUUID() });
    }
    await service.cancel(principal(), randomUUID());
    const stored = (await explorationStore.read(principal()))!;
    expect(stored.runs.find((run) => run.requestId === active)?.status).toBe('generating');
    expect(stored.activeRequestId).toBe(active);
    await service.initialize(principal('e'));
    await expect(
      explorationStore.mutate(principal('e'), () => {}, { acquire: randomUUID() }),
    ).rejects.toMatchObject({ code: 'busy' });
  });
});

describe('fast explanatory follow-ups', () => {
  it('reuses owned context in one call, keeps the current traversal and stable layout, and does not rewrite history', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const original = (await setup.service.example(principal())).artifact;
    const request = vi.fn(async (args: any) => {
      const context = JSON.parse(args.input[0].content);
      expect(context.intent).toBe('focus');
      expect(context.checkedExecution.input.start).toBe('b');
      const match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      const spec = createExampleExploration({
        observationId: context.source.observationId,
        version: 1,
        region: null,
      });
      if (spec.mode !== 'checked-bfs') throw Error();
      spec.id = match[1];
      spec.version = Number(match[2]);
      spec.input = context.graph;
      spec.steps = [
        {
          id: 'focus-b',
          caption: 'B is expanded.',
          narration: null,
          highlightIds: ['b'],
          execution: 'primary',
          executionStep: 1,
        },
      ];
      for (const panel of spec.scene.panels)
        if (panel.kind === 'graph')
          panel.positions = panel.positions.map((p) => ({ ...p, x: 1 - p.x }));
      return result('compose_exploration', { spec }, 1);
    });
    const service = createExplorationService({
      request: request as never,
      upperBound: () => 0.03,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    const revised = (
      await service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: original.id,
        baseVersion: 1,
        intent: 'focus',
        question: 'Why B?',
        state: { ...original.state, start: 'b', step: 1, selectedObjectId: 'b' },
      })
    ).artifact;
    expect(request).toHaveBeenCalledTimes(1);
    expect(revised.generation.audit[0].event).toBe('source-reused');
    expect(revised.state).toMatchObject({ start: 'b', step: 1, selectedObjectId: 'b' });
    expect(revised.spec.mode === 'checked-bfs' && revised.spec.scene.panels[0]).toEqual(
      original.spec.mode === 'checked-bfs' && original.spec.scene.panels[0],
    );
    expect((await service.read(principal(), original.id, 1)).active).toEqual(original);
  });
  it('rejects an explain response that changes computation even if it passes mathematical validation', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const original = (await setup.service.example(principal())).artifact;
    const request = vi.fn(async (args: any) => {
      const context = JSON.parse(args.input[0].content),
        match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      const spec = createExampleExploration({
        observationId: context.source.observationId,
        version: 1,
        region: null,
      });
      if (spec.mode !== 'checked-bfs') throw Error();
      spec.id = match[1];
      spec.version = Number(match[2]);
      spec.input.start = 'b';
      return result('compose_exploration', { spec }, 1);
    });
    const service = createExplorationService({
      request: request as never,
      upperBound: () => 0.03,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await expect(
      service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: original.id,
        baseVersion: 1,
        intent: 'explain',
        question: 'Explain this',
      }),
    ).rejects.toMatchObject({ code: 'generation_invalid' });
    expect(request).toHaveBeenCalledTimes(2);
    expect((await service.read(principal(), original.id)).active).toEqual(original);
  });
});

describe('exploration prediction evidence', () => {
  it('retains the first answer, checks current controls, restores evidence and deletes lineage', async () => {
    const { service, request } = harness();
    await service.initialize(principal());
    const a = (await service.example(principal())).artifact;
    const base = {
      action: 'prediction',
      id: randomUUID(),
      artifactId: a.id,
      version: 1,
      state: { ...a.state, step: 1, reversed: true },
    };
    const opened = (await service.prediction(principal(), { ...base, operation: 'start' }))
      .prediction;
    expect(opened.expectedNodeId).toBeUndefined();
    const answered = (
      await service.prediction(principal(), {
        ...base,
        operation: 'answer',
        nodeId: 'a',
        reason: 'I expected alphabetical order.',
      })
    ).prediction;
    expect(answered.expectedNodeId).toBe('b');
    expect(answered.answer).toMatchObject({ nodeId: 'a', matches: false });
    expect(answered.exposure).toBe('diagram-visible-practice');
    await service.prediction(principal(), {
      ...base,
      operation: 'answer',
      nodeId: 'a',
      reason: 'I expected alphabetical order.',
    });
    await expect(
      service.prediction(principal(), { ...base, operation: 'answer', nodeId: 'b' }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    await expect(
      service.prediction(principal(), { ...base, state: a.state, operation: 'reveal' }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    closeExplorationStore();
    expect((await service.read(principal(), a.id)).predictions[0].answer).toEqual(answered.answer);
    expect(request).not.toHaveBeenCalled();
    await service.remove(principal(), a.id);
    expect((await explorationStore.read(principal()))?.predictions).toEqual([]);
  });
  it('rejects foreign ownership, stale versions and answers after reveal', async () => {
    const { service } = harness();
    await service.initialize(principal());
    const a = (await service.example(principal())).artifact;
    const base = {
      action: 'prediction',
      id: randomUUID(),
      artifactId: a.id,
      version: 1,
      state: a.state,
    };
    await expect(
      service.prediction(principal('b'), { ...base, operation: 'start' }),
    ).rejects.toMatchObject({ code: 'session_expired' });
    await expect(
      service.prediction(principal(), { ...base, version: 2, operation: 'start' }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    await service.prediction(principal(), { ...base, operation: 'start' });
    await service.prediction(principal(), { ...base, operation: 'reveal' });
    await expect(
      service.prediction(principal(), { ...base, operation: 'answer', nodeId: 's' }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
  });
  it('supplies server-owned prediction evidence to Spark, not a client correctness claim', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const a = (await setup.service.example(principal())).artifact;
    const base = {
      action: 'prediction',
      id: randomUUID(),
      artifactId: a.id,
      version: 1,
      state: a.state,
    };
    await setup.service.prediction(principal(), { ...base, operation: 'start' });
    await setup.service.prediction(principal(), {
      ...base,
      operation: 'answer',
      nodeId: 'g',
      reason: 'I thought the goal always goes first.',
    });
    const request = script();
    const service = harness(request).service;
    const adapted = (
      await service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: 1,
        state: a.state,
        predictionId: base.id,
        question: 'Help me investigate my prediction',
      })
    ).artifact;
    expect(adapted.learningContext).toMatchObject({
      predictionId: base.id,
      choice: 'Goal',
      expected: 'S',
      exposure: 'diagram-visible-practice',
    });
    const context = JSON.parse((request.mock.calls[0][0].input[0] as { content: string }).content);
    expect(context.learnerObservation.answer).toMatchObject({
      nodeId: 'g',
      matches: false,
      reason: 'I thought the goal always goes first.',
    });
    expect(context.learnerObservation).toMatchObject({
      sourceObservationId: a.source.observationId,
      modelVersion: 'bfs-unweighted-v1',
      exposure: 'diagram-visible-practice',
    });
    expect((await service.read(principal(), a.id, 1)).predictions[0].answer?.nodeId).toBe('g');
    await expect(
      service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: 2,
        state: a.state,
        predictionId: base.id,
        question: 'Reuse stale evidence',
      }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
  });
});

describe('targeted exploration Wonder review', () => {
  it('requires a repaired candidate to pass re-review and accounts for both models', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const a = (await setup.service.example(principal())).artifact;
    const id = randomUUID(),
      base = { action: 'prediction', id, artifactId: a.id, version: 1, state: a.state };
    await setup.service.prediction(principal(), { ...base, operation: 'start' });
    await setup.service.prediction(principal(), { ...base, operation: 'answer', nodeId: 'g' });
    const request = script();
    let index = 0;
    const review = vi.fn(async (_request: any) =>
      result(
        'review_exploration',
        ++index === 1
          ? {
              verdict: 'approve',
              findings: ['Explain that reaching the goal is checked on dequeue, not discovery.'],
            }
          : { verdict: 'approve', findings: [] },
        index,
      ),
    );
    const settle = vi.fn(async () => {});
    const service = createExplorationService({
      request: request as never,
      review,
      reviewEnabled: () => true,
      upperBound: () => 0.01,
      reserve: async () => randomUUID(),
      settle,
      enabled: () => true,
      revalidate: async () => {},
    });
    const revised = (
      await service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: 1,
        state: a.state,
        predictionId: id,
        question: 'Investigate my prediction',
      })
    ).artifact;
    expect(review).toHaveBeenCalledTimes(2);
    expect(review.mock.calls[0][0].model).toBe('muse-wonder-1.0');
    expect(revised.generation.calls).toBe(4);
    expect(revised.generation.audit.map((a) => a.event)).toContain('review-rejected');
    expect(revised.generation.audit.map((a) => a.event)).toContain('review-approved');
    expect(revised.generation.costUsd).toBeGreaterThan(0.008);
    expect(JSON.stringify(request.mock.calls.at(-1))).toContain('reviewFindings');
  });
  it('does not publish when the reviewer remains unsupported', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const a = (await setup.service.example(principal(), true)).artifact;
    expect(a.validation.assurance).toBe('checked-dijkstra');
    const request = vi.fn(async (args: any) => {
      const c = JSON.parse(args.input[0].content),
        m = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      const spec = structuredClone(a.spec);
      spec.id = m[1];
      spec.version = Number(m[2]);
      return result('compose_exploration', { spec }, 1);
    });
    const review = vi.fn(async (_request: any) =>
      result(
        'review_exploration',
        {
          verdict: 'unsupported',
          findings: ['The explanation makes an unsupported scientific claim.'],
        },
        1,
      ),
    );
    const service = createExplorationService({
      request: request as never,
      review,
      reviewEnabled: () => true,
      upperBound: () => 0.01,
      reserve: async () => randomUUID(),
      settle: async () => {},
      enabled: () => true,
      revalidate: async () => {},
    });
    await expect(
      service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: 1,
        state: a.state,
        intent: 'explain',
        question: 'Explain costs',
      }),
    ).rejects.toMatchObject({ code: 'generation_invalid' });
    expect((await service.read(principal(), a.id)).active!.version).toBe(1);
  });
});

describe('model-directed checked cost experiment', () => {
  it('executes the chosen probe and persists a bounded experiment with checked graph bindings', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const original = (await setup.service.example(principal(), true)).artifact;
    const copy = {
      title: 'Move a cost across the tie',
      objective: 'Test one edge against the checked alternative.',
      steps: [
        {
          traceIndex: 0,
          caption: 'Start with the captured graph.',
          narration: 'Change the direct edge cost to compare routes.',
          highlightIds: ['sg'],
        },
      ],
      followups: ['Why does the cheapest route change?'],
    };
    let calls = 0;
    const request = vi.fn(async (args: any) => {
      calls++;
      if (calls === 1) return result('choose_cost_probe', { edgeId: 'sg' }, 1);
      const c = JSON.parse(args.input[0].content);
      expect(c.experiment.criticalCost).toBe(3);
      return result(
        'compose_cost_experiment',
        {
          ...copy,
          steps: copy.steps.map((item) => (calls === 2 ? { ...item, traceIndex: 99 } : item)),
        },
        calls,
      );
    });
    const service = harness(request as never).service;
    const a = (
      await service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: original.id,
        baseVersion: 1,
        intent: 'investigate',
        state: original.state,
        question: 'Find the tipping point',
      })
    ).artifact;
    expect(a.generation.calls).toBe(3);
    expect(a.generation.audit.some((e) => e.event === 'repair-requested')).toBe(true);
    expect(a.spec.title).toBe(copy.title);
    if (a.spec.mode !== 'checked-dijkstra') throw Error();
    expect(a.spec.input).toEqual(
      original.spec.mode === 'checked-dijkstra' ? original.spec.input : null,
    );
    expect(a.spec.scene.panels.filter((p) => p.kind === 'graph')).toEqual(
      original.spec.mode === 'checked-dijkstra'
        ? original.spec.scene.panels.filter((p) => p.kind === 'graph')
        : null,
    );
    expect(a.experiment).toMatchObject({ edgeId: 'sg', criticalCost: 3 });
    expect(a.generation.audit.some((e) => e.event === 'cost-probed')).toBe(true);
    await service.save(principal(), a.id, a.version, { ...a.state, edgeWeights: { sg: 2 } });
    closeExplorationStore();
    expect((await service.read(principal(), a.id)).active!.state.edgeWeights).toEqual({ sg: 2 });
    await expect(
      service.save(principal(), a.id, a.version, { ...a.state, edgeWeights: { foreign: 2 } }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    const follow = vi.fn(async (args: any) => {
      const c = JSON.parse(args.input[0].content);
      expect(c.previous.checkedComparison.input.edges[0].weight).toBe(2);
      return result('compose_cost_experiment', copy, 1);
    });
    const next = (
      await harness(follow as never).service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: a.version,
        intent: 'explain',
        state: { ...a.state, edgeWeights: { sg: 2 } },
        question: 'Explain my changed cost',
      })
    ).artifact;
    expect(next.experiment?.edgeId).toBe('sg');
    if (next.spec.mode !== 'checked-dijkstra') throw Error();
    expect(next.spec.input.edges[0].weight).toBe(2);
    expect(next.spec.comparison!.input.edges[0].weight).toBe(2);
  });
});

describe('automatic follow-up preservation regression', () => {
  it('bounds configured concurrency independently of spending and recovers released capacity', async () => {
    vi.stubEnv('SOMA_EXPLORATION_MAX_ACTIVE', '6');
    const { service } = harness();
    const requests = Array.from({ length: 6 }, () => randomUUID());
    for (const [i, id] of ['a', 'b', 'c', 'd', 'e', 'f'].entries()) {
      await service.initialize(principal(id));
      await explorationStore.mutate(principal(id), () => {}, { acquire: requests[i] });
    }
    await service.initialize(principal('1'));
    await expect(
      explorationStore.mutate(principal('1'), () => {}, { acquire: randomUUID() }),
    ).rejects.toMatchObject({ code: 'busy' });
    await explorationStore.mutate(principal('a'), () => {}, { release: requests[0] });
    await explorationStore.mutate(principal('1'), () => {}, { acquire: randomUUID() });
  });

  it('opens a real recorded generation without provider spend and gives each workspace its own artifact', async () => {
    const { service, request, reserve } = harness();
    await service.initialize(principal());
    await service.initialize(principal('b'));
    const a = (await service.recording(principal())).artifact,
      b = (await service.recording(principal('b'))).artifact;
    expect(a.generation.calls).toBe(3);
    expect(a.generation.audit.some((e) => e.event === 'review-approved')).toBe(true);
    expect(a.generation.costUsd).toBe(0.03898425);
    expect(a.recording?.generatedAt).toBe('2026-10-29T22:22:30.119Z');
    expect(a.executions!.primary.path).toEqual(['P', 'Q', 'R']);
    expect(a.id).not.toBe(b.id);
    expect(a.source.observationId).not.toBe(b.source.observationId);
    expect(request).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    await expect(service.save(principal('b'), a.id, a.version, a.state)).rejects.toMatchObject({
      code: 'not_found',
    });
    await service.save(principal(), a.id, a.version, { ...a.state, step: 2 });
    closeExplorationStore();
    expect((await service.read(principal(), a.id)).active!.recording).toEqual(a.recording);
  });
  it.each(['disabled-edge', 'cleared-goal'] as const)(
    'explains an unavailable saved probe without restoring controls: %s',
    async (kind) => {
      const setup = harness();
      await setup.service.initialize(principal());
      const original = (await setup.service.example(principal(), true)).artifact;
      if (original.spec.mode !== 'checked-dijkstra') throw Error();
      const { probeEdgeCost } = await import('../../src/lib/domain/cost-probe');
      await explorationStore.mutate(principal(), (session) => {
        session.artifacts[0].experiment = probeEdgeCost(
          original.spec.mode === 'checked-dijkstra' ? original.spec.input : null,
          'sg',
        );
      });
      const state = {
        ...original.state,
        ...(kind === 'disabled-edge' ? { disabledEdgeIds: ['sg'] } : { goal: null }),
      };
      const request = vi.fn(async (args: any) => {
        const c = JSON.parse(args.input[0].content),
          binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
        expect(c.experiment).toBeUndefined();
        const spec = structuredClone(original.spec);
        if (spec.mode !== 'checked-dijkstra') throw Error();
        spec.id = binding[1];
        spec.version = Number(binding[2]);
        spec.input = c.graph;
        spec.comparison!.input = c.previous.checkedComparison.input;
        spec.steps = [
          {
            id: 'preserved',
            execution: 'primary',
            executionStep: 0,
            caption: 'Inspect the graph with your current controls.',
            narration: null,
            highlightIds: ['s'],
          },
        ];
        return result('compose_exploration', { spec }, 1);
      });
      const service = harness(request as never).service;
      const revised = (
        await service.generate(principal(), {
          action: 'generate',
          requestId: randomUUID(),
          artifactId: original.id,
          baseVersion: 1,
          state,
          question: 'Explain the graph as it is now.',
        })
      ).artifact;
      expect(revised.version).toBe(2);
      expect(revised.experiment).toBeUndefined();
      expect(revised.source).toEqual(original.source);
      expect(revised.generation.audit.some((e) => e.event === 'cost-probe-unavailable')).toBe(true);
      const input = revised.executions!.primary.input;
      if (kind === 'disabled-edge') {
        expect(input.edges.some((e) => e.id === 'sg')).toBe(false);
        expect(revised.executions!.primary.path).toEqual(['s', 'a', 'b', 'g']);
      } else {
        expect(input.goal).toBeNull();
        expect(revised.executions!.primary.status).toBe('complete');
      }
      await service.save(principal(), revised.id, revised.version, revised.state);
      closeExplorationStore();
      expect(
        (await service.read(principal(), revised.id)).active!.executions!.primary.input,
      ).toEqual(input);
      expect((await service.read(principal(), original.id, 1)).active!.experiment?.edgeId).toBe(
        'sg',
      );
    },
  );
  it.each([false, true])(
    'rejects attempts to restore source defaults after changed controls, weighted=%s',
    async (weighted) => {
      const setup = harness();
      await setup.service.initialize(principal());
      const original = (await setup.service.example(principal(), weighted)).artifact;
      const request = vi.fn(async (args: any) => {
        const c = JSON.parse(args.input[0].content),
          m = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
        const spec = structuredClone(original.spec);
        spec.id = m[1];
        spec.version = Number(m[2]);
        return result('compose_exploration', { spec }, 1);
      });
      const service = harness(request as never).service;
      await expect(
        service.generate(principal(), {
          action: 'generate',
          requestId: randomUUID(),
          artifactId: original.id,
          baseVersion: 1,
          intent: 'auto',
          question: 'Why can I not reach X from B with these connections?',
          state: {
            ...original.state,
            start: 'b',
            goal: 'x',
            disabledEdgeIds: ['sa'],
            reversed: true,
            ...(weighted ? { edgeWeights: { sg: 2 } } : {}),
          },
        }),
      ).rejects.toMatchObject({ code: 'generation_invalid' });
      expect(request).toHaveBeenCalledTimes(2);
      expect((await service.read(principal(), original.id)).active).toEqual(original);
      const stored = (await explorationStore.read(principal()))!;
      expect(stored.runs.at(-1)?.failure).toEqual({
        stage: 'validation',
        issues: [{ code: 'graph_binding', path: ['spec'] }],
      });
    },
  );
  it('publishes and persists the effective graph for an explanatory auto response', async () => {
    const setup = harness();
    await setup.service.initialize(principal());
    const original = (await setup.service.example(principal())).artifact;
    const state = {
      ...original.state,
      start: 'b',
      goal: 'x',
      disabledEdgeIds: ['sa'],
      reversed: true,
      step: 1,
    };
    const revised = (
      await harness().service.generate(principal(), {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: original.id,
        baseVersion: 1,
        question: 'Why is X unreachable?',
        state,
      })
    ).artifact;
    expect(revised.executions!.primary.input).toMatchObject({
      start: 'b',
      goal: 'x',
      neighborOrder: ['x', 'g', 'c', 'b', 'a', 's'],
    });
    expect(revised.executions!.primary.input.edges.some((e) => e.id === 'sa')).toBe(false);
    expect(revised.executions!.primary.status).toBe('unreachable');
    await setup.service.save(principal(), revised.id, revised.version, revised.state);
    closeExplorationStore();
    expect((await setup.service.read(principal(), revised.id)).active!.executions).toEqual(
      revised.executions,
    );
    expect((await setup.service.read(principal(), original.id, 1)).active).toEqual(original);
  });
});

describe('general screenshot contract without prepared-example fallback', () => {
  it('keeps screenshot interpretation independent of example facts and binds non-graph composition to the owned source', async () => {
    // Scripted extraction checks the application boundary, not vision quality.
    // Actual cross-domain image interpretation is evaluated separately with Spark.
    const request = vi.fn(async (args: any) => {
      const raw = args.input[0].content,
        context = JSON.parse(Array.isArray(raw) ? raw[0].text : raw);
      expect(context.sourceText).toBeNull();
      expect(context.previous).toBeNull();
      if (!args.instructions.includes('Required spec id=')) {
        expect(raw[1]).toEqual({
          type: 'input_image',
          image_url: 'data:image/png;base64,ORIGINAL_TEST_IMAGE',
        });
        return result(
          'inspect_source',
          {
            summary: 'Sensor batch 43 uses multiplication followed by subtraction.',
            uncertainty: [],
            graph: null,
          },
          1,
        );
      }
      expect(context.graph).toBeNull();
      expect(context.checkedExecution).toBeNull();
      const compose = args.tools.find((t: any) => t.name === 'compose_exploration'),
        branches = compose.parameters.properties.spec.anyOf;
      expect(branches.map((b: any) => b.properties.mode.const)).toEqual(['explanation', 'clarify']);
      const match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      for (const branch of branches) {
        expect(branch.properties.id.const).toBe(match[1]);
        expect(branch.properties.version.const).toBe(1);
        expect(branch.properties.sources).toMatchObject({
          minItems: 1,
          maxItems: 1,
          items: {
            properties: {
              observationId: { const: context.source.observationId },
              version: { const: 1 },
            },
          },
        });
      }
      const spec = {
        schemaVersion: 'exploration-v1',
        id: match[1],
        version: 1,
        title: 'Sensor batch 43',
        objective: 'Explain the visible worksheet.',
        sources: [{ observationId: context.source.observationId, version: 1, region: null }],
        assumptions: [],
        uncertainty: [],
        unsupportedClaims: [],
        mode: 'explanation',
        scene: {
          layout: 'stack',
          panels: [
            {
              id: 'worksheet-flow',
              kind: 'text',
              title: 'Calculation',
              text: context.source.summary,
              placement: { column: 1, row: 1, columnSpan: 2 },
            },
          ],
        },
        steps: [
          {
            id: 'read-batch',
            caption: 'Read the batch-specific calculation.',
            narration: null,
            highlightIds: ['worksheet-flow'],
            execution: null,
            executionStep: null,
          },
        ],
        followups: [],
      };
      return result('compose_exploration', { spec }, 2);
    });
    const { service } = harness(request as never);
    await service.initialize(principal());
    const a = (
      await service.generate(
        principal(),
        generate({
          question: 'Explain this screenshot.',
          source: {
            kind: 'screenshot',
            dataUrl: 'data:image/png;base64,ORIGINAL_TEST_IMAGE',
            label: 'Screenshot',
            capturedAt: new Date().toISOString(),
          },
        }),
      )
    ).artifact;
    expect(a.source.kind).toBe('screenshot');
    expect(a.validation.assurance).toBe('explanation-only');
    expect(a.executions).toBeNull();
    expect(a.spec.title).toBe('Sensor batch 43');
    expect(a.generation.mode).toBe('live');
    expect(JSON.stringify(request.mock.calls)).not.toContain('sa:s->a');
    expect(JSON.stringify(request.mock.calls[1])).not.toContain('ORIGINAL_TEST_IMAGE');
  });
  it('constrains checked mode and model bindings to the actual computed family', async () => {
    const base = script();
    const request = vi.fn(async (args: any) => {
      if (args.instructions.includes('Required spec id=')) {
        const compose = args.tools.find((t: any) => t.name === 'compose_exploration');
        const branch = compose.parameters.properties.spec.anyOf[0];
        expect(branch.properties.mode.const).toBe('checked-bfs');
        expect(branch.properties.modelId.const).toBe('bfs-unweighted');
        expect(branch.properties.modelVersion.const).toBe('bfs-unweighted-v1');
      }
      return base(args);
    });
    const { service } = harness(request as never);
    await service.initialize(principal());
    expect((await service.generate(principal(), generate())).artifact.validation.assurance).toBe(
      'checked-bfs',
    );
  });
});
