import { describe, expect, it } from 'vitest';
import { adaptationFixture } from '../fixtures/adaptation';
import { applyAction } from '../../src/lib/domain/learning';
import { reviseHypothesesFromAttempt } from '../../src/lib/domain/diagnostics';
import { adaptationForAttempt } from '../../src/lib/server/adaptation-jobs';

const now = '2026-10-27T16:00:00.000Z';
describe('student corrections and support snapshots', () => {
  it('retains original answers, versions, help and correction semantics through reload and reconsideration', () => {
    let state = adaptationFixture('correction-history');
    const lesson = state.lessons[0];
    state = applyAction(state, { type:'attempt', lessonId:lesson.id, optionIndex:0 }, now);
    const original = structuredClone(state.attempts[0]);
    state = applyAction(state, { type:'assistance', lessonId:lesson.id, kind:'explanation' }, now);
    state = applyAction(state, { type:'correct-learning', lessonId:lesson.id, note:'The handwritten quantity was voltage, not current.', revisionOf:original.id }, now);
    state = JSON.parse(JSON.stringify(state));
    expect(state.attempts[0]).toEqual(original);
    const correction = state.attempts[1];
    expect(correction).toMatchObject({responseKind:'correction',correctionOf:original.id,revisionOf:original.id,novel:false,correct:null,assisted:true,sourceVersions:original.sourceVersions,createdAt:now});
    const reconsideration = reviseHypothesesFromAttempt(state.investigations![0].diagnosticPlan!, correction, state);
    expect(reconsideration.observation).toMatchObject({optionIndex:null,responseKind:'correction',correctionOf:original.id});
    expect(reconsideration.hypotheses.every(item=>item.status==='unresolved')).toBe(true);
    expect(adaptationForAttempt(state,'synthetic-owner',correction.id)).toMatchObject({attemptId:correction.id,lessonId:lesson.id,status:'queued'});
  });
  it('permits an initial transcription correction without creating independent understanding', () => {
    const state = adaptationFixture('initial-correction'), lesson = state.lessons[0];
    const next = applyAction(state,{type:'correct-learning',lessonId:lesson.id,note:'I could not read the label in the returned work.'},now);
    expect(next.attempts[0]).toMatchObject({responseKind:'correction',novel:false,correct:null});
    expect(next.attempts[0]).not.toHaveProperty('correctionOf');
    expect(reviseHypothesesFromAttempt(next.investigations![0].diagnosticPlan!,next.attempts[0],next).hypotheses.every(item=>item.status==='unresolved')).toBe(true);
    expect(state.attempts).toHaveLength(0);
  });
  it('rejects foreign observations, non-diagnostics, stale versions and blank correction text', () => {
    const state=adaptationFixture('correction-boundaries'), id=state.lessons[0].id;
    expect(()=>applyAction(state,{type:'correct-learning',lessonId:id,note:'Correction',revisionOf:'foreign'})).toThrow(/observation/);
    expect(()=>applyAction(state,{type:'correct-learning',lessonId:id,note:'   '})).toThrow(/Describe/);
    expect(()=>applyAction(state,{type:'correct-learning',lessonId:'parallel-nodes',note:'Correction'})).toThrow(/diagnostic/);
    state.lessons[0].state='stale';
    expect(()=>applyAction(state,{type:'correct-learning',lessonId:id,note:'Correction'})).toThrow(/stale/);
  });
  it('snapshots prediction support and source versions without changing an earlier selection', () => {
    let state=adaptationFixture('prediction-snapshot');
    const id='parallel-nodes';
    state=applyAction(state,{type:'assistance',lessonId:id,kind:'explanation'},now);
    state=applyAction(state,{type:'prediction',lessonId:id,optionIndex:0},now);
    const selection=structuredClone(state.predictions![0]);
    expect(selection.sourceVersions).toEqual(state.lessons.find(item=>item.id===id)!.sourceVersions);
    expect(selection.assistance).toEqual([`${now} · explanation`]);
    state=applyAction(state,{type:'reveal-prediction',lessonId:id},now);
    expect(state.predictions![0]).toEqual(selection);
  });
});
