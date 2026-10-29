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
  const observedVariant = process.env.SOMA_GRAPH_ADAPTATION_VARIANT === 'observed-20v';
  const reportedVariant = observedVariant || process.env.SOMA_GRAPH_ADAPTATION_VARIANT === 'reported-24v';
  const answeredVariant = reportedVariant || process.env.SOMA_GRAPH_ADAPTATION_VARIANT === 'answered-18v';
  const fresh = answeredVariant || process.env.SOMA_GRAPH_ADAPTATION_VARIANT === 'fresh-9v';
  const initial=prepareLearningGraphPreview(seedWorkspace(`graph-adaptation-${randomUUID()}`),new Date().toISOString(),observedVariant?{voltage:20,r1:10,r2:5}:reportedVariant?{voltage:24,r1:8,r2:4}:answeredVariant?{voltage:18,r1:9,r2:3}:fresh?{voltage:9,r1:9,r2:3}:undefined);
  initial.mode='account';const lesson=initial.lessons[0];initial.lessons=[lesson];initial.sources=initial.sources.filter(source=>lesson.sourceIds.includes(source.id));
  const notes=fresh ? ['I used V divided by R correctly, but treated the bent wire as another element when reading the drawing. I want to check endpoint connectivity in a different arrangement.','I guessed the equal-current answer and cannot yet explain voltage or resistance.'] : ['I know each parallel branch has the same voltage and current depends on its own resistance. I misread which wire joined which node in the original drawing.','I do not know why I chose equal current. I was guessing and cannot explain which nodes are connected.'];
  const metrics:Record<string,unknown>[]=[],results:unknown[]=[];
  for(const [index,note]of notes.entries()){
   const cap=budgetLimit(Number(process.env.META_ALLOCATION_USD),Number(process.env.META_APP_SPEND_CAP_USD));
   const consumed=Number((await getServerFirestore().doc('somaBudget/global').get()).get('consumed')??0);
   if(consumed+INVESTIGATION_RESERVATION_USD>cap){metrics.push({index,status:'budget-pending'});continue;}
   const base=answeredVariant?applyAction(structuredClone(initial),{type:'attempt',lessonId:lesson.id,optionIndex:index===0?0:2}):structuredClone(initial);
   const state=applyAction(base,{type:'correct-learning',lessonId:lesson.id,note,...(answeredVariant?{revisionOf:base.attempts.at(-1)!.id}:{})}),observation=state.attempts.at(-1)!;
   const started=Date.now();
   try{
    const result=await investigateWithSpark(state,{courseId:lesson.courseId,previousInvestigationId:lesson.diagnosticInvestigationId!,attemptId:observation.id,goal:'Reconsider both provisional explanations using this saved student correction and the cited evidence. Choose the next useful supported activity, preserving uncertainty and retaining valid work when appropriate.'});
    const published=publishInvestigation(state,result);
    const changed=!!result.lesson&&materiallyDifferentActivity(lesson,result.lesson);
    metrics.push({index,status:'completed',decision:result.decision.decision,materialChange:changed,revisionCount:result.record.hypothesisRevisions?.length,calls:result.record.usage?.calls,costUsd:result.record.usage?.costUsd,elapsedMs:Date.now()-started});
    results.push({record:result.record,lesson:result.lesson});
    expect(published.attempts).toEqual(state.attempts);expect(published.sources).toEqual(state.sources);
   }catch(error){metrics.push({index,status:'failed',failure:(error as {failure?:unknown}).failure??null,steps:(error as {run?:{steps?:string[]}}).run?.steps??[],elapsedMs:Date.now()-started});}
  }
  const consumedUsd=Number((await getServerFirestore().doc('somaBudget/global').get()).get('consumed')??0);
  mkdirSync('.local',{recursive:true,mode:0o700});writeFileSync(observedVariant?'.local/learning-graph-adaptation-observed-live.json':reportedVariant?'.local/learning-graph-adaptation-reported-live.json':answeredVariant?'.local/learning-graph-adaptation-answered-live.json':fresh?'.local/learning-graph-adaptation-fresh-live.json':'.local/learning-graph-adaptation-live.json',JSON.stringify({mode:'actual-Spark/synthetic-observations/authored-initial-artifact',at:new Date().toISOString(),metrics,results,consumedUsd},null,2),{mode:0o600});
  console.info(JSON.stringify({label:'actual-Spark/synthetic-adaptation',metrics,consumedUsd}));
  expect(metrics.filter(item=>item.status==='completed')).toHaveLength(2);
  expect(metrics[0].materialChange,'Contrary correction should yield a materially different next activity').toBe(true);
 });
});
