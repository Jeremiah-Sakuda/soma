import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createWorkspace, readWorkspace, updateWorkspace, closeLocalStore } from '../../src/lib/server/store';
import { createAuditRun, readAuditRuns, closeLocalAuditStore, AuditStoreError, type AuditWriter } from '../../src/lib/server/audit-store';
import { investigateWithSpark, publishInvestigation, ENGINE_VERSION } from '../../src/lib/server/investigator';
import { applyAction } from '../../src/lib/domain/learning';

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-investigator-audit-'));
  for (const [name, value] of Object.entries({ SOMA_PERSISTENCE: 'local-synthetic', SOMA_LOCAL_DATABASE_PATH: join(directory, 'workspace.sqlite'), SOMA_LIVE_INFERENCE: 'true', MODEL_API_KEY: 'synthetic-key-not-sent', META_API_BASE_URL: 'https://api.meta.ai/v1', META_MODEL_ID: 'muse-spark-1.3', META_ALLOCATION_USD: '150', META_APP_SPEND_CAP_USD: '2', SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite') })) vi.stubEnv(name, value);
});
afterEach(() => { closeLocalAuditStore(); closeLocalStore(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(directory, { recursive: true, force: true }); });
const metadata = { kind: 'investigation' as const, trigger: 'Original synthetic audit test', mode: 'live' as const, courseId: 'probability', model: 'muse-spark-1.3', engineVersion: ENGINE_VERSION, promptVersion: ENGINE_VERSION };
const request = { courseId: 'probability', goal: 'PRIVATE_GOAL_DO_NOT_COPY_TO_JOURNAL', initialSourceIds: ['source-probability'] };
const rationale = 'Read the exact course distinction before choosing useful practice.';
const reply = (name: string, args: unknown, call: number) => new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 100, output_tokens: 10 }, output: [{ type: 'function_call', name, arguments: JSON.stringify(args), call_id: `synthetic-audit-${call}` }] }), { headers: { 'content-type': 'application/json' } });
const setup = async () => {
  const fixture = await createWorkspace(), access = { kind: 'demo' as const, token: fixture.token };
  const writer = await createAuditRun(access, fixture.workspace, metadata), source = fixture.workspace.sources.find(item => item.id === 'source-probability')!;
  const evidence = [{ sourceId: source.id, version: source.version, quote: source.body }];
  const finish = (selectedLessonId?: string) => ({ decision: selectedLessonId ? 'revise-session' : 'keep-current', reason: 'Current course evidence supports retaining appropriate original practice.', sourceRefs: evidence, applicability: 'course', assessmentIds: [], conflicts: [], selectedLessonIds: selectedLessonId ? [selectedLessonId] : [], academicUpdates: [], auditRationale: 'Complete the source-grounded decision after validating the evidence.' });
  return { ...fixture, access, writer, source, evidence, finish };
};

describe('investigator and actual durable SQLite audit integration', () => {
  it('persists a protected live prefix before completion, preserves diagnostic rationale, and reuses without calls', async () => {
    const fixture = await setup(), { workspace, access, writer, source, evidence } = fixture;
    let calls = 0, reached!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
    const diagnostic = {
      hypotheses: [
        { id: 'equal-probabilities', claim: 'The learner may confuse independence with equality of probability.', evidence, attemptIds: [] },
        { id: 'diagram-reading', claim: 'The learner may have misread a probability diagram.', evidence, attemptIds: [] },
      ],
      question: 'Does independence require two events to have equal probabilities?', options: ['It requires equality', 'Probabilities can differ', 'It requires zero probability'],
      predictions: [{ hypothesisId: 'equal-probabilities', predictedOptionIndex: 0 }, { hypothesisId: 'diagram-reading', predictedOptionIndex: 1 }],
      rationale: 'The contrasting predictions distinguish two provisional explanations without assigning a grade.', nextActivity: 'Compare a different independent-event example using its stated probabilities.',
      auditRationale: 'Choose an optional diagnostic with different predicted responses.',
    };
    const provider = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls++; const sent = JSON.parse(String(init?.body));
      expect(sent.tools.every((tool: { parameters: { required: string[] } }) => tool.parameters.required.includes('auditRationale'))).toBe(true);
      if (calls === 1) return reply('read_source', { sourceId: source.id, offset: 0, auditRationale: rationale }, calls);
      if (calls === 2) { reached(); await held; return reply('prepare_diagnostic', diagnostic, calls); }
      const output = JSON.parse(sent.input.filter((item: { type?: string }) => item.type === 'function_call_output').at(-1).output);
      return reply('finish_investigation', fixture.finish(output.lessonId), calls);
    }); vi.stubGlobal('fetch', provider);
    const pending = investigateWithSpark(workspace, request, { audit: writer });
    try {
      await entered;
      closeLocalAuditStore(); // A different disk connection must see confirmed progress now.
      const [prefix] = await readAuditRuns(access, workspace);
      expect(prefix.status).toBe('running');
      expect(prefix.events.some(event => event.kind === 'observation' && event.evidence?.some(ref => ref.sourceId === source.id))).toBe(true);
      expect(prefix.events.filter(event => event.actor === 'model').every(event => event.protected && !event.rationale)).toBe(true);
      expect((await readWorkspace(fixture.token))!.revision).toBe(workspace.revision);
      const db = new DatabaseSync(join(directory, 'workspace.sqlite'));
      try { expect(String(db.prepare('SELECT payload FROM audit_runs').get()?.payload)).toContain(rationale); } finally { db.close(); }
    } finally { release(); }
    const result = await pending;
    expect(result.lesson?.diagnosticInvestigationId).toBe(result.record.id);
    expect(result.record.diagnosticPlan?.rationale).toBe(diagnostic.rationale);
    expect((await readAuditRuns(access, workspace))[0].events.some(event => event.kind === 'publication')).toBe(false);
    const published = await updateWorkspace(fixture.token, state => publishInvestigation(state, result), workspace.revision);
    await writer.append({ actor: 'application', kind: 'publication', summary: 'The verified test workspace commit saved this diagnostic.', visibility: 'public' });
    await writer.finish({ status: 'published', selectedLessonId: result.lesson!.id, publishedLessonId: result.lesson!.id });
    expect((await readAuditRuns(access, published))[0].events.filter(event => event.actor === 'model').every(event => event.protected)).toBe(true);
    const answered = await updateWorkspace(fixture.token, state => applyAction(state, { type: 'attempt', lessonId: result.lesson!.id, optionIndex: 1 }));
    const [complete] = await readAuditRuns(access, answered);
    expect(complete.events.some(event => event.actor === 'model' && event.rationale === rationale && !event.protected)).toBe(true);
    expect(JSON.stringify(complete)).not.toContain(request.goal);
    expect(JSON.stringify(complete)).not.toContain(source.body);
    const cacheWriter = await createAuditRun(access, answered, metadata);
    const cached = await investigateWithSpark(answered, request, { audit: cacheWriter });
    expect(cached.reused).toBe(true); expect(calls).toBe(3);
    await cacheWriter.finish({ status: 'unchanged', mode: 'prepared', selectedLessonId: result.lesson!.id });
    const [cache] = await readAuditRuns(access, answered, cacheWriter.id);
    expect(cache.events).toHaveLength(1); expect(cache.events[0].summary).toContain('No model call');
    const db = new DatabaseSync(join(directory, 'budget.sqlite'));
    try { expect(db.prepare('SELECT COUNT(*) AS count FROM reservations').get()?.count).toBe(1); } finally { db.close(); }
  });

  it('retains a rejected proposal and one repair before returning a validated outcome', async () => {
    const fixture = await setup(); let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++;
      if (calls === 1) return reply('read_source', { sourceId: fixture.source.id, offset: 0, auditRationale: rationale }, calls);
      const finish = fixture.finish();
      return reply('finish_investigation', calls === 2 ? { ...finish, sourceRefs: [{ ...fixture.evidence[0], quote: 'An invented passage that is absent from the disclosed source.' }] } : finish, calls);
    }));
    const result = await investigateWithSpark(fixture.workspace, request, { audit: fixture.writer });
    expect(result.run.status).toBe('completed'); expect(calls).toBe(3);
    const [run] = await readAuditRuns(fixture.access, fixture.workspace);
    expect(run.events.filter(event => event.kind === 'validation' && event.summary.includes('failed application validation'))).toHaveLength(1);
    expect(run.events.some(event => event.kind === 'validation' && event.summary.includes('passed source'))).toBe(true);
    expect(run.events.some(event => event.kind === 'publication')).toBe(false);
  });

  it('halts the next model request when durable append fails and retains the confirmed prefix', async () => {
    const fixture = await setup(); let writes = 0;
    const audit: AuditWriter = { ...fixture.writer, append: async event => {
      if (++writes === 3) throw new AuditStoreError('Synthetic journal outage.', 503, 'audit_storage_failed');
      await fixture.writer.append(event);
    } };
    const provider = vi.fn(async () => reply('read_source', { sourceId: fixture.source.id, offset: 0, auditRationale: rationale }, 1)); vi.stubGlobal('fetch', provider);
    await expect(investigateWithSpark(fixture.workspace, request, { audit })).rejects.toBeInstanceOf(AuditStoreError);
    expect(provider).toHaveBeenCalledTimes(1);
    closeLocalAuditStore();
    const [prefix] = await readAuditRuns(fixture.access, fixture.workspace);
    expect(prefix.events.length).toBeGreaterThan(1);
    expect(prefix.events.some(event => event.kind === 'publication')).toBe(false);
    expect((await readWorkspace(fixture.token))!.investigations ?? []).toHaveLength(0);
    await fixture.writer.finish({ status: 'failed' });
  });
  it('keeps a discarded diagnostic proposal protected after a source-only terminal decision', async () => {
    const fixture = await setup(); let calls = 0;
    const spoiler = 'SPOILER: the unpublished diagnostic expects the unequal-probability option.';
    const diagnostic = {
      hypotheses: [
        { id: 'equal-probabilities', claim: 'The learner may confuse independence with equal probabilities.', evidence: fixture.evidence, attemptIds: [] },
        { id: 'diagram-reading', claim: 'The learner may have misread a diagram.', evidence: fixture.evidence, attemptIds: [] },
      ],
      question: 'Must two independent events have equal probabilities?', options: ['They must be equal', 'They may differ', 'They must be zero'],
      predictions: [{ hypothesisId: 'equal-probabilities', predictedOptionIndex: 0 }, { hypothesisId: 'diagram-reading', predictedOptionIndex: 1 }],
      rationale: 'The different predictions provide an optional way to distinguish provisional explanations.', nextActivity: 'Try an independent-event comparison.', auditRationale: spoiler,
    };
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++;
      if (calls === 1) return reply('read_source', { sourceId: fixture.source.id, offset: 0, auditRationale: rationale }, calls);
      if (calls === 2) return reply('prepare_diagnostic', diagnostic, calls);
      return reply('finish_investigation', fixture.finish(), calls);
    }));
    const result = await investigateWithSpark(fixture.workspace, request, { audit: fixture.writer });
    expect(result.lesson).toBeUndefined(); expect(result.selectedLessonId).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(true);
    const published = await updateWorkspace(fixture.token, state => publishInvestigation(state, result), fixture.workspace.revision);
    await fixture.writer.finish({ status: 'published', protectUnpublishedActivity: result.protectUnpublishedActivity });
    const [run] = await readAuditRuns(fixture.access, published, fixture.writer.id);
    expect(run.status).toBe('published');
    expect(run.events.filter(event => event.actor === 'model').every(event => event.protected && !event.rationale)).toBe(true);
    expect(JSON.stringify(run)).not.toContain(spoiler);
    const db = new DatabaseSync(join(directory, 'workspace.sqlite'));
    try { expect(String(db.prepare('SELECT payload FROM audit_runs').get()?.payload)).toContain(spoiler); } finally { db.close(); }
    expect(calls).toBe(3);
  });

});
