import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService } from '../../src/lib/server/exploration';
import { explorationStore, closeExplorationStore } from '../../src/lib/server/exploration-store';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

const owner = (id = 'a'): ExplorationPrincipal => ({
  kind: 'guest',
  id: id.repeat(64),
  workspaceId: id.repeat(64),
  generation: id.repeat(64),
  key: `guest-${id.repeat(64)}`,
});
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'soma-fresh-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(dir, 'explore.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
function harness() {
  const request = vi.fn(),
    reserve = vi.fn(async () => randomUUID());
  return {
    request,
    reserve,
    service: createExplorationService({
      request,
      reserve,
      enabled: () => true,
      revalidate: async () => {},
    }),
  };
}
async function setup(weighted = true) {
  const h = harness(),
    p = owner();
  await h.service.initialize(p);
  const { artifact } = await h.service.example(p, weighted);
  await h.service.save(p, artifact.id, 1, artifact.state);
  const raw = {
    action: 'application',
    id: randomUUID(),
    artifactId: artifact.id,
    version: 1,
    operation: 'start',
  };
  return { ...h, p, artifact, raw };
}
describe('saved exploration fresh practice persistence and ownership', () => {
  it('starts without inference, hides solution through resume, and preserves source/state/version and actual timestamps', async () => {
    const { service, p, artifact, raw, request, reserve } = await setup();
    const first = (await service.application(p, raw)).application;
    expect(first).not.toHaveProperty('expected');
    expect(first).not.toHaveProperty('solution');
    expect(first.sourceObservationId).toBe(artifact.source.observationId);
    expect(first.state).toEqual(artifact.state);
    expect(first.savedAt).toBe((await service.read(p, artifact.id)).active!.updatedAt);
    expect((await service.application(p, raw)).application).toEqual(first);
    expect((await service.read(p, artifact.id)).applications).toEqual([first]);
    expect(request).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
  it('records hint before an immutable original answer, including replay/revision rejection and separately retained later attempts', async () => {
    const { service, p, artifact, raw } = await setup();
    await service.application(p, raw);
    await service.application(p, { ...raw, operation: 'hint' });
    const answered = (
      await service.application(p, {
        ...raw,
        operation: 'answer',
        value: 999,
        reason: 'I counted the connections.',
      })
    ).application;
    expect(answered.answer).toMatchObject({
      value: 999,
      matches: false,
      assistance: 'hint',
      reason: 'I counted the connections.',
    });
    expect(answered.solution).toBeDefined();
    expect(
      (
        await service.application(p, {
          ...raw,
          operation: 'answer',
          value: 999,
          reason: 'I counted the connections.',
        })
      ).application,
    ).toEqual(answered);
    await expect(
      service.application(p, { ...raw, operation: 'answer', value: answered.solution!.value }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    const second = (await service.application(p, { ...raw, id: randomUUID() })).application;
    expect(second.previousAttemptAt).toBe(answered.answer!.recordedAt);
    expect((await service.read(p, artifact.id)).applications).toHaveLength(2);
  });
  it('reveals without fabricating an answer, blocks answering afterward, and opens one checked child without changing the original', async () => {
    const { service, p, artifact, raw } = await setup(false);
    await service.application(p, raw);
    await expect(service.application(p, { ...raw, operation: 'explore' })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    const revealed = (await service.application(p, { ...raw, operation: 'reveal' })).application;
    expect(revealed.answer).toBeNull();
    expect(revealed.solution).toBeDefined();
    await expect(
      service.application(p, { ...raw, operation: 'answer', value: 1 }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    const opened = (await service.application(p, { ...raw, operation: 'explore' })).artifact!;
    expect(opened.practiceOrigin).toMatchObject({
      applicationId: raw.id,
      artifactId: artifact.id,
      version: 1,
    });
    expect(opened.generation.calls).toBe(0);
    expect(opened.spec.mode).toBe('checked-bfs');
    expect((await service.application(p, { ...raw, operation: 'explore' })).artifact!.id).toBe(
      opened.id,
    );
    const original = (await service.read(p, artifact.id)).active!;
    expect(original.spec).toEqual(artifact.spec);
    expect(original.state).toEqual(artifact.state);
    await service.remove(p, artifact.id);
    expect((await service.read(p)).applications).toEqual([]);
  });
  it('rejects unsaved starts, foreign workspace IDs, forged answer fields and unbound adaptation before reserving inference', async () => {
    const { service, p, artifact, raw, reserve } = await setup();
    await service.initialize(owner('b'));
    await expect(service.application(owner('b'), raw)).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.application(p, { ...raw, expected: 1 })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    const other = (await service.example(p)).artifact;
    await expect(service.application(p, { ...raw, artifactId: other.id })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await service.application(p, raw);
    await expect(
      service.generate(p, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: artifact.id,
        baseVersion: 1,
        applicationId: raw.id,
        question: 'Explain my answer',
        state: artifact.state,
      }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    expect(reserve).not.toHaveBeenCalled();
  });
  it('passes the original fresh answer and its checked problem to Spark and preserves the parent when composition fails', async () => {
    const { service, p, raw, request } = await setup();
    await service.application(p, raw);
    await service.application(p, {
      ...raw,
      operation: 'answer',
      value: 999,
      reason: 'Take fewer hops.',
    });
    const child = (await service.application(p, { ...raw, operation: 'explore' })).artifact!;
    request.mockImplementation(async () => {
      throw Error('provider failed');
    });
    await expect(
      service.generate(p, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: child.id,
        baseVersion: 1,
        applicationId: raw.id,
        question: 'Explain my answer',
        state: child.state,
      }),
    ).rejects.toMatchObject({ code: 'generation_invalid' });
    const context = JSON.parse(request.mock.calls[0][0].input[0].content);
    expect(context.learnerObservation.answer).toMatchObject({
      value: 999,
      reason: 'Take fewer hops.',
      assistance: 'none',
    });
    expect(context.graph).toEqual(child.spec.mode === 'checked-dijkstra' ? child.spec.input : null);
    expect((await service.read(p, raw.artifactId)).active!.saved).toBe(true);
    expect((await service.read(p, child.id)).active!.version).toBe(1);
  });
  it('publishes a response-adapted checked visual with fresh-answer lineage, without changing the original', async () => {
    const { service, p, raw, request } = await setup();
    await service.application(p, raw);
    await service.application(p, {
      ...raw,
      operation: 'answer',
      value: 999,
      reason: 'Fewer hops looked cheaper.',
    });
    const child = (await service.application(p, { ...raw, operation: 'explore' })).artifact!;
    request.mockImplementation(async (input) => {
      const context = JSON.parse(input.input[0].content);
      const binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(input.instructions)!;
      const spec = structuredClone(context.previous.spec);
      spec.id = binding[1];
      spec.version = Number(binding[2]);
      spec.title = 'Compare costs before counting connections';
      const args = { spec };
      return {
        status: 'completed',
        tools: [
          {
            type: 'function_call',
            name: 'compose_exploration',
            arguments: JSON.stringify(args),
            call_id: 'response1',
            parsedArguments: args,
          },
        ],
        usage: { input_tokens: 100, output_tokens: 100 },
      };
    });
    const adapted = (
      await service.generate(p, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: child.id,
        baseVersion: 1,
        applicationId: raw.id,
        question: 'Explain my answer',
        state: child.state,
      })
    ).artifact;
    expect(adapted.version).toBe(2);
    expect(adapted.learningContext).toMatchObject({
      applicationId: raw.id,
      choice: '999',
      reason: 'Fewer hops looked cheaper.',
      exposure: 'fresh-problem-reference-available',
    });
    expect(adapted.practiceOrigin).toEqual(child.practiceOrigin);
    expect((await service.read(p, raw.artifactId)).active!.version).toBe(1);
    const next = (
      await service.generate(p, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: child.id,
        baseVersion: 2,
        question: 'Explain this again',
        state: adapted.state,
      })
    ).artifact;
    expect(next.learningContext?.applicationId).toBe(raw.id);
    expect(
      JSON.parse(request.mock.calls.at(-1)![0].input[0].content).learnerObservation.answer.value,
    ).toBe(999);
    await service.remove(p, child.id);
    expect((await service.read(p, raw.artifactId)).applications[0].answer!.value).toBe(999);
    const reopened = (await service.application(p, { ...raw, operation: 'explore' })).artifact!;
    expect(reopened.id).not.toBe(child.id);
    await service.remove(p, raw.artifactId);
    expect((await service.read(p)).artifacts).toEqual([]);
  });
});
