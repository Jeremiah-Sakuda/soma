import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createExplorationService,
  generateExplorationSchema,
} from '../../src/lib/server/exploration';
import {
  closeExplorationStore,
  explorationStore,
} from '../../src/lib/server/exploration-store';
import { createExampleExploration } from '../../src/lib/domain/exploration';
import type { MetaResult } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
const principal = (letter = 'a'): ExplorationPrincipal => ({
  kind: 'guest',
  id: letter.repeat(64),
  workspaceId: letter.repeat(64),
  generation: letter.repeat(64),
  key: 'guest-' + letter.repeat(64),
});
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-point-context-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'point.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const focus = { kind: 'circle', region: { x: 0.2, y: 0.3, width: 0.25, height: 0.4 } };
const input = () => ({
  action: 'generate',
  requestId: randomUUID(),
  question: 'Why does this connection matter?',
  source: {
    kind: 'screenshot',
    label: 'Original synthetic selected display',
    capturedAt: new Date().toISOString(),
    dataUrl: 'data:image/jpeg;base64,ORIGINAL_SYNTHETIC_ONLY',
    focus,
  },
});
const result = (name: string, args: unknown): MetaResult => ({
  status: 'completed',
  tools: [
    {
      type: 'function_call',
      call_id: randomUUID(),
      name,
      arguments: JSON.stringify(args),
      parsedArguments: args as Record<string, unknown>,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 100 },
});
it('passes explicit focus into vision and composition, persists its exact source lineage, and keeps pixels transient', async () => {
  const request = vi.fn(async (r: any) => {
    const context = JSON.parse(
      r.input[0].content instanceof Array ? r.input[0].content[0].text : r.input[0].content,
    );
    if (!r.instructions.includes('Required spec id=')) {
      const s = createExampleExploration();
      if (s.mode !== 'checked-bfs') throw Error();
      return result('inspect_source', {
        summary: 'Original synthetic selected graph',
        uncertainty: [],
        graph: s.input,
      });
    }
    const binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(r.instructions)!,
      spec = createExampleExploration({
        observationId: context.source.observationId,
        version: context.source.version,
        region: null,
      });
    spec.id = binding[1];
    spec.version = Number(binding[2]);
    return result('compose_exploration', { spec });
  });
  const service = createExplorationService({
    request: request as never,
    validateImage: () => ({}) as never,
    enabled: () => true,
    reviewEnabled: () => false,
    upperBound: () => 0.01,
    reserve: async () => randomUUID(),
    settle: async () => {},
    revalidate: async () => {},
  });
  const owner = principal();
  await service.initialize(owner);
  const original = (await service.generate(owner, input())).artifact;
  expect(original.source.focus).toEqual(focus);
  expect(
    JSON.parse((request.mock.calls[0][0].input[0] as any).content[0].text).source.focus,
  ).toEqual(focus);
  expect(JSON.parse((request.mock.calls[1][0].input[0] as any).content).source.focus).toEqual(
    focus,
  );
  const revision = (
    await service.generate(owner, {
      action: 'generate',
      requestId: randomUUID(),
      artifactId: original.id,
      baseVersion: 1,
      state: original.state,
      question: 'Explain the same connection',
    })
  ).artifact;
  expect(revision.source).toEqual(original.source);
  expect((await service.read(owner, original.id, 1)).active!.source.focus).toEqual(focus);
  expect((await explorationStore.read(owner))!.artifacts[0]).toEqual(original);
  expect(
    readFileSync(join(directory, 'point.sqlite')).includes(
      Buffer.from('ORIGINAL_SYNTHETIC_ONLY'),
    ),
  ).toBe(false);
  expect(JSON.stringify(await explorationStore.read(owner))).not.toContain('data:image');
  await service.initialize(principal('b'));
  await expect(service.read(principal('b'), original.id)).rejects.toMatchObject({
    code: 'not_found',
  });
});
it.each([
  { kind: 'point', region: { x: 0.9, y: 0, width: 0.2, height: 0.1 } },
  { kind: 'circle', region: { x: 0, y: 0, width: 0, height: 0.1 } },
  { kind: 'point', region: { x: 0, y: 0, width: 0.1, height: 0.1 }, path: [{ x: 1, y: 2 }] },
])(
  'rejects out-of-bounds, degenerate and raw-trajectory input before generation: %j',
  (bad) => {
    const request = input();
    expect(
      generateExplorationSchema.safeParse({
        ...request,
        source: { ...request.source, focus: bad },
      }).success,
    ).toBe(false);
  },
);
it('does not attach pointing observations to an authored example', () => {
  const r = input();
  expect(
    generateExplorationSchema.safeParse({ ...r, source: { ...r.source, kind: 'example' } })
      .success,
  ).toBe(false);
});
