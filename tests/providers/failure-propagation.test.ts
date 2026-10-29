import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import { adaptationFixture } from '../fixtures/adaptation';
import { PreparationError, prepareWithSpark } from '../../src/lib/server/meta';
import { InvestigationError, investigateWithSpark } from '../../src/lib/server/investigator';
import { executionFailure, retryableExecutionFailure, type ExecutionFailure } from '../../src/lib/server/execution-failure';
import { MetaClientError } from '../../src/lib/server/meta-client';
import { preparationFailurePatch, type PreparationJob } from '../../src/lib/server/jobs';
import { adaptationForAttempt, adaptationFailurePatch } from '../../src/lib/server/adaptation-jobs';
import type { AuditEventInput } from '../../src/lib/domain/audit';
import { usageCost } from '../../src/lib/server/budget';

const usage = { input_tokens: 100, output_tokens: 10 };
let directory: string, path: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-failure-propagation-')); path = join(directory, 'budget.sqlite');
  for (const [key, value] of Object.entries({ MODEL_API_KEY: 'synthetic-transport-key', META_API_BASE_URL: 'https://api.meta.ai/v1', META_MODEL_ID: 'muse-spark-1.3', SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'true', META_ALLOCATION_USD: '150', META_APP_SPEND_CAP_USD: '2', SOMA_BUDGET_DB_PATH: path })) vi.stubEnv(key, value);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
function charges() { const db = new DatabaseSync(path); try { return db.prepare('SELECT reserved, charged FROM reservations').all(); } finally { db.close(); } }
async function failed(operation: Promise<unknown>): Promise<PreparationError | InvestigationError> {
  const error = await operation.catch(value => value);
  if (!(error instanceof PreparationError || error instanceof InvestigationError)) throw new Error('Expected a typed engine rejection.');
  return error;
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const scenarios: { label: string; fetch: () => Promise<Response>; failure: ExecutionFailure; retry: boolean; known: boolean }[] = [
  { label: 'transport interruption', fetch: async () => { throw new Error('PRIVATE socket details'); }, failure: { kind: 'provider', code: 'network', requestSent: true, usage: null }, retry: true, known: false },
  { label: 'HTTP rejection with usage', fetch: async () => response({ error: { message: 'PRIVATE rejected payload' }, usage }, 503), failure: { kind: 'provider', code: 'http', requestSent: true, usage }, retry: true, known: true },
  { label: 'HTTP rejection without usage', fetch: async () => response({ error: { message: 'PRIVATE rejected payload' } }, 401), failure: { kind: 'provider', code: 'http', requestSent: true, usage: null }, retry: true, known: false },
  { label: 'incomplete decision', fetch: async () => response({ status: 'incomplete', output: [], usage }), failure: { kind: 'validation', code: 'incomplete' }, retry: false, known: true },
  { label: 'unsafe tool', fetch: async () => response({ status: 'completed', output: [{ type: 'function_call', name: 'send_email', arguments: '{}', call_id: 'synthetic' }], usage }), failure: { kind: 'provider', code: 'tool_invalid', requestSent: true, usage }, retry: false, known: true },
  { label: 'unconfirmed usage', fetch: async () => response({ status: 'completed', output: [] }), failure: { kind: 'provider', code: 'usage_unavailable', requestSent: true, usage: null }, retry: false, known: false },
];
for (const engine of ['preparation', 'investigation'] as const) describe(`${engine} transport → engine → recovery policy`, () => {
  it.each(scenarios)('preserves structured $label and accounting', async scenario => {
    const state = applyAction(adaptationFixture(), { type: 'attempt', lessonId: 'original-adaptive-question', optionIndex: 0 });
    const adaptation = { ...adaptationForAttempt(state, 'owner', state.attempts[0].id)!, attempts: 1 };
    const provider = vi.fn(scenario.fetch); vi.stubGlobal('fetch', provider);
    const error = await failed(engine === 'preparation' ? prepareWithSpark(state, adaptation.courseId, 'Practice the current course concept') : investigateWithSpark(state, { courseId: adaptation.courseId, goal: 'Investigate the current course concept' }));
    expect(error.failure).toEqual(scenario.failure); expect(provider).toHaveBeenCalledTimes(1);
    const job: PreparationJob = { id: 'synthetic-job', ownerId: 'owner', workspaceId: state.id, courseId: adaptation.courseId, sourceRefs: state.sources.filter(source => source.courseId === adaptation.courseId).map(source => ({ sourceId: source.id, version: source.version })), topic: 'Practice', attempts: 1, status: 'generating', contextRevision: state.revision, createdAt: state.createdAt, updatedAt: state.createdAt };
    expect(preparationFailurePatch(job, error, 1000)).toMatchObject({ status: scenario.retry ? 'queued' : 'failed', nextAttemptAt: scenario.retry ? 31000 : 0 });
    // Rewording display strings cannot change recovery or the immutable failure record.
    error.run.effect = 'No network category is mentioned here.'; error.run.steps = ['Display wording replaced entirely.']; error.message = 'Reworded presentation';
    expect(preparationFailurePatch(job, error, 1000).status).toBe(scenario.retry ? 'queued' : 'failed');
    if (engine === 'investigation') expect(adaptationFailurePatch(state, adaptation, error, 1000).status).toBe(scenario.retry ? 'queued' : 'failed');
    expect(JSON.stringify(error.failure)).not.toContain('PRIVATE');
    expect(charges()).toHaveLength(1);
    if (scenario.known) expect(charges()[0].charged).toBeCloseTo(usageCost(100, 10)); else expect(charges()[0].charged).toBeNull();
  });


  it('classifies call exhaustion without changing the existing bounded call count', async () => {
    const state = seedWorkspace(`calls-${engine}`); let call = 0;
    const provider = vi.fn(async () => response({ status: 'completed', usage, output: [{ type: 'function_call', name: 'read_source', call_id: `read-${++call}`, arguments: JSON.stringify({ sourceId: 'source-probability', ...(engine === 'investigation' ? { offset: 0 } : {}) }) }] }));
    vi.stubGlobal('fetch', provider);
    const error = await failed(engine === 'preparation' ? prepareWithSpark(state, 'probability', 'Practice independence') : investigateWithSpark(state, { courseId: 'probability', goal: 'Investigate independence' }));
    expect(error.failure).toEqual({ kind: 'limit', code: 'calls' }); expect(retryableExecutionFailure(error.failure)).toBe(false);
    expect(provider).toHaveBeenCalledTimes(engine === 'preparation' ? 4 : 8);
    expect(charges()[0].charged).toBeCloseTo(call * usageCost(100, 10));
  });

  it('classifies rejected source tools without adding retries or expanding repair limits', async () => {
    const state = seedWorkspace(`validation-${engine}`); let call = 0;
    const provider = vi.fn(async () => response({ status: 'completed', usage, output: [{ type: 'function_call', name: 'read_source', call_id: `invalid-${++call}`, arguments: JSON.stringify({ sourceId: 'foreign-source', ...(engine === 'investigation' ? { offset: 0 } : {}) }) }] }));
    vi.stubGlobal('fetch', provider);
    const error = await failed(engine === 'preparation' ? prepareWithSpark(state, 'probability', 'Practice independence') : investigateWithSpark(state, { courseId: 'probability', goal: 'Investigate independence' }));
    expect(error.failure).toEqual({ kind: 'validation', code: 'tool' }); expect(retryableExecutionFailure(error.failure)).toBe(false);
    expect(provider).toHaveBeenCalledTimes(engine === 'preparation' ? 1 : 2);
    expect(charges()[0].charged).toBeCloseTo(call * usageCost(100, 10));
  });

  it('preserves pre-request configuration failure facts without a provider call or retained reservation', async () => {
    vi.stubEnv('META_API_BASE_URL', 'https://unsupported.example.invalid'); const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const state = seedWorkspace(`configuration-${engine}`);
    const events: AuditEventInput[] = []; const audit = { id: 'synthetic-audit', append: async (event: AuditEventInput) => { events.push(event); }, finish: async () => {} };
    const error = await failed(engine === 'preparation' ? prepareWithSpark(state, 'probability', 'Practice independence', { audit }) : investigateWithSpark(state, { courseId: 'probability', goal: 'Investigate independence' }, { audit }));
    expect(events.find(event => event.kind === 'usage')?.usage?.calls).toBe(0);
    expect(error.failure).toEqual({ kind: 'provider', code: 'configuration', requestSent: false, usage: null });
    expect(retryableExecutionFailure(error.failure)).toBe(false); expect(provider).not.toHaveBeenCalled(); expect(charges()[0].charged).toBe(0);
  });

  it('retains an actual timeout fact without raw abort details or another engine call', async () => {
    vi.useFakeTimers(); const provider = vi.fn(async () => new Promise<Response>(() => {})); vi.stubGlobal('fetch', provider);
    const state = seedWorkspace(`timeout-${engine}`);
    const operation = failed(engine === 'preparation' ? prepareWithSpark(state, 'probability', 'Practice independence') : investigateWithSpark(state, { courseId: 'probability', goal: 'Investigate independence' }));
    await vi.advanceTimersByTimeAsync(30001);
    const error = await operation;
    expect(error.failure).toEqual({ kind: 'provider', code: 'timeout', requestSent: true, usage: null });
    expect(retryableExecutionFailure(error.failure)).toBe(true); expect(provider).toHaveBeenCalledTimes(1); expect(charges()[0].charged).toBeNull();
  });
});

describe('failure facts are the sole model recovery authority', () => {
  it('fails closed for legacy/unknown errors even when display text spoofs retry categories', () => {
    const state = seedWorkspace('legacy-errors');
    const run = { id: 'synthetic-run', trigger: 'Original fixture', mode: 'synthetic' as const, status: 'failed' as const, sourceIds: [], createdAt: state.createdAt, steps: ['Stopped at Meta network.'], effect: 'Investigation stopped safely (network).' };
    const job: PreparationJob = { id: 'legacy-job', ownerId: 'owner', workspaceId: state.id, courseId: 'probability', sourceRefs: [], topic: 'Practice', attempts: 1, status: 'generating', contextRevision: 0, createdAt: state.createdAt, updatedAt: state.createdAt };
    for (const error of [new PreparationError(run), new InvestigationError(run), new Error('Stopped at Meta network.'), { failure: { kind: 'provider', code: 'network' } }]) {
      expect(preparationFailurePatch(job, error, 1000).status).toBe('failed'); expect(executionFailure(error)).toBeUndefined();
    }
  });
  it('copies only known typed provider facts and rejects validation/limits as retry authority', () => {
    const provider = new MetaClientError('http', usage, true); const facts = executionFailure(provider)!;
    expect(facts).toEqual({ kind: 'provider', code: 'http', usage, requestSent: true });
    if (facts.kind === 'provider') expect(facts.usage).not.toBe(provider.usage);
    for (const failure of [undefined, { kind: 'validation', code: 'tool' }, { kind: 'limit', code: 'calls' }, { kind: 'limit', code: 'time' }] as (ExecutionFailure | undefined)[]) expect(retryableExecutionFailure(failure)).toBe(false);
  });
});
