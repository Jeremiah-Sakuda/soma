import { describe, expect, it } from 'vitest';
import { adaptationFixture } from '../fixtures/adaptation';
import { applyAction } from '../../src/lib/domain/learning';
import { adaptationForAttempt, adaptationContextCurrent, adaptationClaimable, adaptationFailurePatch, publishAdaptation } from '../../src/lib/server/adaptation-jobs';
import { WorkspaceConflictError } from '../../src/lib/server/store';
import { InvestigationError, type InvestigationResult } from '../../src/lib/server/investigator';
const answer = () => applyAction(adaptationFixture(), { type: 'attempt', lessonId: 'original-adaptive-question', optionIndex: 0 });
describe('automatic adaptation immutable evidence boundary', () => {
  it('queues only saved account diagnostic observations and keeps support in the immutable identity', () => {
    const state = answer(), job = adaptationForAttempt(state, 'owner', state.attempts[0].id)!;
    expect(job.status).toBe('queued'); expect(adaptationContextCurrent(state, job)).toBe(true);
    expect(adaptationForAttempt(JSON.parse(JSON.stringify(state)), 'owner', state.attempts[0].id)?.id).toBe(job.id);
    expect(adaptationForAttempt({ ...state, mode: 'demo' }, 'owner', state.attempts[0].id)).toBeNull();
    expect(adaptationForAttempt(state, 'owner', 'missing')).toBeNull();
    expect(adaptationForAttempt({ ...state, attempts: [{ ...state.attempts[0], correct: true }] }, 'owner', state.attempts[0].id)).toBeNull();
    const helped = structuredClone(state); helped.attempts[0].assisted = true; helped.attempts[0].assistance.push('original recorded hint');
    expect(adaptationContextCurrent(helped, job)).toBe(false);
  });
  it('rejects old jobs after a revised response, source/version change, model change or workspace replacement', () => {
    const state = answer(), job = adaptationForAttempt(state, 'owner', state.attempts[0].id)!;
    const revised = applyAction(state, { type: 'attempt', lessonId: job.lessonId, optionIndex: 1, revisionOf: job.attemptId });
    expect(adaptationContextCurrent(revised, job)).toBe(false); expect(revised.attempts[0]).toEqual(state.attempts[0]);
    const changed = structuredClone(state); changed.sources.find(source => source.courseId === job.courseId)!.version++;
    expect(adaptationContextCurrent(changed, job)).toBe(false);
    expect(adaptationContextCurrent({ ...state, id: 'another-workspace' }, job)).toBe(false);
    expect(adaptationContextCurrent(state, { ...job, engineVersion: 'old-engine' })).toBe(false);
    const laterHelp = applyAction(state, { type: 'assistance', lessonId: job.lessonId, kind: 'explanation' });
    expect(adaptationContextCurrent(laterHelp, job)).toBe(true); expect(laterHelp.attempts[0]).toEqual(state.attempts[0]);
  });
  it('reclaims only expired bounded leases and respects budget backoff', () => {
    const state = answer(), job = adaptationForAttempt(state, 'owner', state.attempts[0].id)!;
    expect(adaptationClaimable(job, 100)).toBe(true);
    expect(adaptationClaimable({ ...job, status: 'running', leaseUntil: 200 }, 100)).toBe(false);
    expect(adaptationClaimable({ ...job, status: 'running', leaseUntil: 50 }, 100)).toBe(true);
    expect(adaptationClaimable({ ...job, attempts: 3 }, 100)).toBe(false);
    expect(adaptationClaimable({ ...job, nextAttemptAt: 200 }, 100)).toBe(false);
  });
  it('retries temporary transport and unrelated revision races, but stops invalid or exhausted work',()=>{
    const state=answer(),job={...adaptationForAttempt(state,'owner',state.attempts[0].id)!,attempts:1};
    const helped=applyAction(state,{type:'assistance',lessonId:job.lessonId,kind:'hint'});
    expect(adaptationFailurePatch(helped,job,new WorkspaceConflictError(),100)).toMatchObject({status:'queued',nextAttemptAt:30100});
    expect(adaptationFailurePatch(state,job,{status:503},100)).toMatchObject({status:'queued'});
    const network=new InvestigationError({id:'original-failure',mode:'synthetic',status:'failed',trigger:'Original transport fixture',createdAt:state.createdAt,sourceIds:[],steps:[],effect:'Investigation stopped safely (network).'});
    expect(adaptationFailurePatch(state,job,network,100)).toMatchObject({status:'queued',failureRun:network.run});
    expect(adaptationFailurePatch(state,{...job,attempts:3},network,100).status).toBe('failed');
    expect(adaptationFailurePatch(state,job,new Error('Invalid diagnostic'),100).status).toBe('failed');
    const revised=applyAction(state,{type:'attempt',lessonId:job.lessonId,optionIndex:1});
    expect(adaptationFailurePatch(revised,job,new WorkspaceConflictError(),100).status).toBe('stale');
    expect(adaptationFailurePatch(null,job,network,100).status).toBe('stale');
  });
  it('publishes only the job response investigation without overwriting observations', () => {
    const state = answer(), job = adaptationForAttempt(state, 'owner', state.attempts[0].id)!, previous = state.investigations![0];
    const decision = { decision: 'keep-current' as const, applicability: 'course' as const, assessmentId: null, conflicts: [], reason: 'The saved response leaves the current activity useful.', sourceRefs: previous.sourceRefs };
    const result: InvestigationResult = { decision, record: { ...decision, id: 'reconsidered-original', workspaceId: state.id, courseId: job.courseId, createdAt: new Date().toISOString(), mode: 'synthetic', supersedesId: previous.id, attemptIds: [job.attemptId] }, reads: new Map(previous.sourceRefs.map(ref => [ref.sourceId, { version: ref.version, body: state.sources.find(source => source.id === ref.sourceId)!.body }])), run: { id: 'original-adaptation-run', mode: 'synthetic', status: 'completed', trigger: 'Original synthetic job', createdAt: state.createdAt, sourceIds: [], steps: [], effect: 'Retained current work.' } };
    const published = publishAdaptation(state, job, result);
    expect(published.attempts).toEqual(state.attempts); expect(published.investigations).toHaveLength(2);
    expect(() => publishAdaptation(state, job, { ...result, record: { ...result.record, workspaceId: 'foreign' } })).toThrow();
    expect(() => publishAdaptation(state, job, { ...result, record: { ...result.record, attemptIds: ['foreign'] } })).toThrow();
  });
});
