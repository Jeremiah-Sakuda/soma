import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {seedWorkspace} from '../../src/lib/domain/seed';
import {prepareLearningGraphPreview} from '../../src/lib/domain/learning-preview';
import {applyAction} from '../../src/lib/domain/learning';
import {materiallyDifferentActivity} from '../../src/lib/domain/activity-change';
import {investigateWithSpark,publishInvestigation} from '../../src/lib/server/investigator';
import {getServerFirestore} from '../../src/lib/server/firebase-config';
import {budgetLimit,INVESTIGATION_RESERVATION_USD} from '../../src/lib/server/budget';

describe.skipIf(process.env.SOMA_GRAPH_ADAPTATION_LIVE!=='true')('actual Spark reconsideration of original synthetic observations',()=>{
 it('compares two observations from the same prepared starting context without scripted model actions',{timeout:240000},async()=>{
  expect(process.env.SOMA_PERSISTENCE).toBe('firestore');expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(2);
  const initial=prepareLearningGraphPreview(seedWorkspace(`graph-adaptation-${randomUUID()}`),new Date().toISOString());
  initial.mode='account';const lesson=initial.lessons[0];initial.lessons=[lesson];initial.sources=initial.sources.filter(source=>lesson.sourceIds.includes(source.id));
  const notes=['I know each parallel branch has the same voltage and current depends on its own resistance. I misread which wire joined which node in the original drawing.','I do not know why I chose equal current. I was guessing and cannot explain which nodes are connected.'];
  const metrics:Record<string,unknown>[]=[],results:unknown[]=[];
  for(const [index,note]of notes.entries()){
   const cap=budgetLimit(Number(process.env.META_ALLOCATION_USD),Number(process.env.META_APP_SPEND_CAP_USD));
   const consumed=Number((await getServerFirestore().doc('somaBudget/global').get()).get('consumed')??0);
   if(consumed+INVESTIGATION_RESERVATION_USD>cap){metrics.push({index,status:'budget-pending'});continue;}
   const state=applyAction(structuredClone(initial),{type:'correct-learning',lessonId:lesson.id,note}),observation=state.attempts.at(-1)!;
   const started=Date.now();
   try{
    const result=await investigateWithSpark(state,{courseId:lesson.courseId,previousInvestigationId:lesson.diagnosticInvestigationId!,attemptId:observation.id,goal:'Reconsider both provisional explanations using this saved student correction and the cited evidence. Choose the next useful supported activity, preserving uncertainty and retaining valid work when appropriate.'});
    const published=publishInvestigation(state,result);
    const changed=!!result.lesson&&materiallyDifferentActivity(lesson,result.lesson);
    metrics.push({index,status:'completed',decision:result.decision.decision,materialChange:changed,revisionCount:result.record.hypothesisRevisions?.length,calls:result.record.usage?.calls,costUsd:result.record.usage?.costUsd,elapsedMs:Date.now()-started});
    results.push({record:result.record,lesson:result.lesson});
    expect(published.attempts).toEqual(state.attempts);expect(published.sources).toEqual(state.sources);
   }catch(error){metrics.push({index,status:'failed',failure:(error as {failure?:unknown}).failure??null,elapsedMs:Date.now()-started});}
  }
  const consumedUsd=Number((await getServerFirestore().doc('somaBudget/global').get()).get('consumed')??0);
  mkdirSync('.local',{recursive:true,mode:0o700});writeFileSync('.local/learning-graph-adaptation-live.json',JSON.stringify({mode:'actual-Spark/synthetic-observations/authored-initial-artifact',at:new Date().toISOString(),metrics,results,consumedUsd},null,2),{mode:0o600});
  console.info(JSON.stringify({label:'actual-Spark/synthetic-adaptation',metrics,consumedUsd}));
  expect(metrics.filter(item=>item.status==='completed')).toHaveLength(2);
  expect(metrics[0].materialChange,'Contrary correction should yield a materially different next activity').toBe(true);
 });
});
