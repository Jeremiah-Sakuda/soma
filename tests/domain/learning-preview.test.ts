import {describe,expect,it} from 'vitest';
import {seedWorkspace,seedEmptyAccountWorkspace} from '../../src/lib/domain/seed';
import {applyAction} from '../../src/lib/domain/learning';
import {prepareLearningGraphPreview} from '../../src/lib/domain/learning-preview';
import {reconcileLearningGraph,localLearningGraph} from '../../src/lib/domain/learning-graph';
import {workspaceActionSchema} from '../../src/lib/server/action-schema';
describe('reviewable original synthetic graph entry',()=>{
 it('opens a labeled prepared checked comparison with linked evidence and deduplicates restart',()=>{
  const before=seedWorkspace('preview-entry'),state=applyAction(before,{type:'scenario',scenario:'learning-graph'}),saved=reconcileLearningGraph(before,state);
  expect(saved.recommendedLessonId).toBe('graph-preview-parallel');
  expect(saved.lessons[0]).toMatchObject({mode:'prepared',diagnosticExperiment:{input:{predictions:[{predictedValue:1},{predictedValue:2.5}]}}});
  expect(saved.investigations?.at(-1)?.mode).toBe('synthetic');expect(saved.investigations?.at(-1)?.usage).toBeUndefined();
  expect(localLearningGraph(saved,saved.lessons[0].id).filter(item=>item.kind==='interpretation')).toHaveLength(2);
  const replay=applyAction(JSON.parse(JSON.stringify(saved)),{type:'scenario',scenario:'learning-graph'});
  expect(replay.lessons).toEqual(saved.lessons);expect(replay.investigations).toEqual(saved.investigations);
 });
 it('does not resurrect old interpretations after reset and a new preview generation',()=>{
  const before=seedWorkspace('reset-preview'),initial=reconcileLearningGraph(before,applyAction(before,{type:'scenario',scenario:'learning-graph'}));
  const reset=reconcileLearningGraph(initial,applyAction(initial,{type:'reset'}));
  const next=reconcileLearningGraph(reset,applyAction(reset,{type:'scenario',scenario:'learning-graph'}));
  expect(next.recommendedLessonId).not.toBe(initial.recommendedLessonId);
  expect(localLearningGraph(next,next.recommendedLessonId!).filter(record=>record.kind==='interpretation')).toHaveLength(2);
  expect(next.learningGraph?.slice(0,initial.learningGraph!.length)).toEqual(initial.learningGraph);
 });
 it('does not seed fictional evidence into a private account or accept arbitrary correction fields',()=>{
  const account=seedEmptyAccountWorkspace('account-preview-denial');expect(()=>prepareLearningGraphPreview(account,new Date().toISOString())).toThrow();
  expect(()=>applyAction(account,{type:'scenario',scenario:'learning-graph'})).toThrow();expect(account.sources).toEqual([]);
  expect(workspaceActionSchema.safeParse({type:'correct-learning',lessonId:'lesson',note:'Correction',correct:true}).success).toBe(false);
  expect(workspaceActionSchema.safeParse({type:'correct-learning',lessonId:'lesson',note:' '.repeat(2)}).success).toBe(false);
 });
});
