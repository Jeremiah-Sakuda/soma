import { describe, expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { InferenceBudgetError } from '../../src/lib/server/budget';
import { PreparationError } from '../../src/lib/server/meta';
import { InvestigationError } from '../../src/lib/server/investigator';
import { preparationFailurePatch } from '../../src/lib/server/jobs';
import { MetaClientError } from '../../src/lib/server/meta-client';
import { circuitCandidate } from '../../src/lib/domain/lessons';
import { preparationReadyPatch, publishPreparationOutcome, type PreparationOutcome, budgetBlockedJobPatch, jobSourcesCurrent, mayClaimJob, preparationJobId, type PreparationJob } from '../../src/lib/server/jobs';

describe('preparation ownership and restart contracts', () => {
  const workspace = seedEmptyAccountWorkspace('workspace-a', '2026-10-28T12:00:00Z');
  workspace.courses = [{ id: 'course-a', code: 'TEST', title: 'Original synthetic test', instructor: '', color: '#2244C2', deadline: '', nextEvent: '' }];
  workspace.sources = [{ id: 'source-a', version: 1, courseId: 'course-a', title: 'Original fixture', body: 'Original fixture', kind: 'upload', retrievedAt: workspace.createdAt, status: 'current' }];
  const job: PreparationJob = { id: 'job', ownerId: 'owner-a', workspaceId: workspace.id, courseId: 'course-a', topic: 'Resistors', sourceRefs: [{ sourceId: 'source-a', version: 1 }], status: 'queued', createdAt: workspace.createdAt, updatedAt: workspace.createdAt, attempts: 0, contextRevision: 0 };

  it('does not permit publication against another workspace, course, stale version or missing source', () => {
    expect(jobSourcesCurrent(workspace, job)).toBe(true);
    expect(jobSourcesCurrent(workspace, { ...job, workspaceId: 'workspace-b' })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, courseId: 'course-b' })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, sourceRefs: [{ sourceId: 'source-a', version: 2 }] })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, sourceRefs: [] })).toBe(false);
    expect(jobSourcesCurrent({ ...workspace, sources: workspace.sources.map(source => ({ ...source, status: 'stale' })) }, job)).toBe(false);
  });

  it('deduplicates unchanged jobs while distinguishing new source versions and accounts', () => {
    const first = preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic);
    expect(preparationJobId(structuredClone(workspace), job.courseId, job.sourceRefs, job.topic)).toBe(first);
    expect(preparationJobId({ ...workspace, id: 'workspace-b' }, job.courseId, job.sourceRefs, job.topic)).not.toBe(first);
    expect(preparationJobId(workspace, job.courseId, [{ sourceId: 'source-a', version: 2 }], job.topic)).not.toBe(first);
    expect(preparationJobId({ ...workspace, revision: 1 }, job.courseId, job.sourceRefs, job.topic)).not.toBe(first);
    const connectorJob = preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic, 0);
    expect(preparationJobId({ ...workspace, revision: 8 }, job.courseId, job.sourceRefs, job.topic, 0)).toBe(connectorJob);
    expect(preparationJobId(workspace, job.courseId, [{ sourceId: 'source-a', version: 2 }], job.topic, 0)).not.toBe(connectorJob);
  });

  it('distinguishes source investigations from lesson jobs without changing legacy default identity', () => {
    const implicit = preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic);
    expect(preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic, workspace.revision, 'prepare-lesson')).toBe(implicit);
    expect(preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic, workspace.revision, 'investigate-change')).not.toBe(implicit);
  });

  function investigationOutcome(): PreparationOutcome & { intent: 'investigate-change' } {
    const decision = { decision: 'needs-evidence' as const, reason: 'This original source needs explicit authority evidence.', sourceRefs: [{ sourceId: 'source-a', version: 1, quote: 'Original fixture' }], assessmentId: null, applicability: 'unknown' as const, conflicts: [] };
    return { intent: 'investigate-change', result: { decision, record: { ...decision, id: 'source-investigation', workspaceId: workspace.id, courseId: 'course-a', createdAt: workspace.createdAt, mode: 'synthetic' }, reads: new Map([['source-a', { version: 1, body: 'Original fixture' }]]), run: { id: 'run-original', trigger: 'Original source change', createdAt: workspace.createdAt, mode: 'synthetic', status: 'completed', sourceIds: ['source-a'], steps: ['Original synthetic tool result'], effect: 'Uncertainty retained.' } } };
  }

  it('persists an unresolved source investigation without manufacturing a lesson or mutating prior evidence', () => {
    const state = structuredClone(workspace); const before = structuredClone(state);
    const outcome = investigationOutcome(); const investigationJob = { ...job, intent: 'investigate-change' as const };
    const published = publishPreparationOutcome(state, investigationJob, outcome);
    expect(published.investigations).toHaveLength(1);
    expect(published.investigations?.[0].decision).toBe('needs-evidence');
    expect(published.runs[0].id).toBe('run-original');
    expect(published.lessons).toEqual(before.lessons); expect(published.attempts).toEqual(before.attempts);
    expect(state).toEqual(before);
    const ready = preparationReadyPatch(outcome, workspace.createdAt);
    expect(ready).toMatchObject({ status: 'ready', leaseUntil: 0, notice: expect.stringContaining('no new lesson') });
    expect(ready).not.toHaveProperty('lessonId');
    expect(Object.values(ready).every(value => value !== undefined)).toBe(true);
  });

  it('rechecks job references, investigation ownership, newly read versions and selected activity sources', () => {
    const investigationJob = { ...job, intent: 'investigate-change' as const };
    expect(() => publishPreparationOutcome(structuredClone(workspace), job, investigationOutcome())).toThrow();
    const foreign = investigationOutcome(); foreign.result.record.workspaceId = 'foreign-workspace';
    expect(() => publishPreparationOutcome(structuredClone(workspace), investigationJob, foreign)).toThrow();
    const wrongCourse = investigationOutcome(); wrongCourse.result.record.courseId = 'foreign-course';
    expect(() => publishPreparationOutcome(structuredClone(workspace), investigationJob, wrongCourse)).toThrow();
    const stale = structuredClone(workspace); stale.sources.push({ ...stale.sources[0], version: 2, status: 'stale' });
    expect(() => publishPreparationOutcome(stale, investigationJob, investigationOutcome())).toThrow();
    const badCitation = investigationOutcome(); badCitation.result.record.sourceRefs = [{ sourceId: 'newly-followed-missing-source', version: 1, quote: 'Missing original fixture' }];
    expect(() => publishPreparationOutcome(structuredClone(workspace), investigationJob, badCitation)).toThrow();
    const staleLesson = investigationOutcome(); staleLesson.result.lesson = circuitCandidate('course-a', workspace.sources, 'parallel');
    staleLesson.result.lesson.sourceVersions['source-a'] = 2; staleLesson.result.selectedLessonId = staleLesson.result.lesson.id;
    expect(() => publishPreparationOutcome(structuredClone(workspace), investigationJob, staleLesson)).toThrow();
  });

  it('keeps legacy lesson jobs and cached investigation publication idempotent', () => {
    const lesson = circuitCandidate('course-a', workspace.sources, 'parallel');
    const run = investigationOutcome().result.run;
    const outcome: PreparationOutcome = { intent: 'prepare-lesson', result: { lesson, run } };
    const state = publishPreparationOutcome(structuredClone(workspace), job, outcome);
    expect(state.lessons).toHaveLength(1);
    publishPreparationOutcome(state, job, outcome);
    expect(state.lessons).toHaveLength(1);
    expect(preparationReadyPatch(outcome).lessonId).toBe(lesson.id);
    const investigation = investigationOutcome(); const investigationJob = { ...job, intent: 'investigate-change' as const };
    const published = publishPreparationOutcome(structuredClone(workspace), investigationJob, investigation);
    expect(publishPreparationOutcome(published, investigationJob, { ...investigation, result: { ...investigation.result, reused: true } })).toEqual(published);
  });

  it('requeues budget-only denials without consuming retries or forgetting earlier real attempts', () => {
    const claimed = { ...job, status: 'generating' as const, attempts: 2, leaseId: 'owned-lease', leaseUntil: 2000 };
    for (const reason of ['configured', 'daily', 'global'] as const) {
      const patch = budgetBlockedJobPatch(claimed, claimed, new InferenceBudgetError(reason), '2026-10-28T13:00:00Z');
      expect(patch).toMatchObject({ status: 'queued', attempts: 1, leaseId: '', leaseUntil: 0, updatedAt: '2026-10-28T13:00:00Z', notice: expect.stringContaining('no Meta request was made') });
      expect(mayClaimJob({ ...claimed, ...patch })).toBe(true);
    }
    let retried: PreparationJob = { ...job };
    for (let count = 0; count < 5; count++) {
      const leased = { ...retried, status: 'generating' as const, attempts: retried.attempts + 1, leaseId: `lease-${count}` };
      retried = { ...leased, ...budgetBlockedJobPatch(leased, leased, new InferenceBudgetError('daily')) };
    }
    expect(retried.attempts).toBe(0);
    expect(mayClaimJob(retried)).toBe(true);
  });

  it('never refunds another lease, completed work, different owner/generation, or provider failures', () => {
    const claimed = { ...job, status: 'generating' as const, attempts: 1, leaseId: 'owned-lease' };
    for (const changed of [undefined, { ...claimed, ownerId: 'other' }, { ...claimed, workspaceId: 'recreated' }, { ...claimed, id: 'other-job' }, { ...claimed, leaseId: 'new-lease' }, { ...claimed, status: 'checking' as const }, { ...claimed, status: 'ready' as const }, { ...claimed, attempts: 2 }]) {
      expect(budgetBlockedJobPatch(changed, claimed, new InferenceBudgetError('daily'))).toBeNull();
    }
    expect(budgetBlockedJobPatch(claimed, { ...claimed, leaseId: '' }, new InferenceBudgetError('daily'))).toBeNull();
    for (const error of [new Error('Inference allowance reached.'), new MetaClientError('timeout', null, true), new MetaClientError('tool_invalid', { input_tokens: 100, output_tokens: 50 }, true)]) {
      expect(budgetBlockedJobPatch(claimed, claimed, error)).toBeNull();
    }
  });

  it('retries only typed provider interruptions after backoff and stops at the attempt bound', () => {
    const claimed = { ...job, attempts: 1, status: 'generating' as const, leaseId: 'lease' };
    const run = investigationOutcome().result.run;
    for (const code of ['network', 'timeout', 'http'] as const) {
      for (const error of [new PreparationError({ ...run, steps: ['Arbitrary renamed human message.'] }, {kind: 'provider', code, requestSent: true, usage: null}), new InvestigationError({ ...run, effect: 'Arbitrary renamed human message.' }, {kind: 'provider', code, requestSent: true, usage: null})]) {
        const patch = preparationFailurePatch(claimed, error, 1000);
        expect(patch).toMatchObject({ status: 'queued', nextAttemptAt: 31000, leaseId: '', leaseUntil: 0, failure: {kind:'provider',code,requestSent:true,usage:null} });
        expect(mayClaimJob({ ...claimed, ...patch }, 30999)).toBe(false);
        expect(mayClaimJob({ ...claimed, ...patch }, 31000)).toBe(true);
        expect(preparationFailurePatch({ ...claimed, attempts: 3 }, error, 1000).status).toBe('failed');
      }
    }
    for (const error of [new Error('network'), new PreparationError({...run, steps:['Stopped at Meta network.']}), new InvestigationError({...run, effect:'Investigation stopped safely (network).'}), new PreparationError({ ...run, steps: ['Stopped at proposal source, version boundary.'] }), new InvestigationError({ ...run, effect: 'Investigation stopped safely (tool_invalid).' })]) {
      expect(preparationFailurePatch(claimed, error, 1000)).toMatchObject({ status: 'failed', nextAttemptAt: 0 });
    }
  });

  it('recovers expired work without stealing active leases or exceeding restart bounds', () => {
    expect(mayClaimJob({ ...job, status: 'generating', attempts: 1, leaseUntil: 2000 }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'generating', attempts: 1, leaseUntil: 1000 }, 1000)).toBe(true);
    expect(mayClaimJob({ ...job, status: 'checking', attempts: 3, leaseUntil: 1000 }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'ready' }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'stale' }, 1000)).toBe(false);
  });
});
