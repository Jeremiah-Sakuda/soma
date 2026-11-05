import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import type { VerifiedAccount } from '../../src/lib/server/account';
const queue = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock('../../src/lib/server/jobs', () => ({ enqueuePreparation: queue.enqueue }));
import {
  collectedPreparationScopes,
  handoffCollectedPreparation,
  queueCollectedPreparation,
} from '../../src/lib/server/connectors/preparation';

beforeEach(() => {
  queue.enqueue.mockReset();
});
const account = {} as VerifiedAccount; // Authentication and durable admission are checked by their own integration cases.
const prefix = 'gmail:google-gmail:';
const PRIVATE = 'PRIVATE synthetic provider exception must never enter handoff results';
function semester(count = 65) {
  const workspace = seedWorkspace('semester');
  workspace.sources = [];
  for (let index = 0; index < count; index++)
    workspace.sources.push({
      id: `source-${String(index).padStart(3, '0')}`,
      courseId: index < 61 ? 'probability' : 'circuits',
      title: 'Original synthetic source',
      body: 'Original synthetic notes',
      version: 1,
      origin: 'live',
      kind: 'email',
      retrievedAt: workspace.createdAt,
      status: 'current',
      provenance: {
        automaticPreparation: true,
        origin: 'live-google',
        sourceKey: `gmail:google-gmail:message-${index}`,
        contentHash: String(index),
        importedAt: workspace.createdAt,
      },
    });
  return workspace;
}

it('partitions a semester of collected sources into bounded jobs without losing observations or mixing courses', () => {
  const workspace = semester();
  const before = structuredClone(workspace);
  const scopes = collectedPreparationScopes(workspace, 'gmail:google-gmail:');
  expect(scopes.map((scope) => [scope.courseId, scope.sources.length])).toEqual([
    ['probability', 20],
    ['probability', 20],
    ['probability', 20],
    ['probability', 1],
    ['circuits', 4],
  ]);
  expect(new Set(scopes.flatMap((scope) => scope.sources.map((source) => source.id))).size).toBe(
    65,
  );
  expect(workspace).toEqual(before);
  expect(
    collectedPreparationScopes(
      { ...workspace, sources: [...workspace.sources].reverse() },
      'gmail:google-gmail:',
    )
      .find((scope) => scope.courseId === 'probability')
      ?.sources.map((source) => source.id),
  ).toEqual(scopes[0].sources.map((source) => source.id));
  expect(
    collectedPreparationScopes(
      {
        ...workspace,
        sources: workspace.sources.map((source) => ({ ...source, status: 'stale' })),
      },
      'gmail:google-gmail:',
    ),
  ).toEqual([]);
  expect(collectedPreparationScopes(workspace, 'blackboard:browser-blackboard:')).toEqual([]);
});

describe('selected-source preparation handoff facts', () => {
  it('retains partial successes and fixed failure facts without changing saved sources or skipping later courses', async () => {
    const workspace = semester(),
      before = structuredClone(workspace);
    queue.enqueue
      .mockResolvedValueOnce({ status: 'queued' })
      .mockRejectedValueOnce({ code: 'job_capacity', message: PRIVATE })
      .mockRejectedValueOnce({ code: 'revision_conflict', message: PRIVATE })
      .mockRejectedValueOnce(new Error(PRIVATE))
      .mockResolvedValueOnce({ status: 'checking' });
    const outcomes = await handoffCollectedPreparation(account, workspace, prefix);
    expect(outcomes).toEqual([
      { courseId: 'probability', status: 'queued' },
      { courseId: 'probability', status: 'deferred', code: 'capacity' },
      { courseId: 'probability', status: 'deferred', code: 'source-change' },
      { courseId: 'probability', status: 'deferred', code: 'unavailable' },
      { courseId: 'circuits', status: 'queued' },
    ]);
    expect(JSON.stringify(outcomes)).not.toContain(PRIVATE);
    expect(queue.enqueue).toHaveBeenCalledTimes(5);
    expect(queue.enqueue.mock.calls.map((call) => call[3].length)).toEqual([20, 20, 20, 1, 4]);
    for (const call of queue.enqueue.mock.calls) {
      expect(call[0]).toBe(account);
      expect(call[1]).toBe(workspace);
      expect(
        call[3].every((ref: { sourceId: string; version: number }) =>
          workspace.sources.some(
            (source) =>
              source.id === ref.sourceId &&
              source.version === ref.version &&
              source.courseId === call[2],
          ),
        ),
      ).toBe(true);
      expect(call[4].length).toBeLessThanOrEqual(300);
      expect(call.slice(5)).toEqual([0, 'investigate-change']);
    }
    expect(workspace).toEqual(before);
  });

  it('keeps the string API and explains queue capacity without reporting failed collection or an unchecked budget', async () => {
    const workspace = semester(21),
      before = structuredClone(workspace);
    queue.enqueue
      .mockResolvedValueOnce({ status: 'generating' })
      .mockRejectedValueOnce({ code: 'job_capacity', message: PRIVATE });
    const notice = await queueCollectedPreparation(account, workspace, prefix);
    expect(typeof notice).toBe('string');
    expect(notice).toContain('1 source investigation job(s) saved or already queued');
    expect(notice).toContain('Sources are saved. The preparation queue is full');
    expect(notice).toContain('background recovery');
    expect(notice).toContain('retry later');
    expect(notice).not.toMatch(/budget|credit|inference allowance|source check failed/i);
    expect(notice).not.toContain(PRIVATE);
    expect(workspace).toEqual(before);
  });

  it('distinguishes already-completed decisions and terminal stale/failed jobs from work that is actually queued', async () => {
    queue.enqueue
      .mockResolvedValueOnce({ status: 'ready' })
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'stale' });
    expect(await handoffCollectedPreparation(account, semester(41), prefix)).toEqual([
      { courseId: 'probability', status: 'ready' },
      { courseId: 'probability', status: 'deferred', code: 'unavailable' },
      { courseId: 'probability', status: 'deferred', code: 'source-change' },
    ]);
    queue.enqueue.mockResolvedValueOnce({ status: 'ready' });
    const notice = await queueCollectedPreparation(account, semester(1), prefix);
    expect(notice).toContain('already completed');
    expect(notice).not.toContain('already queued');
    expect(notice).not.toMatch(/lesson.*ready|new lesson|generated lesson/i);
  });

  it.each(['job_source_scope', 'workspace_changed'] as const)(
    'records %s as a changed handoff scope without changing source freshness',
    async (code) => {
      const workspace = semester(1),
        before = structuredClone(workspace);
      queue.enqueue.mockRejectedValue({ code, message: PRIVATE });
      expect(await handoffCollectedPreparation(account, workspace, prefix)).toEqual([
        { courseId: 'probability', status: 'deferred', code: 'source-change' },
      ]);
      expect(await queueCollectedPreparation(account, workspace, prefix)).toContain(
        'selected versions changed',
      );
      expect(workspace).toEqual(before);
    },
  );

  it('does not infer queue capacity or budget from HTTP status, prose or an unexpected error code', async () => {
    for (const error of [
      Object.assign(new Error('Queue full: ' + PRIVATE), { status: 429 }),
      { code: 'inference_budget_global', message: PRIVATE },
      {
        code: {
          toString: () => {
            throw new Error(PRIVATE);
          },
        },
      },
      Object.defineProperty({}, 'code', {
        get() {
          throw new Error(PRIVATE);
        },
      }),
    ]) {
      queue.enqueue.mockRejectedValueOnce(error);
      expect(await handoffCollectedPreparation(account, semester(1), prefix)).toEqual([
        { courseId: 'probability', status: 'deferred', code: 'unavailable' },
      ]);
    }
  });

  it('does not queue stale or unselected sources and preserves the empty string response when there is no selected scope', async () => {
    const workspace = semester(1);
    workspace.sources[0].status = 'stale';
    expect(await handoffCollectedPreparation(account, workspace, prefix)).toEqual([]);
    expect(await queueCollectedPreparation(account, workspace, prefix)).toBe('');
    expect(
      await queueCollectedPreparation(account, semester(1), 'blackboard:browser-blackboard:'),
    ).toBe('');
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
